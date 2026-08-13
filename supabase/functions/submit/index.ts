// ============================================================================
// Edge Function: submit
//
// El único camino por el que entra información nueva a la base.
//
// Por qué existe en vez de dejar que el navegador escriba directo: sin cuentas
// de usuario, permitirle INSERT al rol anónimo es permitirle INSERT a cualquiera
// que copie la anon key del bundle. Aquí, en cambio, cada aporte pasa por
// validación, captcha opcional, defensas de formulario y límite por IP antes de
// tocar la base, y siempre entra como 'pending'.
//
// Nada de lo que llega por aquí se publica solo. Publicar es decisión de
// moderate/.
// ============================================================================

import {
  CORS,
  ErrorValidacion,
  booleano,
  clienteAdmin,
  correo,
  error,
  hashIp,
  ipDe,
  json,
  numero,
  registrarIntento,
  revisarTrampas,
  slugificar,
  telefono,
  texto,
  unaDe,
  verificarTurnstile,
} from '../_shared/seguridad.ts'

const TIPOS = ['nuevo_punto', 'edicion', 'eliminacion', 'reporte', 'oferta_donacion'] as const
type Tipo = (typeof TIPOS)[number]

// Cuántos aportes de cada clase acepta una misma IP por hora. Generoso para
// quien está ayudando de verdad, estrecho para un script.
const LIMITES: Record<Tipo, number> = {
  nuevo_punto: 5,
  edicion: 10,
  eliminacion: 10,
  reporte: 20,
  oferta_donacion: 10,
}

const MOTIVOS_REPORTE = [
  'cerrado',
  'info_incorrecta',
  'duplicado',
  'ya_no_necesita',
  'saturado',
  'otro',
] as const

const URGENCIAS = ['baja', 'media', 'alta', 'critica'] as const

// Campos que la comunidad puede proponer editar. Deliberadamente NO incluye
// status, verificado ni slug: eso no se negocia por formulario.
const CAMPOS_EDITABLES = [
  'nombre',
  'ciudad',
  'direccion',
  'descripcion',
  'organizacion',
  'horario',
  'telefono',
  'whatsapp',
  'email',
  'department_code',
  'acepta_transporte_grande',
] as const

const ES_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function uuid(valor: unknown, campo = 'punto'): string {
  if (typeof valor !== 'string' || !ES_UUID.test(valor)) {
    throw new ErrorValidacion(`${campo} no es válido`)
  }
  return valor
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return error('Solo se acepta POST', 405)

  let cuerpo: Record<string, unknown>
  try {
    cuerpo = await req.json()
  } catch {
    return error('El cuerpo debe ser JSON')
  }

  let tipo: Tipo
  try {
    tipo = unaDe(cuerpo.tipo, TIPOS, 'tipo de aporte')
  } catch (e) {
    return error(e instanceof Error ? e.message : 'Tipo de aporte inválido')
  }

  // --- Defensas que no le piden nada a la persona -------------------------
  const trampa = revisarTrampas(cuerpo)
  if (trampa) {
    // Se responde 200 y en silencio: un bot que recibe "te detecté" ajusta y
    // vuelve. Uno que cree que funcionó, no.
    console.warn(`Aporte descartado por ${trampa} (tipo=${tipo})`)
    return json({ ok: true, mensaje: 'Recibido' })
  }

  const admin = clienteAdmin()
  const ip = ipDe(req)

  let ipHash: string
  try {
    ipHash = await hashIp(ip)
  } catch (e) {
    console.error('No se pudo calcular el hash de IP:', e)
    return error('El servidor no está configurado correctamente', 500)
  }

  const limite = await registrarIntento(admin, ipHash, tipo, LIMITES[tipo])
  if (!limite.permitido) {
    return error(
      'Recibimos varios envíos desde esta conexión en la última hora. Intenta de nuevo más tarde o escríbenos por GitHub.',
      429,
    )
  }

  if (!(await verificarTurnstile(cuerpo.turnstile_token, ip))) {
    return error('No pudimos verificar que no eres un bot. Recarga la página e intenta de nuevo.', 403)
  }

  const datos = (cuerpo.datos ?? {}) as Record<string, unknown>

  try {
    switch (tipo) {
      case 'nuevo_punto':
        return await crearPunto(admin, datos, ipHash)
      case 'edicion':
        return await solicitarCambio(admin, datos, ipHash, 'edicion')
      case 'eliminacion':
        return await solicitarCambio(admin, datos, ipHash, 'eliminacion')
      case 'reporte':
        return await crearReporte(admin, datos, ipHash)
      case 'oferta_donacion':
        return await registrarOferta(admin, datos, ipHash)
    }
  } catch (e) {
    if (e instanceof ErrorValidacion) return error(e.message, 422)
    console.error(`Error procesando ${tipo}:`, e)
    return error('No pudimos guardar tu aporte. Intenta de nuevo en un momento.', 500)
  }
})

// ---------------------------------------------------------------------------
// Nuevo punto de acopio
// ---------------------------------------------------------------------------
async function crearPunto(
  admin: ReturnType<typeof clienteAdmin>,
  datos: Record<string, unknown>,
  ipHash: string,
): Promise<Response> {
  const nombre = texto(datos.nombre, { requerido: true, min: 4, max: 160, campo: 'el nombre del punto' })!
  const ciudad = texto(datos.ciudad, { requerido: true, min: 2, max: 90, campo: 'la ciudad' })!
  const departamento = texto(datos.department_code, {
    requerido: true,
    max: 40,
    campo: 'el departamento',
  })!

  // El departamento se valida contra la tabla, no contra una lista en el código.
  const { data: dep } = await admin
    .from('departments')
    .select('code')
    .eq('code', departamento)
    .maybeSingle()
  if (!dep) throw new ErrorValidacion('El departamento seleccionado no existe')

  const necesidadesCrudas = Array.isArray(datos.necesidades) ? datos.necesidades : []
  if (necesidadesCrudas.length === 0) {
    throw new ErrorValidacion('Indica al menos una cosa que el punto necesite recibir')
  }
  if (necesidadesCrudas.length > 12) {
    throw new ErrorValidacion('Son demasiadas categorías para un solo punto')
  }

  const { data: categorias } = await admin.from('need_categories').select('slug, unidad_sugerida')
  const validas = new Map((categorias ?? []).map((c) => [c.slug as string, c.unidad_sugerida as string]))

  const necesidades = necesidadesCrudas.map((n) => {
    const item = (n ?? {}) as Record<string, unknown>
    const categoria = texto(item.categoria, { requerido: true, max: 40, campo: 'la categoría' })!
    if (!validas.has(categoria)) throw new ErrorValidacion(`La categoría "${categoria}" no existe`)
    return {
      category_slug: categoria,
      cantidad_solicitada: numero(item.cantidad, { min: 0.01, max: 10_000_000, campo: 'la cantidad' }),
      unidad: texto(item.unidad, { max: 30, campo: 'la unidad' }) ?? validas.get(categoria)!,
      urgencia: item.urgencia ? unaDe(item.urgencia, URGENCIAS, 'la urgencia') : 'media',
      notas: texto(item.notas, { max: 300, campo: 'las notas' }),
    }
  })

  // Sufijo aleatorio en el slug: dos puntos pueden llamarse igual en ciudades
  // distintas, y el slug debe seguir siendo único sin pedirle nada a nadie.
  const sufijo = crypto.randomUUID().slice(0, 6)

  const { data: punto, error: errPunto } = await admin
    .from('collection_points')
    .insert({
      slug: slugificar(nombre, sufijo),
      nombre,
      department_code: departamento,
      ciudad,
      direccion: texto(datos.direccion, { max: 200, campo: 'la dirección' }),
      descripcion: texto(datos.descripcion, { max: 800, campo: 'la descripción', multilinea: true }),
      organizacion: texto(datos.organizacion, { max: 160, campo: 'la organización' }),
      horario: texto(datos.horario, { max: 200, campo: 'el horario' }),
      telefono: telefono(datos.telefono),
      whatsapp: telefono(datos.whatsapp, 'WhatsApp'),
      email: correo(datos.email),
      acepta_transporte_grande: booleano(datos.acepta_transporte_grande),
      lat: numero(datos.lat, { min: -5, max: 14, campo: 'la latitud' }),
      lng: numero(datos.lng, { min: -82, max: -66, campo: 'la longitud' }),
      submitter_nombre: texto(datos.submitter_nombre, { max: 120, campo: 'tu nombre' }),
      submitter_contacto: texto(datos.submitter_contacto, { max: 160, campo: 'tu contacto' }),
      submitter_ip_hash: ipHash,
      status: 'pending',
      verificado: false,
    })
    .select('id, slug')
    .single()

  if (errPunto || !punto) throw new Error(errPunto?.message ?? 'No se pudo crear el punto')

  const { error: errNec } = await admin
    .from('point_needs')
    .insert(necesidades.map((n) => ({ ...n, point_id: punto.id })))

  if (errNec) {
    // Un punto sin necesidades no sirve para nada, así que se revierte a mano
    // (no hay transacciones entre llamadas del cliente).
    await admin.from('collection_points').delete().eq('id', punto.id)
    throw new Error(errNec.message)
  }

  return json({
    ok: true,
    mensaje:
      'Recibimos el punto. Un moderador lo revisa antes de publicarlo, normalmente en pocas horas.',
  })
}

// ---------------------------------------------------------------------------
// Solicitud de edición o de eliminación
// ---------------------------------------------------------------------------
async function solicitarCambio(
  admin: ReturnType<typeof clienteAdmin>,
  datos: Record<string, unknown>,
  ipHash: string,
  tipo: 'edicion' | 'eliminacion',
): Promise<Response> {
  const pointId = uuid(datos.point_id, 'El punto')
  const motivo = texto(datos.motivo, {
    requerido: true,
    min: 10,
    max: 600,
    campo: 'el motivo',
    multilinea: true,
  })!

  const { data: punto } = await admin
    .from('collection_points')
    .select('id')
    .eq('id', pointId)
    .eq('status', 'approved')
    .maybeSingle()
  if (!punto) throw new ErrorValidacion('Ese punto de acopio no existe o no está publicado')

  const payload: Record<string, unknown> = {}
  if (tipo === 'edicion') {
    const propuesto = (datos.payload ?? {}) as Record<string, unknown>
    for (const campo of CAMPOS_EDITABLES) {
      if (!(campo in propuesto)) continue
      if (campo === 'acepta_transporte_grande') {
        payload[campo] = booleano(propuesto[campo])
      } else if (campo === 'telefono' || campo === 'whatsapp') {
        const v = telefono(propuesto[campo], campo)
        if (v) payload[campo] = v
      } else if (campo === 'email') {
        const v = correo(propuesto[campo])
        if (v) payload[campo] = v
      } else {
        const v = texto(propuesto[campo], { max: 800, campo })
        if (v) payload[campo] = v
      }
    }
    if (Object.keys(payload).length === 0) {
      throw new ErrorValidacion('No indicaste ningún cambio concreto')
    }
    if (typeof payload.department_code === 'string') {
      const { data: dep } = await admin
        .from('departments')
        .select('code')
        .eq('code', payload.department_code)
        .maybeSingle()
      if (!dep) throw new ErrorValidacion('El departamento propuesto no existe')
    }
  }

  const { error: err } = await admin.from('point_change_requests').insert({
    point_id: pointId,
    tipo,
    payload,
    motivo,
    submitter_nombre: texto(datos.submitter_nombre, { max: 120, campo: 'tu nombre' }),
    submitter_contacto: texto(datos.submitter_contacto, { max: 160, campo: 'tu contacto' }),
    submitter_ip_hash: ipHash,
  })
  if (err) throw new Error(err.message)

  return json({
    ok: true,
    mensaje:
      tipo === 'edicion'
        ? 'Recibimos tu corrección. Un moderador la revisa antes de aplicarla.'
        : 'Recibimos tu solicitud. Un moderador la revisa antes de retirar el punto.',
  })
}

// ---------------------------------------------------------------------------
// Reporte
// ---------------------------------------------------------------------------
async function crearReporte(
  admin: ReturnType<typeof clienteAdmin>,
  datos: Record<string, unknown>,
  ipHash: string,
): Promise<Response> {
  const pointId = uuid(datos.point_id, 'El punto')
  const motivo = unaDe(datos.motivo, MOTIVOS_REPORTE, 'El motivo del reporte')

  const { data: punto } = await admin
    .from('collection_points')
    .select('id')
    .eq('id', pointId)
    .eq('status', 'approved')
    .maybeSingle()
  if (!punto) throw new ErrorValidacion('Ese punto de acopio no existe o no está publicado')

  const { error: err } = await admin.from('point_reports').insert({
    point_id: pointId,
    motivo,
    comentario: texto(datos.comentario, { max: 600, campo: 'el comentario', multilinea: true }),
    submitter_contacto: texto(datos.submitter_contacto, { max: 160, campo: 'tu contacto' }),
    submitter_ip_hash: ipHash,
  })
  if (err) throw new Error(err.message)

  return json({
    ok: true,
    mensaje: 'Gracias. Los reportes son la forma más rápida de mantener esta información al día.',
  })
}

// ---------------------------------------------------------------------------
// Oferta de donación — "tengo 100 cajas de agua en Medellín"
//
// Se guarda incluso cuando la persona no deja datos de contacto: sirve para
// medir qué se está ofreciendo y qué no encuentra destino.
// ---------------------------------------------------------------------------
async function registrarOferta(
  admin: ReturnType<typeof clienteAdmin>,
  datos: Record<string, unknown>,
  ipHash: string,
): Promise<Response> {
  const categoria = texto(datos.categoria, { requerido: true, max: 40, campo: 'la categoría' })!
  const { data: cat } = await admin
    .from('need_categories')
    .select('slug, unidad_sugerida')
    .eq('slug', categoria)
    .maybeSingle()
  if (!cat) throw new ErrorValidacion('Esa categoría de donación no existe')

  const cantidad = numero(datos.cantidad, {
    requerido: true,
    min: 0.01,
    max: 10_000_000,
    campo: 'la cantidad',
  })!

  let departamento: string | null = texto(datos.department_code, { max: 40, campo: 'el departamento' })
  if (departamento) {
    const { data: dep } = await admin
      .from('departments')
      .select('code')
      .eq('code', departamento)
      .maybeSingle()
    if (!dep) departamento = null
  }

  let matched: string | null = null
  if (datos.matched_point_id) {
    matched = uuid(datos.matched_point_id, 'El punto elegido')
  }

  const { data: oferta, error: err } = await admin
    .from('donation_offers')
    .insert({
      category_slug: categoria,
      cantidad,
      unidad: texto(datos.unidad, { max: 30, campo: 'la unidad' }) ?? cat.unidad_sugerida,
      department_code: departamento,
      ciudad: texto(datos.ciudad, { max: 90, campo: 'la ciudad' }),
      transporte_disponible: booleano(datos.transporte_disponible),
      nombre_contacto: texto(datos.nombre_contacto, { max: 120, campo: 'tu nombre' }),
      telefono: telefono(datos.telefono),
      mensaje: texto(datos.mensaje, { max: 600, campo: 'el mensaje', multilinea: true }),
      matched_point_id: matched,
      submitter_ip_hash: ipHash,
      status: matched ? 'coordinada' : 'abierta',
    })
    .select('id')
    .single()

  if (err || !oferta) throw new Error(err?.message ?? 'No se pudo registrar la oferta')

  return json({ ok: true, id: oferta.id, mensaje: 'Oferta registrada' })
}
