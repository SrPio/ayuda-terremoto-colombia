// ============================================================================
// Edge Function: moderate
//
// El panel de moderación. No hay cuentas de usuario: la autorización es una
// clave que existe únicamente como secreto de esta función (MODERATOR_KEY).
//
// Tres propiedades importantes:
//  - la clave nunca viaja al navegador ni queda en el bundle: el frontend la
//    pide, la manda en una cabecera y la guarda solo en sessionStorage;
//  - la comparación es en tiempo constante, para no filtrarla carácter a
//    carácter midiendo tiempos de respuesta;
//  - los intentos fallidos se cuentan por IP, así que no se puede iterar el
//    espacio de claves desde una misma conexión.
//
// Sin clave válida la función no revela ni la existencia de datos pendientes.
// ============================================================================

import {
  CORS,
  ErrorValidacion,
  booleano,
  clienteAdmin,
  correo,
  error,
  hashIp,
  igualdadSegura,
  ipDe,
  json,
  numero,
  registrarIntento,
  telefono,
  texto,
  unaDe,
} from '../_shared/seguridad.ts'

const ACCIONES = [
  'colas',
  'aprobar_punto',
  'rechazar_punto',
  'inactivar_punto',
  'reactivar_punto',
  'actualizar_punto',
  'aplicar_edicion',
  'rechazar_solicitud',
  'resolver_reporte',
  'guardar_necesidad',
  'eliminar_necesidad',
] as const
type Accion = (typeof ACCIONES)[number]

const URGENCIAS = ['baja', 'media', 'alta', 'critica'] as const

const ES_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function uuid(valor: unknown, campo = 'identificador'): string {
  if (typeof valor !== 'string' || !ES_UUID.test(valor)) {
    throw new ErrorValidacion(`${campo} no es válido`)
  }
  return valor
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return error('Solo se acepta POST', 405)

  const esperada = Deno.env.get('MODERATOR_KEY')
  if (!esperada) {
    console.error('MODERATOR_KEY no está configurada: la moderación queda cerrada.')
    return error('La moderación no está configurada en este despliegue', 503)
  }

  const admin = clienteAdmin()
  const ipHash = await hashIp(ipDe(req))

  // Techo de intentos por IP: aplica a todas las peticiones, válidas o no, así
  // que también acota la fuerza bruta.
  const limite = await registrarIntento(admin, ipHash, 'moderate', 300)
  if (!limite.permitido) return error('Demasiadas peticiones', 429)

  const entregada = req.headers.get('x-moderator-key') ?? ''
  if (!igualdadSegura(entregada, esperada)) {
    const fallos = await registrarIntento(admin, ipHash, 'moderate_fallo', 15)
    if (!fallos.permitido) {
      return error('Demasiados intentos fallidos. Espera una hora.', 429)
    }
    return error('Clave de moderador incorrecta', 401)
  }

  let cuerpo: Record<string, unknown>
  try {
    cuerpo = await req.json()
  } catch {
    return error('El cuerpo debe ser JSON')
  }

  let accion: Accion
  try {
    accion = unaDe(cuerpo.accion, ACCIONES, 'La acción')
  } catch (e) {
    return error(e instanceof Error ? e.message : 'Acción inválida')
  }

  const datos = (cuerpo.datos ?? {}) as Record<string, unknown>

  try {
    switch (accion) {
      case 'colas':
        return await colas(admin)

      case 'aprobar_punto': {
        const id = uuid(datos.point_id, 'El punto')
        await actualizarPunto(admin, id, {
          status: 'approved',
          verificado: booleano(datos.verificado),
          nota_moderacion: texto(datos.nota, { max: 400, campo: 'la nota' }),
        })
        return json({ ok: true, mensaje: 'Punto publicado' })
      }

      case 'rechazar_punto': {
        const id = uuid(datos.point_id, 'El punto')
        await actualizarPunto(admin, id, {
          status: 'rejected',
          nota_moderacion: texto(datos.nota, { max: 400, campo: 'la nota' }),
        })
        return json({ ok: true, mensaje: 'Punto rechazado' })
      }

      case 'inactivar_punto': {
        const id = uuid(datos.point_id, 'El punto')
        // Inactivar y no borrar: un punto que cerró es información útil, y
        // borrarlo garantiza que alguien lo vuelva a agregar mañana.
        await actualizarPunto(admin, id, {
          status: 'inactive',
          nota_moderacion: texto(datos.nota, { max: 400, campo: 'la nota' }),
        })
        return json({ ok: true, mensaje: 'Punto marcado como cerrado' })
      }

      case 'reactivar_punto': {
        const id = uuid(datos.point_id, 'El punto')
        await actualizarPunto(admin, id, { status: 'approved' })
        return json({ ok: true, mensaje: 'Punto reactivado' })
      }

      case 'actualizar_punto':
        return await editarPunto(admin, datos)

      case 'aplicar_edicion': {
        const id = uuid(datos.solicitud_id, 'La solicitud')
        const { error: err } = await admin.rpc('aplicar_solicitud_edicion', {
          p_solicitud_id: id,
        })
        if (err) throw new Error(err.message)
        return json({ ok: true, mensaje: 'Cambio aplicado' })
      }

      case 'rechazar_solicitud': {
        const id = uuid(datos.solicitud_id, 'La solicitud')
        const { error: err } = await admin
          .from('point_change_requests')
          .update({
            status: 'rechazada',
            resolved_at: new Date().toISOString(),
            nota_moderacion: texto(datos.nota, { max: 400, campo: 'la nota' }),
          })
          .eq('id', id)
          .eq('status', 'pending')
        if (err) throw new Error(err.message)
        return json({ ok: true, mensaje: 'Solicitud descartada' })
      }

      case 'resolver_reporte': {
        const id = uuid(datos.reporte_id, 'El reporte')
        const aplicado = booleano(datos.aplicado)
        const { data: reporte, error: errLectura } = await admin
          .from('point_reports')
          .select('point_id')
          .eq('id', id)
          .eq('status', 'pending')
          .maybeSingle()
        if (errLectura) throw new Error(errLectura.message)
        if (!reporte) throw new ErrorValidacion('El reporte no existe o ya fue resuelto')

        if (aplicado && booleano(datos.inactivar_punto)) {
          await actualizarPunto(admin, reporte.point_id as string, { status: 'inactive' })
        }

        const { error: err } = await admin
          .from('point_reports')
          .update({
            status: aplicado ? 'aplicada' : 'rechazada',
            resolved_at: new Date().toISOString(),
            nota_moderacion: texto(datos.nota, { max: 400, campo: 'la nota' }),
          })
          .eq('id', id)
        if (err) throw new Error(err.message)
        return json({ ok: true, mensaje: 'Reporte resuelto' })
      }

      case 'guardar_necesidad':
        return await guardarNecesidad(admin, datos)

      case 'eliminar_necesidad': {
        const id = uuid(datos.need_id, 'La necesidad')
        const { error: err } = await admin.from('point_needs').delete().eq('id', id)
        if (err) throw new Error(err.message)
        return json({ ok: true, mensaje: 'Necesidad eliminada' })
      }
    }
  } catch (e) {
    if (e instanceof ErrorValidacion) return error(e.message, 422)
    console.error(`Error en la acción ${accion}:`, e)
    return error('No se pudo completar la acción', 500)
  }
})

// ---------------------------------------------------------------------------
// Colas de trabajo
// Todo lo que un moderador necesita ver, en una sola petición.
// ---------------------------------------------------------------------------
async function colas(admin: ReturnType<typeof clienteAdmin>): Promise<Response> {
  const seleccionPunto = `
    id, slug, nombre, department_code, ciudad, direccion, descripcion, organizacion,
    horario, telefono, whatsapp, email, lat, lng, acepta_transporte_grande, status,
    verificado, fuente_url, submitter_nombre, submitter_contacto, created_at, updated_at,
    departments ( nombre ),
    point_needs ( id, category_slug, cantidad_solicitada, cantidad_cubierta, unidad, urgencia, notas, activa )
  `

  const [pendientes, solicitudes, reportes, ofertas, publicados, categorias, departamentos] =
    await Promise.all([
      admin
        .from('collection_points')
        .select(seleccionPunto)
        .eq('status', 'pending')
        .order('created_at', { ascending: true }),
      admin
        .from('point_change_requests')
        .select(
          'id, point_id, tipo, payload, motivo, submitter_nombre, submitter_contacto, created_at, collection_points ( slug, nombre, ciudad )',
        )
        .eq('status', 'pending')
        .order('created_at', { ascending: true }),
      admin
        .from('point_reports')
        .select(
          'id, point_id, motivo, comentario, submitter_contacto, created_at, collection_points ( slug, nombre, ciudad )',
        )
        .eq('status', 'pending')
        .order('created_at', { ascending: true }),
      admin
        .from('donation_offers')
        .select(
          'id, category_slug, cantidad, unidad, ciudad, department_code, transporte_disponible, nombre_contacto, telefono, mensaje, status, created_at, collection_points ( slug, nombre )',
        )
        .order('created_at', { ascending: false })
        .limit(60),
      // Los publicados se traen para poder corregir cantidades y urgencias, que
      // es la tarea diaria real de la moderación.
      admin
        .from('collection_points')
        .select(seleccionPunto)
        .in('status', ['approved', 'inactive'])
        .order('updated_at', { ascending: false }),
      admin.from('need_categories').select('*').order('orden'),
      admin.from('departments').select('*').order('nombre'),
    ])

  const fallo = [pendientes, solicitudes, reportes, ofertas, publicados].find((r) => r.error)
  if (fallo?.error) throw new Error(fallo.error.message)

  return json({
    ok: true,
    pendientes: pendientes.data ?? [],
    solicitudes: solicitudes.data ?? [],
    reportes: reportes.data ?? [],
    ofertas: ofertas.data ?? [],
    publicados: publicados.data ?? [],
    categorias: categorias.data ?? [],
    departamentos: departamentos.data ?? [],
  })
}

async function actualizarPunto(
  admin: ReturnType<typeof clienteAdmin>,
  id: string,
  campos: Record<string, unknown>,
): Promise<void> {
  const limpios = Object.fromEntries(
    Object.entries(campos).filter(([, v]) => v !== null && v !== undefined),
  )
  const { error: err } = await admin.from('collection_points').update(limpios).eq('id', id)
  if (err) throw new Error(err.message)
}

// ---------------------------------------------------------------------------
// Edición directa por parte de un moderador.
// A diferencia de las solicitudes de la comunidad, aquí sí se puede tocar
// `verificado` y las coordenadas. El slug nunca cambia: es una URL que ya se
// compartió por WhatsApp y romperla es romper la cadena de ayuda.
// ---------------------------------------------------------------------------
async function editarPunto(
  admin: ReturnType<typeof clienteAdmin>,
  datos: Record<string, unknown>,
): Promise<Response> {
  const id = uuid(datos.point_id, 'El punto')
  const campos: Record<string, unknown> = {}

  const asignar = (clave: string, valor: unknown) => {
    if (valor !== undefined) campos[clave] = valor
  }

  if ('nombre' in datos) asignar('nombre', texto(datos.nombre, { min: 4, max: 160, campo: 'el nombre' }))
  if ('ciudad' in datos) asignar('ciudad', texto(datos.ciudad, { min: 2, max: 90, campo: 'la ciudad' }))
  if ('direccion' in datos) asignar('direccion', texto(datos.direccion, { max: 200, campo: 'la dirección' }))
  if ('descripcion' in datos) {
    asignar('descripcion', texto(datos.descripcion, { max: 800, campo: 'la descripción', multilinea: true }))
  }
  if ('organizacion' in datos) asignar('organizacion', texto(datos.organizacion, { max: 160, campo: 'la organización' }))
  if ('horario' in datos) asignar('horario', texto(datos.horario, { max: 200, campo: 'el horario' }))
  if ('telefono' in datos) asignar('telefono', telefono(datos.telefono))
  if ('whatsapp' in datos) asignar('whatsapp', telefono(datos.whatsapp, 'WhatsApp'))
  if ('email' in datos) asignar('email', correo(datos.email))
  if ('fuente_url' in datos) asignar('fuente_url', texto(datos.fuente_url, { max: 400, campo: 'la fuente' }))
  if ('lat' in datos) asignar('lat', numero(datos.lat, { min: -5, max: 14, campo: 'la latitud' }))
  if ('lng' in datos) asignar('lng', numero(datos.lng, { min: -82, max: -66, campo: 'la longitud' }))
  // Si un moderador escribe coordenadas a mano, es porque las verificó: dejan de
  // ser el centro de la ciudad y el mapa puede mostrarlas como exactas.
  if ('lat' in datos && 'lng' in datos && campos.lat !== null && campos.lng !== null) {
    asignar('precision_ubicacion', 'exacta')
  }
  if ('acepta_transporte_grande' in datos) {
    asignar('acepta_transporte_grande', booleano(datos.acepta_transporte_grande))
  }
  if ('verificado' in datos) asignar('verificado', booleano(datos.verificado))
  if ('department_code' in datos) {
    const dep = texto(datos.department_code, { max: 40, campo: 'el departamento' })
    if (dep) {
      const { data } = await admin.from('departments').select('code').eq('code', dep).maybeSingle()
      if (!data) throw new ErrorValidacion('El departamento no existe')
      asignar('department_code', dep)
    }
  }

  if (Object.keys(campos).length === 0) throw new ErrorValidacion('No hay cambios que guardar')

  const { error: err } = await admin.from('collection_points').update(campos).eq('id', id)
  if (err) throw new Error(err.message)

  return json({ ok: true, mensaje: 'Punto actualizado' })
}

// ---------------------------------------------------------------------------
// Crear o actualizar una necesidad.
//
// Esta es la acción más usada del panel: es donde entran las cantidades reales
// ("faltan 80 cajas") que el artículo de prensa no publica y que hacen que el
// emparejamiento sirva de algo.
// ---------------------------------------------------------------------------
async function guardarNecesidad(
  admin: ReturnType<typeof clienteAdmin>,
  datos: Record<string, unknown>,
): Promise<Response> {
  const cantidadSolicitada = numero(datos.cantidad_solicitada, {
    min: 0.01,
    max: 10_000_000,
    campo: 'la cantidad solicitada',
  })
  const cantidadCubierta =
    numero(datos.cantidad_cubierta, { min: 0, max: 10_000_000, campo: 'la cantidad cubierta' }) ?? 0

  if (cantidadSolicitada !== null && cantidadCubierta > cantidadSolicitada) {
    throw new ErrorValidacion('Lo cubierto no puede superar lo solicitado')
  }

  const comun = {
    cantidad_solicitada: cantidadSolicitada,
    cantidad_cubierta: cantidadCubierta,
    urgencia: datos.urgencia ? unaDe(datos.urgencia, URGENCIAS, 'La urgencia') : undefined,
    unidad: texto(datos.unidad, { max: 30, campo: 'la unidad' }) ?? undefined,
    notas: texto(datos.notas, { max: 300, campo: 'las notas' }),
    activa: 'activa' in datos ? booleano(datos.activa) : undefined,
  }

  const limpios = Object.fromEntries(Object.entries(comun).filter(([, v]) => v !== undefined))

  if (datos.need_id) {
    const id = uuid(datos.need_id, 'La necesidad')
    const { error: err } = await admin.from('point_needs').update(limpios).eq('id', id)
    if (err) throw new Error(err.message)
    return json({ ok: true, mensaje: 'Necesidad actualizada' })
  }

  const pointId = uuid(datos.point_id, 'El punto')
  const categoria = texto(datos.categoria, { requerido: true, max: 40, campo: 'la categoría' })!

  const { data: cat } = await admin
    .from('need_categories')
    .select('slug, unidad_sugerida')
    .eq('slug', categoria)
    .maybeSingle()
  if (!cat) throw new ErrorValidacion('Esa categoría no existe')

  const { error: err } = await admin.from('point_needs').upsert(
    {
      point_id: pointId,
      category_slug: categoria,
      unidad: (limpios.unidad as string) ?? cat.unidad_sugerida,
      ...limpios,
    },
    { onConflict: 'point_id,category_slug' },
  )
  if (err) throw new Error(err.message)

  return json({ ok: true, mensaje: 'Necesidad agregada' })
}
