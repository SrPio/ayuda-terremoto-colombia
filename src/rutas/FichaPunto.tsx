import { Suspense, lazy, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'motion/react'
import {
  ArrowLeft,
  Clock,
  ExternalLink,
  Flag,
  Mail,
  MapPin,
  MessageCircle,
  PencilLine,
  Phone,
  Trash2,
  Truck,
} from 'lucide-react'
import { Manifiesto } from '@/componentes/Manifiesto'
import { Turnstile } from '@/componentes/Turnstile'
import { turnstileActivo } from '@/lib/config'
import {
  Aviso,
  Boton,
  Campo,
  CampoSelect,
  CampoTexto,
  CampoTrampa,
  Esqueleto,
  ErrorCarga,
  Eyebrow,
  Insignia,
  SelloFrescura,
  SinResultados,
} from '@/componentes/ui'
import { MOTIVO_REPORTE_ETIQUETA, URGENCIA_PESO } from '@/lib/formato'
import { useCascada } from '@/lib/movimiento'
import { useCategorias, usePunto } from '@/lib/consultas'
import { camposTrampaIniciales, enviarAporte } from '@/lib/api'
import { enlaceLlamada, enlaceMapa, enlaceWhatsapp, mensajePunto } from '@/lib/whatsapp'
import type { Punto } from '@/lib/tipos'

const Mapa = lazy(() => import('@/componentes/Mapa'))

// ============================================================================
// Ficha de un punto de acopio.
//
// Orden de la página = orden de las decisiones de quien la abre:
//  1. ¿qué necesitan aquí?      → la lista de necesidades, arriba
//  2. ¿dónde queda y cuándo?    → dirección, mapa, horario
//  3. ¿cómo aviso que voy?      → WhatsApp, teléfono, correo
//  4. ¿esto está bien?          → corregir, reportar, pedir retiro
// ============================================================================

type Formulario = 'reporte' | 'edicion' | 'eliminacion' | null

export default function FichaPunto() {
  const { slug } = useParams()
  const { data: punto, isPending, isError, error } = usePunto(slug)
  const { data: categorias } = useCategorias()
  const cascada = useCascada(0.05)
  const [formulario, setFormulario] = useState<Formulario>(null)

  const mapaCategorias = useMemo(
    () => new Map((categorias ?? []).map((c) => [c.slug, c])),
    [categorias],
  )

  useEffect(() => {
    if (punto) document.title = `${punto.nombre}, ${punto.ciudad} — Ayuda Terremoto Colombia`
  }, [punto])

  if (isPending) {
    return (
      <div className="contenedor py-12">
        <Esqueleto filas={4} />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="contenedor py-12">
        <ErrorCarga mensaje={error instanceof Error ? error.message : undefined} />
      </div>
    )
  }

  if (!punto) {
    return (
      <div className="contenedor py-16">
        <SinResultados titulo="Este punto de acopio no está publicado">
          <p>
            Puede que haya cerrado, que la dirección haya cambiado o que el enlace esté mal escrito.
          </p>
          <div className="mt-5">
            <Link to="/puntos">
              <Boton variante="secundario">Ver todos los puntos</Boton>
            </Link>
          </div>
        </SinResultados>
      </div>
    )
  }

  const activas = punto.point_needs
    .filter((n) => n.activa)
    .slice()
    .sort((a, b) => URGENCIA_PESO[b.urgencia] - URGENCIA_PESO[a.urgencia])

  const whatsapp = enlaceWhatsapp(punto.whatsapp ?? punto.telefono, mensajePunto(punto))

  return (
    <div className="contenedor py-8 lg:py-12">
      <Link
        to="/puntos"
        className="text-muted hover:text-ink inline-flex items-center gap-1.5 font-mono text-[0.75rem] tracking-[0.1em] uppercase"
      >
        <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />
        Todos los puntos
      </Link>

      <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_minmax(0,20rem)] lg:gap-14">
        {/* --- Columna principal ------------------------------------------ */}
        <div>
          <header>
            <div className="flex flex-wrap items-center gap-2">
              {punto.verificado ? (
                <Insignia tono="verificado">Verificado</Insignia>
              ) : (
                <Insignia tono="aviso">Aportado por la comunidad</Insignia>
              )}
              {punto.departments?.afectado && <Insignia tono="aviso">Zona afectada</Insignia>}
              {punto.acepta_transporte_grande && (
                <Insignia>
                  <Truck aria-hidden="true" className="h-3 w-3" />
                  Recibe camión
                </Insignia>
              )}
            </div>

            <h1 className="display-ancho mt-3 text-[2rem] leading-[1.05] sm:text-[2.5rem]">
              {punto.nombre}
            </h1>

            {punto.organizacion && (
              <p className="text-muted mt-2 text-[1.0625rem]">{punto.organizacion}</p>
            )}

            <div className="mt-3">
              <SelloFrescura actualizado={punto.updated_at} />
            </div>
          </header>

          {punto.descripcion && (
            <p className="mt-6 max-w-2xl text-[1.0625rem] leading-relaxed">{punto.descripcion}</p>
          )}

          {/* --- Necesidades ---------------------------------------------- */}
          <section className="mt-10" aria-labelledby="titulo-necesidades">
            <h2 id="titulo-necesidades" className="display-ancho text-[1.5rem] leading-tight">
              Qué están recibiendo
            </h2>

            {activas.length === 0 ? (
              <p className="text-muted mt-3 text-[0.9375rem]">
                No hay necesidades registradas para este punto. Llama antes de llevar algo.
              </p>
            ) : (
              <motion.ul
                initial="oculto"
                animate="visible"
                variants={cascada}
                className="divide-line panel mt-4 divide-y"
              >
                {activas.map((n) => {
                  const cat = mapaCategorias.get(n.category_slug)
                  return (
                    <motion.li key={n.id} variants={cascada} className="px-4 py-3.5">
                      <Manifiesto
                        datos={{
                          lugar: cat?.nombre ?? n.category_slug,
                          detalleLugar: n.notas ?? cat?.descripcion,
                          emoji: cat?.emoji ?? '📦',
                          cantidadSolicitada: n.cantidad_solicitada,
                          cantidadCubierta: n.cantidad_cubierta,
                          unidad: n.unidad,
                          urgencia: n.urgencia,
                        }}
                      />
                    </motion.li>
                  )
                })}
              </motion.ul>
            )}

            <p className="text-muted mt-3 text-[0.8125rem] leading-snug">
              Las cantidades las confirma la moderación con el punto. Cuando aparece "cantidad por
              confirmar" es porque el punto recibe ese artículo pero no ha reportado cuánto le falta.
            </p>
          </section>

          {/* --- Mapa ----------------------------------------------------- */}
          {punto.lat !== null && punto.lng !== null && (
            <section className="mt-10" aria-labelledby="titulo-mapa">
              <h2 id="titulo-mapa" className="display-ancho text-[1.5rem] leading-tight">
                Cómo llegar
              </h2>
              <div className="mt-4">
                <Suspense
                  fallback={
                    <div className="panel grid h-[320px] place-items-center">
                      <p className="eyebrow">Cargando mapa</p>
                    </div>
                  }
                >
                  <Mapa puntos={[punto]} altura={320} />
                </Suspense>
              </div>
              <a
                href={enlaceMapa(punto)}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-3 inline-flex items-center gap-1.5 font-mono text-[0.75rem] tracking-[0.1em] uppercase hover:subrayado-signal"
              >
                Abrir en Google Maps
                <ExternalLink aria-hidden="true" className="h-3 w-3" />
              </a>
            </section>
          )}

          {/* --- Corregir / reportar -------------------------------------- */}
          <section className="mt-12" aria-labelledby="titulo-corregir">
            <h2 id="titulo-corregir" className="display-ancho text-[1.5rem] leading-tight">
              ¿Algo de esto está mal?
            </h2>
            <p className="text-muted mt-2 max-w-2xl text-[0.9375rem] leading-relaxed">
              Los reportes de la gente que estuvo ahí son la forma más rápida de mantener esta
              página al día. No necesitas cuenta.
            </p>

            <div className="mt-4 flex flex-wrap gap-2.5">
              <Boton
                variante={formulario === 'reporte' ? 'primario' : 'secundario'}
                onClick={() => setFormulario(formulario === 'reporte' ? null : 'reporte')}
              >
                <Flag aria-hidden="true" className="h-4 w-4" />
                Reportar un problema
              </Boton>
              <Boton
                variante={formulario === 'edicion' ? 'primario' : 'secundario'}
                onClick={() => setFormulario(formulario === 'edicion' ? null : 'edicion')}
              >
                <PencilLine aria-hidden="true" className="h-4 w-4" />
                Proponer una corrección
              </Boton>
              <Boton
                variante={formulario === 'eliminacion' ? 'peligro' : 'secundario'}
                onClick={() => setFormulario(formulario === 'eliminacion' ? null : 'eliminacion')}
              >
                <Trash2 aria-hidden="true" className="h-4 w-4" />
                Pedir que se retire
              </Boton>
            </div>

            {formulario && (
              <div className="mt-5">
                <FormularioAporte
                  tipo={formulario}
                  punto={punto}
                  onListo={() => setFormulario(null)}
                />
              </div>
            )}
          </section>
        </div>

        {/* --- Panel de contacto ------------------------------------------ */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="panel p-4 sm:p-5">
            <Eyebrow>Datos del punto</Eyebrow>

            <dl className="divide-line mt-3 flex flex-col divide-y">
              <div className="flex gap-3 py-3 first:pt-0">
                <MapPin aria-hidden="true" className="text-muted mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <dt className="sr-only">Dirección</dt>
                  <dd>
                    {punto.direccion ? (
                      <a
                        href={enlaceMapa(punto)}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="hover:subrayado-signal text-[0.9375rem]"
                      >
                        {punto.direccion}
                      </a>
                    ) : (
                      <span className="text-muted text-[0.9375rem]">
                        Sin dirección exacta publicada
                      </span>
                    )}
                    <span className="text-muted mt-0.5 block text-[0.875rem]">
                      {punto.ciudad}
                      {punto.departments?.nombre ? `, ${punto.departments.nombre}` : ''}
                    </span>
                    {punto.precision_ubicacion !== 'exacta' && (
                      <span
                        className="mt-1.5 block font-mono text-[0.6875rem] leading-snug tracking-wide uppercase"
                        style={{ color: 'var(--color-alta)' }}
                      >
                        El marcador del mapa está al centro del municipio, no en la puerta.
                        {punto.direccion ? ' Guíate por la dirección.' : ''}
                      </span>
                    )}
                  </dd>
                </div>
              </div>

              {punto.horario && (
                <div className="flex gap-3 py-3">
                  <Clock aria-hidden="true" className="text-muted mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <dt className="sr-only">Horario</dt>
                    <dd className="text-[0.9375rem]">{punto.horario}</dd>
                  </div>
                </div>
              )}

              {punto.telefono && (
                <div className="flex gap-3 py-3">
                  <Phone aria-hidden="true" className="text-muted mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <dt className="sr-only">Teléfono</dt>
                    <dd>
                      <a href={enlaceLlamada(punto.telefono) ?? undefined} className="hover:subrayado-signal font-mono text-[0.9375rem]">
                        {punto.telefono}
                      </a>
                    </dd>
                  </div>
                </div>
              )}

              {punto.email && (
                <div className="flex gap-3 py-3">
                  <Mail aria-hidden="true" className="text-muted mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <dt className="sr-only">Correo</dt>
                    <dd>
                      <a href={`mailto:${punto.email}`} className="hover:subrayado-signal text-[0.9375rem] break-all">
                        {punto.email}
                      </a>
                    </dd>
                  </div>
                </div>
              )}
            </dl>

            <div className="mt-4 flex flex-col gap-2.5">
              {whatsapp && (
                <a href={whatsapp} target="_blank" rel="noreferrer noopener">
                  <Boton tamano="grande" className="w-full">
                    <MessageCircle aria-hidden="true" className="h-4 w-4" />
                    Escribir por WhatsApp
                  </Boton>
                </a>
              )}
              <Link to="/donar">
                <Boton variante="secundario" className="w-full">
                  Ver dónde más hace falta
                </Boton>
              </Link>
            </div>

            {!punto.telefono && !punto.whatsapp && !punto.email && (
              <div className="mt-4">
                <Aviso tono="atencion">
                  Este punto no tiene teléfono registrado. Si lo conoces,{' '}
                  <button
                    onClick={() => setFormulario('edicion')}
                    className="subrayado-signal font-medium"
                  >
                    agrégalo
                  </button>
                  .
                </Aviso>
              </div>
            )}

            {punto.fuente_url && (
              <p className="border-line text-muted mt-4 border-t pt-3 text-[0.8125rem]">
                <a
                  href={punto.fuente_url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="hover:subrayado-signal inline-flex items-center gap-1"
                >
                  Fuente de este dato
                  <ExternalLink aria-hidden="true" className="h-3 w-3" />
                </a>
              </p>
            )}
          </div>

          <div className="mt-4">
            <Aviso tono="atencion">
              Llama antes de salir. Los puntos se saturan y cierran de un día para otro.
            </Aviso>
          </div>
        </aside>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Formulario único para reporte, corrección y solicitud de retiro.
// ---------------------------------------------------------------------------
function FormularioAporte({
  tipo,
  punto,
  onListo,
}: {
  tipo: 'reporte' | 'edicion' | 'eliminacion'
  punto: Punto
  onListo: () => void
}) {
  const [trampas] = useState(camposTrampaIniciales)
  const [honeypot, setHoneypot] = useState('')
  const [token, setToken] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exito, setExito] = useState<string | null>(null)

  const [motivoReporte, setMotivoReporte] = useState('cerrado')
  const [motivo, setMotivo] = useState('')
  const [contacto, setContacto] = useState('')
  const [cambios, setCambios] = useState({
    nombre: '',
    direccion: '',
    horario: '',
    telefono: '',
    whatsapp: '',
    email: '',
  })

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    setEnviando(true)
    setError(null)

    try {
      if (tipo === 'reporte') {
        const r = await enviarAporte(
          'reporte',
          {
            point_id: punto.id,
            motivo: motivoReporte,
            comentario: motivo,
            submitter_contacto: contacto,
          },
          { ...trampas, website: honeypot },
          token ?? undefined,
        )
        setExito(r.mensaje ?? 'Reporte enviado')
      } else if (tipo === 'edicion') {
        const payload = Object.fromEntries(
          Object.entries(cambios).filter(([, v]) => v.trim() !== ''),
        )
        if (Object.keys(payload).length === 0) {
          throw new Error('Escribe al menos un campo con el valor correcto')
        }
        const r = await enviarAporte(
          'edicion',
          { point_id: punto.id, payload, motivo, submitter_contacto: contacto },
          { ...trampas, website: honeypot },
          token ?? undefined,
        )
        setExito(r.mensaje ?? 'Corrección enviada')
      } else {
        const r = await enviarAporte(
          'eliminacion',
          { point_id: punto.id, motivo, submitter_contacto: contacto },
          { ...trampas, website: honeypot },
          token ?? undefined,
        )
        setExito(r.mensaje ?? 'Solicitud enviada')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos enviar el aporte')
    } finally {
      setEnviando(false)
    }
  }

  if (exito) {
    return (
      <div className="panel p-4 sm:p-5">
        <Aviso tono="exito">{exito}</Aviso>
        <div className="mt-4">
          <Boton variante="secundario" onClick={onListo}>
            Cerrar
          </Boton>
        </div>
      </div>
    )
  }

  const titulos = {
    reporte: 'Reportar un problema con este punto',
    edicion: 'Proponer una corrección',
    eliminacion: 'Pedir que este punto se retire',
  }

  return (
    <form onSubmit={enviar} className="panel relative flex flex-col gap-4 p-4 sm:p-5">
      <h3 className="display-ancho text-[1.125rem] font-bold">{titulos[tipo]}</h3>

      {tipo === 'reporte' && (
        <CampoSelect
          id="motivo-reporte"
          etiqueta="Qué pasa"
          requerido
          value={motivoReporte}
          onChange={(e) => setMotivoReporte(e.target.value)}
        >
          {Object.entries(MOTIVO_REPORTE_ETIQUETA).map(([valor, etiqueta]) => (
            <option key={valor} value={valor}>
              {etiqueta}
            </option>
          ))}
        </CampoSelect>
      )}

      {tipo === 'edicion' && (
        <fieldset className="flex flex-col gap-3">
          <legend className="text-muted mb-1 text-[0.875rem]">
            Escribe solo los campos que quieres corregir, con el valor correcto.
          </legend>
          <Campo
            id="c-nombre"
            etiqueta="Nombre del punto"
            value={cambios.nombre}
            onChange={(e) => setCambios((c) => ({ ...c, nombre: e.target.value }))}
            placeholder={punto.nombre}
          />
          <Campo
            id="c-direccion"
            etiqueta="Dirección"
            value={cambios.direccion}
            onChange={(e) => setCambios((c) => ({ ...c, direccion: e.target.value }))}
            placeholder={punto.direccion ?? 'Carrera 52 #30A-97'}
          />
          <Campo
            id="c-horario"
            etiqueta="Horario"
            value={cambios.horario}
            onChange={(e) => setCambios((c) => ({ ...c, horario: e.target.value }))}
            placeholder={punto.horario ?? 'Lunes a sábado, 8 a.m. a 5 p.m.'}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo
              id="c-telefono"
              etiqueta="Teléfono"
              type="tel"
              value={cambios.telefono}
              onChange={(e) => setCambios((c) => ({ ...c, telefono: e.target.value }))}
              placeholder={punto.telefono ?? '604 000 0000'}
            />
            <Campo
              id="c-whatsapp"
              etiqueta="WhatsApp"
              type="tel"
              value={cambios.whatsapp}
              onChange={(e) => setCambios((c) => ({ ...c, whatsapp: e.target.value }))}
              placeholder={punto.whatsapp ?? '300 000 0000'}
            />
          </div>
          <Campo
            id="c-email"
            etiqueta="Correo"
            type="email"
            value={cambios.email}
            onChange={(e) => setCambios((c) => ({ ...c, email: e.target.value }))}
            placeholder={punto.email ?? 'contacto@ejemplo.org'}
          />
        </fieldset>
      )}

      <CampoTexto
        id="motivo"
        etiqueta={tipo === 'eliminacion' ? 'Por qué debería retirarse' : 'Cuéntanos más'}
        requerido={tipo !== 'reporte'}
        ayuda={
          tipo === 'eliminacion'
            ? 'Explica cómo sabes que el punto ya no opera. Si estuviste ahí, dilo: ayuda a decidir rápido.'
            : 'Cualquier detalle que ayude a verificarlo. Si estuviste en el punto, cuéntalo.'
        }
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        minLength={tipo === 'reporte' ? undefined : 10}
        placeholder="Fui el martes a las 3 p.m. y ya no estaban recibiendo…"
      />

      <Campo
        id="contacto"
        etiqueta="Tu contacto"
        ayuda="Solo si quieres que te escribamos para confirmar. No se publica nunca."
        value={contacto}
        onChange={(e) => setContacto(e.target.value)}
        placeholder="Correo o teléfono"
      />

      <CampoTrampa valor={honeypot} onChange={setHoneypot} />
      {turnstileActivo && <Turnstile onToken={setToken} />}

      {error && <Aviso tono="error">{error}</Aviso>}

      <div className="flex flex-wrap gap-2.5">
        <Boton type="submit" cargando={enviando} variante={tipo === 'eliminacion' ? 'peligro' : 'primario'}>
          {tipo === 'reporte'
            ? 'Enviar reporte'
            : tipo === 'edicion'
              ? 'Enviar corrección'
              : 'Enviar solicitud'}
        </Boton>
        <Boton type="button" variante="fantasma" onClick={onListo}>
          Cancelar
        </Boton>
      </div>

      <p className="text-muted text-[0.8125rem] leading-snug">
        Un moderador revisa cada aporte antes de que cambie algo en la página.
      </p>
    </form>
  )
}
