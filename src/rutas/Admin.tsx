import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { Check, Lock, LogOut, RefreshCw, Trash2, X } from 'lucide-react'
import {
  Aviso,
  Boton,
  Campo,
  CampoSelect,
  EtiquetaUrgencia,
  Eyebrow,
  Insignia,
  SinResultados,
} from '@/componentes/ui'
import {
  MOTIVO_REPORTE_ETIQUETA,
  URGENCIA_ETIQUETA,
  cifra,
  faltanteTexto,
  haceCuanto,
} from '@/lib/formato'
import { useEntrada } from '@/lib/movimiento'
import { cargarColas, moderar } from '@/lib/api'
import type { Colas, PuntoModeracion, Urgencia } from '@/lib/tipos'

// ============================================================================
// Panel de moderación.
//
// Autorización sin cuentas: una clave que solo existe como secreto de la Edge
// Function `moderate`. Se pide aquí, se guarda en sessionStorage (que muere al
// cerrar el navegador, a diferencia de localStorage) y viaja en una cabecera.
//
// El frontend no valida nada: si la clave está mal, la función responde 401 y
// no devuelve ni un dato. Esconder botones en el cliente no es seguridad; la
// seguridad está del otro lado.
// ============================================================================

const LLAVE_SESION = 'clave-moderador'
const URGENCIAS: Urgencia[] = ['baja', 'media', 'alta', 'critica']

type Pestana = 'pendientes' | 'solicitudes' | 'reportes' | 'publicados' | 'ofertas'

export default function Admin() {
  const [clave, setClave] = useState<string | null>(() => sessionStorage.getItem(LLAVE_SESION))
  const [colas, setColas] = useState<Colas | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [pestana, setPestana] = useState<Pestana>('pendientes')

  // El panel nunca debe aparecer en buscadores.
  useEffect(() => {
    document.title = 'Moderación — Ayuda Terremoto Colombia'
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    return () => meta.remove()
  }, [])

  const refrescar = useCallback(
    async (claveUsada: string) => {
      setCargando(true)
      setError(null)
      try {
        const datos = await cargarColas(claveUsada)
        setColas(datos)
        sessionStorage.setItem(LLAVE_SESION, claveUsada)
        setClave(claveUsada)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No pudimos cargar las colas')
        // Clave rechazada: se borra para no reintentar en bucle con una mala.
        sessionStorage.removeItem(LLAVE_SESION)
        setClave(null)
        setColas(null)
      } finally {
        setCargando(false)
      }
    },
    [],
  )

  useEffect(() => {
    if (clave && !colas) void refrescar(clave)
    // Solo al montar, cuando ya hay una clave guardada de antes.
  }, [])

  const ejecutar = async (accion: Parameters<typeof moderar>[0], datos: Record<string, unknown>) => {
    if (!clave) return
    setError(null)
    setAviso(null)
    try {
      const r = await moderar(accion, datos, clave)
      setAviso(r.mensaje)
      await refrescar(clave)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo completar la acción')
    }
  }

  const salir = () => {
    sessionStorage.removeItem(LLAVE_SESION)
    setClave(null)
    setColas(null)
  }

  if (!clave || !colas) {
    return <Puerta cargando={cargando} error={error} onEnviar={refrescar} />
  }

  const pestanas: { id: Pestana; texto: string; conteo: number }[] = [
    { id: 'pendientes', texto: 'Puntos por revisar', conteo: colas.pendientes.length },
    { id: 'solicitudes', texto: 'Correcciones', conteo: colas.solicitudes.length },
    { id: 'reportes', texto: 'Reportes', conteo: colas.reportes.length },
    { id: 'publicados', texto: 'Publicados', conteo: colas.publicados.length },
    { id: 'ofertas', texto: 'Ofertas recibidas', conteo: colas.ofertas.length },
  ]

  return (
    <div className="contenedor py-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Eyebrow>Moderación</Eyebrow>
          <h1 className="display-ancho mt-2 text-[1.75rem] leading-tight">Cola de trabajo</h1>
        </div>
        <div className="flex gap-2.5">
          <Boton variante="secundario" tamano="pequeno" onClick={() => void refrescar(clave)} cargando={cargando}>
            <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />
            Actualizar
          </Boton>
          <Boton variante="fantasma" tamano="pequeno" onClick={salir}>
            <LogOut aria-hidden="true" className="h-3.5 w-3.5" />
            Cerrar
          </Boton>
        </div>
      </header>

      {aviso && (
        <div className="mt-5">
          <Aviso tono="exito" onCerrar={() => setAviso(null)}>
            {aviso}
          </Aviso>
        </div>
      )}
      {error && (
        <div className="mt-5">
          <Aviso tono="error" onCerrar={() => setError(null)}>
            {error}
          </Aviso>
        </div>
      )}

      <nav aria-label="Secciones" className="border-line mt-6 flex flex-wrap gap-x-5 gap-y-2 border-b pb-px">
        {pestanas.map((p) => (
          <button
            key={p.id}
            onClick={() => setPestana(p.id)}
            aria-current={pestana === p.id ? 'page' : undefined}
            className={`-mb-px flex items-center gap-1.5 border-b-2 pb-2.5 font-mono text-[0.75rem] tracking-[0.1em] uppercase transition-colors ${
              pestana === p.id ? 'border-ink text-ink' : 'text-muted hover:text-ink border-transparent'
            }`}
          >
            {p.texto}
            <span
              data-cifra
              className={`rounded-full px-1.5 text-[0.6875rem] ${
                p.conteo > 0 && p.id !== 'publicados' && p.id !== 'ofertas'
                  ? 'bg-signal text-ink'
                  : 'bg-line text-muted'
              }`}
            >
              {cifra(p.conteo)}
            </span>
          </button>
        ))}
      </nav>

      <div className="mt-6">
        {pestana === 'pendientes' && (
          <ListaPendientes puntos={colas.pendientes} onAccion={ejecutar} />
        )}

        {pestana === 'solicitudes' && (
          <div className="flex flex-col gap-4">
            {colas.solicitudes.length === 0 && (
              <SinResultados titulo="No hay correcciones pendientes" />
            )}
            {colas.solicitudes.map((s) => (
              <article key={s.id} className="panel p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Insignia tono={s.tipo === 'eliminacion' ? 'aviso' : 'neutro'}>
                    {s.tipo === 'eliminacion' ? 'Pide retiro' : 'Corrección'}
                  </Insignia>
                  <span className="eyebrow">{haceCuanto(s.created_at)}</span>
                </div>

                <h3 className="display-ancho mt-2 text-[1.0625rem] font-bold">
                  {s.collection_points ? (
                    <Link to={`/puntos/${s.collection_points.slug}`} className="hover:subrayado-signal">
                      {s.collection_points.nombre}
                    </Link>
                  ) : (
                    'Punto eliminado'
                  )}
                </h3>

                <p className="mt-2 text-[0.9375rem] leading-relaxed">{s.motivo}</p>

                {s.tipo === 'edicion' && Object.keys(s.payload).length > 0 && (
                  <dl className="divide-line bg-mineral mt-3 divide-y border-l-2 border-l-signal px-3 py-2">
                    {Object.entries(s.payload).map(([campo, valor]) => (
                      <div key={campo} className="flex flex-wrap gap-x-3 py-1.5 text-[0.875rem]">
                        <dt className="eyebrow min-w-32">{campo}</dt>
                        <dd className="font-mono text-[0.8125rem]">{String(valor)}</dd>
                      </div>
                    ))}
                  </dl>
                )}

                {s.submitter_contacto && (
                  <p className="text-muted mt-2 font-mono text-[0.75rem]">
                    Contacto: {s.submitter_contacto}
                    {s.submitter_nombre ? ` · ${s.submitter_nombre}` : ''}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap gap-2.5">
                  <Boton
                    tamano="pequeno"
                    onClick={() => void onAccionConfirm(s.tipo, () => onAccion(s.id))}
                  >
                    <Check aria-hidden="true" className="h-3.5 w-3.5" />
                    {s.tipo === 'eliminacion' ? 'Retirar el punto' : 'Aplicar el cambio'}
                  </Boton>
                  <Boton
                    variante="secundario"
                    tamano="pequeno"
                    onClick={() => void ejecutar('rechazar_solicitud', { solicitud_id: s.id })}
                  >
                    <X aria-hidden="true" className="h-3.5 w-3.5" />
                    Descartar
                  </Boton>
                </div>
              </article>
            ))}
          </div>
        )}

        {pestana === 'reportes' && (
          <div className="flex flex-col gap-4">
            {colas.reportes.length === 0 && <SinResultados titulo="No hay reportes pendientes" />}
            {colas.reportes.map((r) => (
              <article key={r.id} className="panel p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Insignia tono="aviso">
                    {MOTIVO_REPORTE_ETIQUETA[r.motivo] ?? r.motivo}
                  </Insignia>
                  <span className="eyebrow">{haceCuanto(r.created_at)}</span>
                </div>

                <h3 className="display-ancho mt-2 text-[1.0625rem] font-bold">
                  {r.collection_points ? (
                    <Link to={`/puntos/${r.collection_points.slug}`} className="hover:subrayado-signal">
                      {r.collection_points.nombre} · {r.collection_points.ciudad}
                    </Link>
                  ) : (
                    'Punto eliminado'
                  )}
                </h3>

                {r.comentario && (
                  <p className="mt-2 text-[0.9375rem] leading-relaxed">{r.comentario}</p>
                )}

                <div className="mt-4 flex flex-wrap gap-2.5">
                  <Boton
                    tamano="pequeno"
                    onClick={() =>
                      void ejecutar('resolver_reporte', {
                        reporte_id: r.id,
                        aplicado: true,
                        inactivar_punto: r.motivo === 'cerrado',
                      })
                    }
                  >
                    <Check aria-hidden="true" className="h-3.5 w-3.5" />
                    {r.motivo === 'cerrado' ? 'Confirmar y cerrar el punto' : 'Marcar como atendido'}
                  </Boton>
                  <Boton
                    variante="secundario"
                    tamano="pequeno"
                    onClick={() => void ejecutar('resolver_reporte', { reporte_id: r.id, aplicado: false })}
                  >
                    <X aria-hidden="true" className="h-3.5 w-3.5" />
                    Descartar
                  </Boton>
                </div>
              </article>
            ))}
          </div>
        )}

        {pestana === 'publicados' && (
          <EditorPublicados colas={colas} onAccion={ejecutar} />
        )}

        {pestana === 'ofertas' && (
          <div className="panel overflow-x-auto">
            {colas.ofertas.length === 0 ? (
              <div className="p-6">
                <SinResultados titulo="Todavía nadie ha ofrecido una donación" />
              </div>
            ) : (
              <table className="w-full text-left text-[0.875rem]">
                <thead className="border-line border-b">
                  <tr>
                    {['Cuándo', 'Qué', 'Cantidad', 'Desde', 'Transporte', 'Punto', 'Contacto'].map(
                      (h) => (
                        <th key={h} className="eyebrow px-3 py-2.5 whitespace-nowrap">
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody className="divide-line divide-y">
                  {colas.ofertas.map((o) => (
                    <tr key={o.id}>
                      <td className="text-muted px-3 py-2.5 whitespace-nowrap font-mono text-[0.75rem]">
                        {haceCuanto(o.created_at)}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{o.category_slug}</td>
                      <td data-cifra className="px-3 py-2.5 font-mono whitespace-nowrap">
                        {cifra(o.cantidad)} {o.unidad}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{o.ciudad ?? '—'}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {o.transporte_disponible ? 'Sí' : 'No'}
                      </td>
                      <td className="px-3 py-2.5">
                        {o.collection_points ? (
                          <Link
                            to={`/puntos/${o.collection_points.slug}`}
                            className="hover:subrayado-signal"
                          >
                            {o.collection_points.nombre}
                          </Link>
                        ) : (
                          <span className="text-muted">sin asignar</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[0.75rem] whitespace-nowrap">
                        {o.telefono ?? o.nombre_contacto ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  )

  // Confirmación para las acciones que cambian lo que ve el público.
  function onAccionConfirm(tipo: 'edicion' | 'eliminacion', accion: () => Promise<void>) {
    const texto =
      tipo === 'eliminacion'
        ? '¿Retirar este punto de la lista pública? Se marcará como cerrado, no se borra.'
        : '¿Aplicar este cambio al punto publicado?'
    if (window.confirm(texto)) return accion()
    return Promise.resolve()
  }

  function onAccion(solicitudId: string) {
    return ejecutar('aplicar_edicion', { solicitud_id: solicitudId })
  }
}

// ---------------------------------------------------------------------------
// Puerta de acceso.
// ---------------------------------------------------------------------------
function Puerta({
  cargando,
  error,
  onEnviar,
}: {
  cargando: boolean
  error: string | null
  onEnviar: (clave: string) => Promise<void>
}) {
  const entrada = useEntrada()
  const [valor, setValor] = useState('')

  const enviar = (e: FormEvent) => {
    e.preventDefault()
    if (valor.trim()) void onEnviar(valor.trim())
  }

  return (
    <div className="contenedor max-w-md py-20">
      <motion.form
        initial="oculto"
        animate="visible"
        variants={entrada}
        onSubmit={enviar}
        className="panel p-6"
      >
        <Lock aria-hidden="true" className="text-muted h-6 w-6" />
        <h1 className="display-ancho mt-4 text-[1.5rem] leading-tight">Moderación</h1>
        <p className="text-muted mt-2 text-[0.9375rem] leading-relaxed">
          Esta sección requiere la clave de moderador. Se valida en el servidor y solo se guarda
          hasta que cierres el navegador.
        </p>

        <div className="mt-5">
          <Campo
            id="clave"
            etiqueta="Clave de moderador"
            requerido
            type="password"
            autoComplete="off"
            autoFocus
            value={valor}
            onChange={(e) => setValor(e.target.value)}
          />
        </div>

        {error && (
          <div className="mt-4">
            <Aviso tono="error">{error}</Aviso>
          </div>
        )}

        <div className="mt-5">
          <Boton type="submit" cargando={cargando} className="w-full">
            Entrar
          </Boton>
        </div>
      </motion.form>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Cola de puntos por revisar.
// ---------------------------------------------------------------------------
function ListaPendientes({
  puntos,
  onAccion,
}: {
  puntos: PuntoModeracion[]
  onAccion: (accion: Parameters<typeof moderar>[0], datos: Record<string, unknown>) => Promise<void>
}) {
  if (puntos.length === 0) {
    return (
      <SinResultados titulo="No hay puntos por revisar">
        <p>Cuando alguien agregue un punto, aparecerá aquí antes de publicarse.</p>
      </SinResultados>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {puntos.map((p) => (
        <article key={p.id} className="panel p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Insignia tono="aviso">Pendiente</Insignia>
            <span className="eyebrow">Enviado {haceCuanto(p.created_at)}</span>
          </div>

          <h3 className="display-ancho mt-2 text-[1.1875rem] leading-tight font-bold">{p.nombre}</h3>
          <p className="text-muted mt-1 text-[0.9375rem]">
            {p.ciudad}
            {p.departments?.nombre ? `, ${p.departments.nombre}` : ''}
            {p.direccion ? ` · ${p.direccion}` : ' · sin dirección'}
          </p>
          {p.organizacion && <p className="text-muted text-[0.875rem]">{p.organizacion}</p>}
          {p.descripcion && <p className="mt-2 text-[0.9375rem] leading-relaxed">{p.descripcion}</p>}

          <dl className="mt-3 grid gap-x-6 gap-y-1 font-mono text-[0.8125rem] sm:grid-cols-2">
            {[
              ['Teléfono', p.telefono],
              ['WhatsApp', p.whatsapp],
              ['Correo', p.email],
              ['Horario', p.horario],
              ['Recibe camión', p.acepta_transporte_grande ? 'Sí' : 'No'],
              ['Aportado por', p.submitter_nombre ?? '—'],
              ['Contacto de quien aporta', p.submitter_contacto ?? '—'],
            ]
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={String(k)} className="flex gap-2">
                  <dt className="text-muted">{k}:</dt>
                  <dd>{v}</dd>
                </div>
              ))}
          </dl>

          <ul className="border-line mt-3 flex flex-wrap gap-x-4 gap-y-1.5 border-t pt-3 text-[0.875rem]">
            {p.point_needs.map((n) => (
              <li key={n.id} className="flex items-center gap-2">
                <span>{n.category_slug}</span>
                <span data-cifra className="text-muted font-mono text-[0.75rem]">
                  {faltanteTexto(n.cantidad_solicitada, n.cantidad_cubierta, n.unidad)}
                </span>
                <EtiquetaUrgencia urgencia={n.urgencia} />
              </li>
            ))}
          </ul>

          <div className="mt-4 flex flex-wrap gap-2.5">
            <Boton
              tamano="pequeno"
              onClick={() => void onAccion('aprobar_punto', { point_id: p.id, verificado: false })}
            >
              <Check aria-hidden="true" className="h-3.5 w-3.5" />
              Publicar
            </Boton>
            <Boton
              variante="secundario"
              tamano="pequeno"
              onClick={() => void onAccion('aprobar_punto', { point_id: p.id, verificado: true })}
            >
              Publicar como verificado
            </Boton>
            <Boton
              variante="peligro"
              tamano="pequeno"
              onClick={() => {
                if (window.confirm('¿Rechazar este punto? No se publicará.')) {
                  void onAccion('rechazar_punto', { point_id: p.id })
                }
              }}
            >
              <X aria-hidden="true" className="h-3.5 w-3.5" />
              Rechazar
            </Boton>
          </div>
        </article>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Editor de puntos publicados.
//
// Es la pantalla que más se usa día a día: aquí entran las cantidades reales
// ("faltan 80 cajas") que las fuentes de prensa no publican y que hacen que el
// emparejamiento sirva de algo.
// ---------------------------------------------------------------------------
function EditorPublicados({
  colas,
  onAccion,
}: {
  colas: Colas
  onAccion: (accion: Parameters<typeof moderar>[0], datos: Record<string, unknown>) => Promise<void>
}) {
  const [filtro, setFiltro] = useState('')
  const [abierto, setAbierto] = useState<string | null>(null)

  const visibles = useMemo(() => {
    const t = filtro.trim().toLowerCase()
    if (!t) return colas.publicados
    return colas.publicados.filter((p) =>
      `${p.nombre} ${p.ciudad}`.toLowerCase().includes(t),
    )
  }, [colas.publicados, filtro])

  return (
    <div>
      <div className="max-w-sm">
        <Campo
          id="filtro-publicados"
          etiqueta="Buscar un punto"
          type="search"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          placeholder="Nombre o ciudad"
        />
      </div>

      <div className="mt-5 flex flex-col gap-3">
        {visibles.map((p) => (
          <article key={p.id} className="panel">
            <button
              onClick={() => setAbierto(abierto === p.id ? null : p.id)}
              aria-expanded={abierto === p.id}
              className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-left"
            >
              <span className="display-estrecho font-bold uppercase">{p.nombre}</span>
              <span className="text-muted text-[0.875rem]">{p.ciudad}</span>
              {p.status === 'inactive' && <Insignia tono="aviso">Cerrado</Insignia>}
              {p.verificado && <Insignia tono="verificado">Verificado</Insignia>}
              <span className="eyebrow ml-auto">{haceCuanto(p.updated_at)}</span>
            </button>

            {abierto === p.id && (
              <div className="border-line border-t p-4">
                <Eyebrow>Necesidades</Eyebrow>
                <div className="mt-3 flex flex-col gap-3">
                  {p.point_needs.map((n) => (
                    <FilaNecesidadEditor
                      key={n.id}
                      necesidad={n}
                      onGuardar={(datos) => onAccion('guardar_necesidad', { need_id: n.id, ...datos })}
                      onEliminar={() => {
                        if (window.confirm('¿Eliminar esta necesidad del punto?')) {
                          void onAccion('eliminar_necesidad', { need_id: n.id })
                        }
                      }}
                    />
                  ))}
                </div>

                <div className="border-line mt-4 border-t pt-4">
                  <AgregarNecesidad
                    categorias={colas.categorias.map((c) => ({ slug: c.slug, nombre: c.nombre, emoji: c.emoji }))}
                    yaUsadas={p.point_needs.map((n) => n.category_slug)}
                    onAgregar={(datos) => onAccion('guardar_necesidad', { point_id: p.id, ...datos })}
                  />
                </div>

                <div className="border-line mt-4 flex flex-wrap gap-2.5 border-t pt-4">
                  <Link to={`/puntos/${p.slug}`}>
                    <Boton variante="secundario" tamano="pequeno">
                      Ver ficha pública
                    </Boton>
                  </Link>
                  {!p.verificado && (
                    <Boton
                      variante="secundario"
                      tamano="pequeno"
                      onClick={() => void onAccion('actualizar_punto', { point_id: p.id, verificado: true })}
                    >
                      Marcar como verificado
                    </Boton>
                  )}
                  {p.status === 'approved' ? (
                    <Boton
                      variante="peligro"
                      tamano="pequeno"
                      onClick={() => {
                        if (window.confirm('¿Marcar el punto como cerrado? Deja de aparecer al público.')) {
                          void onAccion('inactivar_punto', { point_id: p.id })
                        }
                      }}
                    >
                      Marcar como cerrado
                    </Boton>
                  ) : (
                    <Boton
                      tamano="pequeno"
                      onClick={() => void onAccion('reactivar_punto', { point_id: p.id })}
                    >
                      Reactivar
                    </Boton>
                  )}
                </div>
              </div>
            )}
          </article>
        ))}

        {visibles.length === 0 && <SinResultados titulo="Ningún punto coincide" />}
      </div>
    </div>
  )
}

function FilaNecesidadEditor({
  necesidad,
  onGuardar,
  onEliminar,
}: {
  necesidad: Colas['publicados'][number]['point_needs'][number]
  onGuardar: (datos: Record<string, unknown>) => Promise<void>
  onEliminar: () => void
}) {
  const [solicitada, setSolicitada] = useState(necesidad.cantidad_solicitada?.toString() ?? '')
  const [cubierta, setCubierta] = useState(necesidad.cantidad_cubierta.toString())
  const [unidad, setUnidad] = useState(necesidad.unidad)
  const [urgencia, setUrgencia] = useState<Urgencia>(necesidad.urgencia)
  const [guardando, setGuardando] = useState(false)

  const guardar = async () => {
    setGuardando(true)
    try {
      await onGuardar({
        cantidad_solicitada: solicitada === '' ? null : Number(solicitada),
        cantidad_cubierta: cubierta === '' ? 0 : Number(cubierta),
        unidad,
        urgencia,
      })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="bg-mineral border-line grid items-end gap-3 border p-3 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]">
      <div>
        <span className="eyebrow block">{necesidad.category_slug}</span>
        <span className="text-muted font-mono text-[0.75rem]">
          {faltanteTexto(necesidad.cantidad_solicitada, necesidad.cantidad_cubierta, necesidad.unidad)}
        </span>
      </div>

      <Campo
        id={`sol-${necesidad.id}`}
        etiqueta="Solicitada"
        type="number"
        min={0}
        step="any"
        value={solicitada}
        onChange={(e) => setSolicitada(e.target.value)}
        placeholder="sin cifra"
      />
      <Campo
        id={`cub-${necesidad.id}`}
        etiqueta="Cubierta"
        type="number"
        min={0}
        step="any"
        value={cubierta}
        onChange={(e) => setCubierta(e.target.value)}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo
          id={`uni-${necesidad.id}`}
          etiqueta="Unidad"
          value={unidad}
          onChange={(e) => setUnidad(e.target.value)}
        />
        <CampoSelect
          id={`urg-${necesidad.id}`}
          etiqueta="Urgencia"
          value={urgencia}
          onChange={(e) => setUrgencia(e.target.value as Urgencia)}
        >
          {URGENCIAS.map((u) => (
            <option key={u} value={u}>
              {URGENCIA_ETIQUETA[u]}
            </option>
          ))}
        </CampoSelect>
      </div>

      <div className="flex gap-2">
        <Boton tamano="pequeno" onClick={guardar} cargando={guardando}>
          Guardar
        </Boton>
        <Boton variante="fantasma" tamano="pequeno" onClick={onEliminar} aria-label="Eliminar necesidad">
          <Trash2 aria-hidden="true" className="h-4 w-4" />
        </Boton>
      </div>
    </div>
  )
}

function AgregarNecesidad({
  categorias,
  yaUsadas,
  onAgregar,
}: {
  categorias: { slug: string; nombre: string; emoji: string }[]
  yaUsadas: string[]
  onAgregar: (datos: Record<string, unknown>) => Promise<void>
}) {
  const [categoria, setCategoria] = useState('')
  const [cantidad, setCantidad] = useState('')
  const [urgencia, setUrgencia] = useState<Urgencia>('media')
  const [guardando, setGuardando] = useState(false)

  const disponibles = categorias.filter((c) => !yaUsadas.includes(c.slug))

  if (disponibles.length === 0) {
    return <p className="text-muted text-[0.875rem]">Este punto ya tiene todas las categorías.</p>
  }

  const agregar = async () => {
    if (!categoria) return
    setGuardando(true)
    try {
      await onAgregar({
        categoria,
        cantidad_solicitada: cantidad === '' ? null : Number(cantidad),
        urgencia,
      })
      setCategoria('')
      setCantidad('')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="grid items-end gap-3 sm:grid-cols-[2fr_1fr_1fr_auto]">
      <CampoSelect
        id="nueva-categoria"
        etiqueta="Agregar necesidad"
        value={categoria}
        onChange={(e) => setCategoria(e.target.value)}
      >
        <option value="">Selecciona…</option>
        {disponibles.map((c) => (
          <option key={c.slug} value={c.slug}>
            {c.emoji} {c.nombre}
          </option>
        ))}
      </CampoSelect>
      <Campo
        id="nueva-cantidad"
        etiqueta="Cantidad"
        type="number"
        min={0}
        step="any"
        value={cantidad}
        onChange={(e) => setCantidad(e.target.value)}
        placeholder="sin cifra"
      />
      <CampoSelect
        id="nueva-urgencia"
        etiqueta="Urgencia"
        value={urgencia}
        onChange={(e) => setUrgencia(e.target.value as Urgencia)}
      >
        {URGENCIAS.map((u) => (
          <option key={u} value={u}>
            {URGENCIA_ETIQUETA[u]}
          </option>
        ))}
      </CampoSelect>
      <Boton tamano="pequeno" onClick={agregar} cargando={guardando} disabled={!categoria}>
        Agregar
      </Boton>
    </div>
  )
}
