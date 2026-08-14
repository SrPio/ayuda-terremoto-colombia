import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  MapPin,
  MessageCircle,
  Phone,
  RotateCcw,
  Send,
  Truck,
} from 'lucide-react'
import { Manifiesto } from '@/componentes/Manifiesto'
import { QueNoDonar } from '@/componentes/QueNoDonar'
import { Turnstile } from '@/componentes/Turnstile'
import { turnstileActivo } from '@/lib/config'
import {
  Aviso,
  Boton,
  Campo,
  CampoTrampa,
  Esqueleto,
  Eyebrow,
  Insignia,
  SelloFrescura,
  SinResultados,
} from '@/componentes/ui'
import { URGENCIA_COLOR, URGENCIA_PESO, cifra } from '@/lib/formato'
import { usePasos } from '@/lib/movimiento'
import {
  useCategorias,
  useCoincidenciasMultiples,
  useDepartamentos,
  type ItemBusquedaMatch,
} from '@/lib/consultas'
import { camposTrampaIniciales, enviarAporte } from '@/lib/api'
import { enlaceLlamada, enlaceMapa, enlaceWhatsapp, mensajeCoordinacion } from '@/lib/whatsapp'
import type { Categoria, Coincidencia } from '@/lib/tipos'

// ============================================================================
// "¿Dónde llevo las donaciones?" — el asistente.
//
// Cuatro preguntas, una por pantalla, en el orden en que una persona piensa el
// problema: tengo algo → es esta cantidad → estoy aquí → puedo moverlo o no.
// Una sola pregunta a la vez porque quien llega aquí ya tiene las cajas en el
// carro y no quiere llenar un formulario.
//
// "Tengo algo" puede ser más de una cosa: quien lleva el carro cargado suele
// traer agua Y alimentos Y cobijas al tiempo, así que el primer paso permite
// elegir varias categorías, y el segundo pide la cantidad y unidad de CADA
// una por separado (100 cajas de agua no es lo mismo que 20 kits de aseo).
//
// El resultado no es una lista de sitios: es una necesidad concreta con nombre,
// cantidad faltante y un botón que abre WhatsApp con el mensaje escrito — una
// tarjeta por cada combinación de categoría elegida y punto que la necesita.
// ============================================================================

const PASOS = ['¿Qué tienes?', '¿Cuánto?', '¿Dónde estás?', '¿Transporte?'] as const

/** Una categoría elegida, con su propia cantidad y unidad. */
interface ItemDonacion {
  categoria: string
  cantidad: string
  unidad: string
}

interface Estado {
  items: ItemDonacion[]
  departamento: string
  ciudad: string
  transporte: boolean | null
}

const INICIAL: Estado = {
  items: [],
  departamento: '',
  ciudad: '',
  transporte: null,
}

/** "agua", "agua y aseo personal", "agua, aseo personal y cobijas". */
function listarNombres(nombres: string[]): string {
  if (nombres.length === 0) return ''
  if (nombres.length === 1) return nombres[0]
  return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`
}

/**
 * Mismo criterio de orden que ya aplica `match_needs` dentro de cada
 * categoría (urgencia → zona afectada → cercanía). Al combinar los resultados
 * de varias categorías hay que reordenar el conjunto completo para que la
 * lista final no quede agrupada por categoría sino por lo que de verdad urge.
 */
function compararCoincidencias(a: Coincidencia, b: Coincidencia): number {
  const pesoUrgencia = URGENCIA_PESO[b.urgencia] - URGENCIA_PESO[a.urgencia]
  if (pesoUrgencia !== 0) return pesoUrgencia

  const afectada = Number(b.zona_afectada) - Number(a.zona_afectada)
  if (afectada !== 0) return afectada

  const distanciaA = a.distancia_km ?? Infinity
  const distanciaB = b.distancia_km ?? Infinity
  return distanciaA - distanciaB
}

export default function Donar() {
  const [paso, setPaso] = useState(0)
  const [direccion, setDireccion] = useState(1)
  const [estado, setEstado] = useState<Estado>(INICIAL)
  const [buscando, setBuscando] = useState(false)

  const transicionPaso = usePasos(direccion)
  const { data: categorias } = useCategorias()
  const { data: departamentos } = useDepartamentos()

  useEffect(() => {
    document.title = 'Tengo algo para donar — Ayuda Terremoto Colombia'
  }, [])

  const categoriasPorSlug = useMemo(
    () => new Map((categorias ?? []).map((c) => [c.slug, c])),
    [categorias],
  )
  const itemPorCategoria = useMemo(
    () => new Map(estado.items.map((i) => [i.categoria, i])),
    [estado.items],
  )
  const departamento = useMemo(
    () => (departamentos ?? []).find((d) => d.code === estado.departamento),
    [departamentos, estado.departamento],
  )

  /** Agrega o quita una categoría de la selección, sin perder lo ya escrito. */
  const alternarCategoria = (cat: Categoria) => {
    setEstado((s) => {
      const yaElegida = s.items.some((i) => i.categoria === cat.slug)
      return {
        ...s,
        items: yaElegida
          ? s.items.filter((i) => i.categoria !== cat.slug)
          : [...s.items, { categoria: cat.slug, cantidad: '', unidad: cat.unidad_sugerida }],
      }
    })
  }

  const actualizarItem = (slug: string, campo: 'cantidad' | 'unidad', valor: string) => {
    setEstado((s) => ({
      ...s,
      items: s.items.map((i) => (i.categoria === slug ? { ...i, [campo]: valor } : i)),
    }))
  }

  const itemsParaBuscar: ItemBusquedaMatch[] = estado.items.map((i) => ({
    categoria: i.categoria,
    cantidad: i.cantidad ? Number(i.cantidad) : null,
    unidad: i.unidad,
  }))

  const {
    coincidencias: coincidenciasCrudas,
    isPending,
    isError,
  } = useCoincidenciasMultiples(
    itemsParaBuscar,
    {
      departamento: estado.departamento || null,
      lat: departamento?.lat ?? null,
      lng: departamento?.lng ?? null,
      transporte: estado.transporte === true,
    },
    buscando,
  )

  const coincidencias = useMemo(
    () => coincidenciasCrudas.slice().sort(compararCoincidencias),
    [coincidenciasCrudas],
  )

  const puedeAvanzar = [
    estado.items.length > 0,
    estado.items.length > 0 && estado.items.every((i) => i.cantidad !== '' && Number(i.cantidad) > 0),
    Boolean(estado.departamento) && estado.ciudad.trim().length > 1,
    estado.transporte !== null,
  ][paso]

  const avanzar = () => {
    setDireccion(1)
    if (paso === PASOS.length - 1) setBuscando(true)
    else setPaso((p) => p + 1)
  }

  const retroceder = () => {
    setDireccion(-1)
    if (buscando) setBuscando(false)
    else setPaso((p) => Math.max(p - 1, 0))
  }

  const empezarDeNuevo = () => {
    setEstado(INICIAL)
    setPaso(0)
    setBuscando(false)
    setDireccion(-1)
  }

  return (
    <div className="contenedor max-w-4xl py-10 lg:py-14">
      <header>
        <Eyebrow>Coordinar una entrega</Eyebrow>
        <h1 className="display-ancho mt-3 text-[2rem] leading-tight sm:text-[2.5rem]">
          ¿Dónde llevo las donaciones?
        </h1>
        <p className="text-muted mt-3 max-w-2xl text-[1.0625rem] leading-relaxed">
          Cuéntanos qué tienes y te decimos en qué punto hace falta. Sin crear cuenta y sin dejar
          datos si no quieres.
        </p>
      </header>

      {/* --- Progreso: pasos como renglones de una guía de carga ----------- */}
      <ol className="border-line mt-8 flex flex-wrap gap-x-6 gap-y-2 border-y py-3">
        {PASOS.map((titulo, i) => {
          const hecho = buscando || i < paso
          const actual = !buscando && i === paso
          return (
            <li key={titulo} className="flex items-center gap-2">
              <span
                data-cifra
                aria-hidden="true"
                className={`font-mono text-[0.75rem] font-medium ${
                  actual ? 'text-signal-oscuro' : hecho ? 'text-verificado' : 'text-muted-claro'
                }`}
              >
                {hecho ? '✓' : `0${i + 1}`}
              </span>
              <button
                onClick={() => {
                  if (i <= paso || buscando) {
                    setDireccion(-1)
                    setBuscando(false)
                    setPaso(i)
                  }
                }}
                disabled={i > paso && !buscando}
                aria-current={actual ? 'step' : undefined}
                className={`font-mono text-[0.75rem] tracking-[0.1em] uppercase disabled:cursor-default ${
                  actual ? 'text-ink' : hecho ? 'text-muted hover:text-ink' : 'text-muted-claro'
                }`}
              >
                {titulo}
              </button>
            </li>
          )
        })}
      </ol>

      {/* --- Resumen de lo elegido ---------------------------------------- */}
      {(estado.items.length > 0 || estado.ciudad) && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {estado.items.map((item) => {
            const cat = categoriasPorSlug.get(item.categoria)
            return (
              <Insignia key={item.categoria}>
                {cat?.emoji} {cat?.nombre}
                {item.cantidad && ` · ${cifra(Number(item.cantidad))} ${item.unidad || cat?.unidad_sugerida}`}
              </Insignia>
            )
          })}
          {estado.ciudad && <Insignia>{estado.ciudad}</Insignia>}
          {estado.transporte !== null && (
            <Insignia tono={estado.transporte ? 'verificado' : 'aviso'}>
              {estado.transporte ? 'Con transporte' : 'Sin transporte'}
            </Insignia>
          )}
        </div>
      )}

      {/* --- Pasos --------------------------------------------------------- */}
      {!buscando && (
        <div className="relative mt-8 overflow-hidden">
          {/* mode="popLayout" y no "wait": con "wait" el paso siguiente no se
              monta hasta que termina la salida del anterior, así que cualquier
              cosa que congele las animaciones —una pestaña en segundo plano, un
              navegador que suspende requestAnimationFrame— deja el asistente
              trabado a mitad de camino. Con popLayout el paso nuevo aparece de
              inmediato y el viejo sale de la maquetación mientras se desvanece. */}
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div key={paso} {...transicionPaso}>
              {paso === 0 && (
                <fieldset>
                  <legend className="display-ancho text-[1.5rem] leading-tight font-bold">
                    ¿Qué tienes para donar?
                  </legend>
                  <p className="text-muted mt-2 text-[0.9375rem]">
                    Elige una o varias categorías — puedes combinar, por ejemplo, agua y alimentos
                    no perecederos.
                  </p>

                  <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
                    {(categorias ?? []).map((c) => {
                      const activo = estado.items.some((i) => i.categoria === c.slug)
                      return (
                        <button
                          key={c.slug}
                          onClick={() => alternarCategoria(c)}
                          aria-pressed={activo}
                          className={`flex items-start gap-3 rounded-[2px] border p-3.5 text-left transition-colors ${
                            activo
                              ? 'border-ink bg-paper'
                              : 'border-line hover:border-line-fuerte bg-paper'
                          }`}
                        >
                          <span aria-hidden="true" className="text-xl leading-none">
                            {c.emoji}
                          </span>
                          <span className="min-w-0">
                            <span className="block font-medium">{c.nombre}</span>
                            {c.descripcion && (
                              <span className="text-muted mt-0.5 block text-[0.8125rem] leading-snug">
                                {c.descripcion}
                              </span>
                            )}
                          </span>
                          {activo && (
                            <Check aria-hidden="true" className="text-verificado ml-auto h-4 w-4 shrink-0" />
                          )}
                        </button>
                      )
                    })}
                  </div>

                  {/* Se muestra en el primer paso a propósito: es cuando la
                      persona todavía puede decidir no cargar el carro. */}
                  <div className="mt-6">
                    <QueNoDonar compacto />
                  </div>
                </fieldset>
              )}

              {paso === 1 && (
                <div>
                  <h2 className="display-ancho text-[1.5rem] leading-tight font-bold">
                    {estado.items.length > 1 ? '¿Cuánto tienes de cada cosa?' : '¿Cuánto tienes?'}
                  </h2>
                  <p className="text-muted mt-2 text-[0.9375rem]">
                    Un número aproximado sirve. Es lo que permite saber si tu donación cubre una
                    necesidad completa.
                  </p>

                  <div className="mt-6 flex flex-col gap-5">
                    {estado.items.map((item, i) => {
                      const cat = categoriasPorSlug.get(item.categoria)
                      return (
                        <div
                          key={item.categoria}
                          className="border-line border-t pt-5 first:border-0 first:pt-0"
                        >
                          {estado.items.length > 1 && (
                            <p className="mb-2 flex items-center gap-2 font-medium">
                              <span aria-hidden="true">{cat?.emoji}</span>
                              {cat?.nombre}
                            </p>
                          )}
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                            <div className="sm:w-40">
                              <Campo
                                id={`cantidad-${item.categoria}`}
                                etiqueta="Cantidad"
                                requerido
                                type="number"
                                inputMode="decimal"
                                min={1}
                                step="any"
                                autoFocus={i === 0}
                                value={item.cantidad}
                                onChange={(e) =>
                                  actualizarItem(item.categoria, 'cantidad', e.target.value)
                                }
                                placeholder="100"
                              />
                            </div>
                            <div className="flex-1">
                              <Campo
                                id={`unidad-${item.categoria}`}
                                etiqueta="Unidad"
                                requerido
                                value={item.unidad}
                                onChange={(e) =>
                                  actualizarItem(item.categoria, 'unidad', e.target.value)
                                }
                                placeholder={cat?.unidad_sugerida ?? 'cajas'}
                                list="unidades"
                              />
                            </div>
                          </div>

                          {item.cantidad && Number(item.cantidad) > 0 && (
                            <p className="text-muted mt-3 font-mono text-[0.8125rem]">
                              {cifra(Number(item.cantidad))} {item.unidad || cat?.unidad_sugerida} de{' '}
                              {cat?.nombre.toLowerCase()}
                            </p>
                          )}
                        </div>
                      )
                    })}

                    <datalist id="unidades">
                      {['cajas', 'bultos', 'unidades', 'paquetes', 'bolsas', 'kits', 'litros', 'kilos'].map(
                        (u) => (
                          <option key={u} value={u} />
                        ),
                      )}
                    </datalist>
                  </div>
                </div>
              )}

              {paso === 2 && (
                <div>
                  <h2 className="display-ancho text-[1.5rem] leading-tight font-bold">
                    ¿Desde dónde puedes salir?
                  </h2>
                  <p className="text-muted mt-2 text-[0.9375rem]">
                    Con esto calculamos qué tan lejos queda cada necesidad de ti.
                  </p>

                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="departamento-origen" className="text-[0.875rem] font-medium">
                        Departamento
                      </label>
                      <select
                        id="departamento-origen"
                        value={estado.departamento}
                        onChange={(e) => setEstado((s) => ({ ...s, departamento: e.target.value }))}
                        required
                        className="border-line-fuerte bg-paper focus:border-ink w-full rounded-[2px] border px-3 py-2.5 text-[0.9375rem]"
                      >
                        <option value="">Selecciona…</option>
                        {(departamentos ?? []).map((d) => (
                          <option key={d.code} value={d.code}>
                            {d.nombre}
                          </option>
                        ))}
                      </select>
                    </div>

                    <Campo
                      id="ciudad-origen"
                      etiqueta="Ciudad o municipio"
                      requerido
                      value={estado.ciudad}
                      onChange={(e) => setEstado((s) => ({ ...s, ciudad: e.target.value }))}
                      placeholder="Medellín"
                    />
                  </div>
                </div>
              )}

              {paso === 3 && (
                <div>
                  <h2 className="display-ancho text-[1.5rem] leading-tight font-bold">
                    ¿Tienes cómo transportarlo?
                  </h2>
                  <p className="text-muted mt-2 text-[0.9375rem]">
                    Esta respuesta cambia todo el resultado. Con transporte podemos proponerte
                    necesidades de otros departamentos; sin transporte, solo lo que queda a tu
                    alcance.
                  </p>

                  <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
                    {[
                      {
                        valor: true,
                        titulo: 'Sí, puedo llevarlo',
                        detalle: 'Carro, camioneta, camión o alguien que lo lleve por mí.',
                        Icono: Truck,
                      },
                      {
                        valor: false,
                        titulo: 'No, necesito un punto cerca',
                        detalle: 'Busco dónde entregarlo sin salir de mi zona.',
                        Icono: MapPin,
                      },
                    ].map((op) => {
                      const activo = estado.transporte === op.valor
                      return (
                        <button
                          key={String(op.valor)}
                          onClick={() => setEstado((s) => ({ ...s, transporte: op.valor }))}
                          aria-pressed={activo}
                          className={`bg-paper flex items-start gap-3 rounded-[2px] border p-4 text-left transition-colors ${
                            activo ? 'border-ink' : 'border-line hover:border-line-fuerte'
                          }`}
                        >
                          <op.Icono aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                          <span>
                            <span className="block font-medium">{op.titulo}</span>
                            <span className="text-muted mt-0.5 block text-[0.8125rem] leading-snug">
                              {op.detalle}
                            </span>
                          </span>
                          {activo && (
                            <Check aria-hidden="true" className="text-verificado ml-auto h-4 w-4 shrink-0" />
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="border-line bg-mineral relative z-10 mt-8 flex items-center justify-between border-t pt-5">
            <Boton variante="fantasma" onClick={retroceder} disabled={paso === 0}>
              <ArrowLeft aria-hidden="true" className="h-4 w-4" />
              Atrás
            </Boton>

            <Boton onClick={avanzar} disabled={!puedeAvanzar} tamano="grande">
              {paso === PASOS.length - 1 ? 'Buscar dónde hace falta' : 'Continuar'}
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Boton>
          </div>
        </div>
      )}

      {/* --- Resultados ---------------------------------------------------- */}
      {buscando && (
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
          className="mt-8"
          aria-live="polite"
        >
          {isPending && <Esqueleto filas={3} />}

          {isError && (
            <Aviso tono="error">
              No pudimos consultar las necesidades. Revisa tu conexión e intenta de nuevo.
            </Aviso>
          )}

          {!isPending && !isError && coincidencias.length === 0 && (
            <SinResultados titulo="No hay una necesidad abierta que encaje">
              <p>
                Nadie tiene registrada una necesidad de{' '}
                {listarNombres(
                  estado.items.map(
                    (i) => categoriasPorSlug.get(i.categoria)?.nombre.toLowerCase() ?? i.categoria,
                  ),
                )}
                {estado.transporte === false ? ' cerca de ti' : ''} en este momento. Eso puede
                significar que ya está cubierta, o que el punto no ha reportado la cifra.
              </p>
              <p className="mt-3">
                Revisa el{' '}
                <Link to="/puntos" className="subrayado-signal">
                  directorio completo
                </Link>{' '}
                y llama al punto más cercano antes de descartar la donación.
              </p>
            </SinResultados>
          )}

          {!isPending && !isError && coincidencias.length > 0 && (
            <>
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="display-ancho text-[1.5rem] leading-tight font-bold">
                  {coincidencias.length === 1
                    ? 'Encontramos una necesidad'
                    : `Encontramos ${cifra(coincidencias.length)} necesidades`}
                </h2>
                <Boton variante="fantasma" tamano="pequeno" onClick={empezarDeNuevo}>
                  <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />
                  Empezar de nuevo
                </Boton>
              </div>

              <p className="text-muted mt-2 text-[0.9375rem]">
                Ordenadas por urgencia y por cercanía. La primera es la que más falta hace.
              </p>

              <div className="mt-6 flex flex-col gap-4">
                {coincidencias.map((m, i) => {
                  const item = itemPorCategoria.get(m.categoria)
                  const cat = categoriasPorSlug.get(m.categoria)
                  const cantidadOfrecida = Number(item?.cantidad ?? 0)
                  const unidadOfrecida = item?.unidad || cat?.unidad_sugerida || 'unidades'
                  return (
                    <TarjetaCoincidencia
                      key={m.need_id}
                      coincidencia={m}
                      destacada={i === 0}
                      oferta={{
                        categoriaNombre: cat?.nombre ?? m.categoria_nombre,
                        cantidad: cantidadOfrecida,
                        unidad: unidadOfrecida,
                        ciudadOrigen: estado.ciudad,
                        transporte: estado.transporte === true,
                      }}
                      datosOferta={{
                        categoria: m.categoria,
                        cantidad: cantidadOfrecida,
                        unidad: unidadOfrecida,
                        department_code: estado.departamento,
                        ciudad: estado.ciudad,
                        transporte_disponible: estado.transporte === true,
                      }}
                    />
                  )
                })}
              </div>
            </>
          )}
        </motion.section>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tarjeta de coincidencia.
//
// Reproduce el formato que la gente entiende de un vistazo:
//   📍 Necesidad detectada: Buenaventura
//   💧 faltan 80 cajas
//   🚛 Transporte disponible: Sí
//   [Coordinar entrega]
// ---------------------------------------------------------------------------
function TarjetaCoincidencia({
  coincidencia: m,
  destacada,
  oferta,
  datosOferta,
}: {
  coincidencia: Coincidencia
  destacada: boolean
  oferta: {
    categoriaNombre: string
    cantidad: number
    unidad: string
    ciudadOrigen: string
    transporte: boolean
  }
  datosOferta: Record<string, unknown>
}) {
  const [trampas] = useState(camposTrampaIniciales)
  const [honeypot, setHoneypot] = useState('')
  const [token, setToken] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [coordinada, setCoordinada] = useState(false)
  const [contacto, setContacto] = useState('')
  const [nombre, setNombre] = useState('')

  const mensaje = mensajeCoordinacion(m, oferta)
  const enlace = enlaceWhatsapp(m.whatsapp ?? m.telefono, mensaje)

  /**
   * Registra la oferta y, si el punto tiene WhatsApp, abre la conversación.
   *
   * El registro es útil pero no puede ser un obstáculo: si falla, igual se abre
   * WhatsApp. Lo importante es que la donación llegue, no que la base tenga la
   * fila.
   */
  const coordinar = async () => {
    setEnviando(true)
    setError(null)
    try {
      await enviarAporte(
        'oferta_donacion',
        {
          ...datosOferta,
          matched_point_id: m.point_id,
          nombre_contacto: nombre || undefined,
          telefono: contacto || undefined,
          mensaje,
        },
        { ...trampas, website: honeypot },
        token ?? undefined,
      )
      setCoordinada(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos registrar la oferta')
    } finally {
      setEnviando(false)
      if (enlace) window.open(enlace, '_blank', 'noopener')
    }
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
      className="panel relative overflow-hidden"
      style={destacada ? { borderColor: URGENCIA_COLOR[m.urgencia] } : undefined}
    >
      {destacada && (
        <div
          className="px-4 py-1.5 font-mono text-[0.6875rem] tracking-[0.14em] uppercase"
          style={{ backgroundColor: URGENCIA_COLOR[m.urgencia], color: 'var(--color-paper)' }}
        >
          Donde más falta
        </div>
      )}

      <div className="p-4 sm:p-5">
        {/* Línea de manifiesto: el mismo objeto visual de la portada. */}
        <Manifiesto
          datos={{
            lugar: `Necesidad detectada: ${m.ciudad}`,
            detalleLugar: m.departamento,
            emoji: m.emoji,
            categoria: m.categoria_nombre,
            cantidadSolicitada: m.cantidad_solicitada,
            cantidadCubierta: m.cantidad_cubierta,
            unidad: m.unidad,
            urgencia: m.urgencia,
            zonaAfectada: m.zona_afectada,
            distanciaKm: m.distancia_km,
          }}
        />

        <div className="border-line mt-4 border-t pt-4">
          <h3 className="display-ancho text-[1.125rem] leading-tight font-bold">
            <Link to={`/puntos/${m.point_slug}`} className="hover:subrayado-signal">
              {m.punto}
            </Link>
          </h3>
          {m.organizacion && <p className="text-muted mt-1 text-[0.875rem]">{m.organizacion}</p>}
          {m.direccion && (
            <p className="mt-2 flex items-start gap-1.5 text-[0.9375rem]">
              <MapPin aria-hidden="true" className="text-muted mt-0.5 h-4 w-4 shrink-0" />
              <a
                href={enlaceMapa({
                  nombre: m.punto,
                  direccion: m.direccion,
                  ciudad: m.ciudad,
                  lat: m.lat,
                  lng: m.lng,
                })}
                target="_blank"
                rel="noreferrer noopener"
                className="hover:subrayado-signal"
              >
                {m.direccion}
              </a>
            </p>
          )}
          {m.horario && <p className="text-muted mt-1.5 text-[0.875rem]">Horario: {m.horario}</p>}

          <ul className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[0.75rem] tracking-wide uppercase">
            <li className="flex items-center gap-1.5">
              <Truck aria-hidden="true" className="h-3.5 w-3.5" />
              Transporte disponible: {oferta.transporte ? 'Sí' : 'No'}
            </li>
            {m.acepta_transporte_grande && <li>Recibe camión</li>}
            {m.cubre_completo === true && (
              <li style={{ color: 'var(--color-verificado)' }}>Tu donación la cubre completa</li>
            )}
          </ul>

          <div className="mt-3">
            <SelloFrescura actualizado={m.actualizado} />
          </div>
        </div>

        {coordinada && (
          <div className="mt-4">
            <Aviso tono="exito">
              {enlace
                ? 'Registramos tu oferta. Si WhatsApp no se abrió, usa el botón otra vez o llama al teléfono del punto.'
                : 'Registramos tu donación y tus datos de contacto. La moderación coordina la entrega con este punto y te escribe.'}
            </Aviso>
          </div>
        )}

        {error && (
          <div className="mt-4">
            <Aviso tono="atencion">
              {error} Abrimos WhatsApp de todas formas: puedes coordinar directo con el punto.
            </Aviso>
          </div>
        )}

        <CampoTrampa valor={honeypot} onChange={setHoneypot} />
        {turnstileActivo && (
          <div className="mt-4">
            <Turnstile onToken={setToken} />
          </div>
        )}

        {/* Camino sin teléfono.
            Ninguna de las fuentes oficiales publica el contacto de los puntos,
            así que este es el caso mayoritario, no la excepción. Un aviso que
            dijera "no hay WhatsApp" y nada más sería un callejón sin salida en
            la pantalla más importante del producto. En cambio se registra la
            oferta con el contacto de quien dona: la moderación ve que hay 100
            cajas de agua esperando destino y puede cerrar el círculo llamando
            al punto. */}
        {!enlace && !coordinada && (
          <div className="border-line mt-4 border-t pt-4">
            <p className="text-[0.9375rem] leading-relaxed">
              Este punto todavía no tiene teléfono publicado. Deja tus datos y la moderación
              coordina la entrega contigo: es la vía que tenemos hasta que alguien aporte el
              contacto del punto.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Campo
                id={`nombre-${m.need_id}`}
                etiqueta="Tu nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Como quieres que te llamen"
              />
              <Campo
                id={`contacto-${m.need_id}`}
                etiqueta="Tu teléfono o WhatsApp"
                type="tel"
                ayuda="Sin un contacto no hay forma de avisarte."
                value={contacto}
                onChange={(e) => setContacto(e.target.value)}
                placeholder="300 000 0000"
              />
            </div>
          </div>
        )}

        <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
          {enlace ? (
            <Boton onClick={coordinar} cargando={enviando} tamano="grande" className="w-full sm:w-auto">
              <MessageCircle aria-hidden="true" className="h-4 w-4" />
              Coordinar entrega por WhatsApp
            </Boton>
          ) : (
            <Boton
              onClick={coordinar}
              cargando={enviando}
              disabled={contacto.trim().length < 7}
              tamano="grande"
              className="w-full sm:w-auto"
            >
              <Send aria-hidden="true" className="h-4 w-4" />
              Registrar mi donación para este punto
            </Boton>
          )}

          {m.telefono && (
            <a href={enlaceLlamada(m.telefono) ?? undefined} className="w-full sm:w-auto">
              <Boton variante="secundario" tamano="grande" className="w-full">
                <Phone aria-hidden="true" className="h-4 w-4" />
                {m.telefono}
              </Boton>
            </a>
          )}

          <Link to={`/puntos/${m.point_slug}`} className="w-full sm:w-auto">
            <Boton variante="secundario" tamano="grande" className="w-full">
              Ver la ficha del punto
            </Boton>
          </Link>
        </div>

        <p className="text-muted mt-3 text-[0.8125rem] leading-snug">
          {enlace
            ? 'El mensaje va prellenado con qué tienes, cuánto y desde dónde, para que el punto pueda responderte de una sola vez.'
            : '¿Conoces el teléfono de este punto? Agrégalo desde su ficha y el siguiente donante podrá escribirle directo.'}
        </p>
      </div>
    </motion.article>
  )
}
