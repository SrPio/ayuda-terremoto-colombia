import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { ArrowRight, PackageCheck, Phone, Search } from 'lucide-react'
import { Manifiesto } from '@/componentes/Manifiesto'
import { Aviso, Boton, Esqueleto, Eyebrow } from '@/componentes/ui'
import { useCascada, useEntrada } from '@/lib/movimiento'
import { cifra, haceCuanto } from '@/lib/formato'
import { useEstadisticas, useNecesidadesCriticas } from '@/lib/consultas'

// ============================================================================
// Portada.
//
// El héroe no es una foto ni una cifra grande: es el manifiesto en vivo de lo
// que falta ahora mismo. Es lo más característico del proyecto y lo único que
// nadie más está publicando, así que abre la página.
//
// Y a la izquierda, una sola pregunta con dos respuestas posibles: o vengo a
// buscar dónde llevar algo, o vengo a ver qué se necesita.
// ============================================================================

const FUENTE_SISMO =
  'https://www.eltiempo.com/datos/este-es-el-mapa-completo-de-los-centros-de-acopio-habilitados-en-colombia-para-ayudar-a-los-damnificados-del-terremoto-de-magnitud-7-3577654'

export default function Portada() {
  const entrada = useEntrada()
  const cascada = useCascada(0.06)
  const { data: stats } = useEstadisticas()
  const { data: criticas, isPending, isError } = useNecesidadesCriticas(6)

  return (
    <>
      {/* --- Franja de situación ------------------------------------------- */}
      <div className="bg-ink text-muted-claro">
        <div className="contenedor flex flex-wrap items-center gap-x-5 gap-y-1 py-2.5 font-mono text-[0.6875rem] tracking-[0.1em] uppercase">
          <span className="text-signal">Sismo M 7,4</span>
          <span>10 de agosto de 2026</span>
          <span className="hidden sm:inline">Epicentro: San José del Palmar, Chocó</span>
          <a
            href={FUENTE_SISMO}
            target="_blank"
            rel="noreferrer noopener"
            className="hover:text-mineral ml-auto underline decoration-dotted underline-offset-2"
          >
            Fuente de los datos
          </a>
        </div>
      </div>

      {/* --- Héroe --------------------------------------------------------- */}
      <section className="contenedor grid gap-10 py-12 lg:grid-cols-[1fr_minmax(0,26rem)] lg:gap-14 lg:py-20">
        <motion.div initial="oculto" animate="visible" variants={entrada}>
          <Eyebrow>Puntos de acopio de Colombia</Eyebrow>

          <h1 className="display-ancho mt-4 text-[2.5rem] leading-[0.98] sm:text-[3.25rem] lg:text-[3.75rem]">
            Qué se necesita.
            <br />
            <span className="subrayado-signal">Dónde llevarlo.</span>
          </h1>

          <p className="text-muted mt-5 max-w-xl text-[1.0625rem] leading-relaxed">
            Los puntos de acopio del país en un solo lugar, con la lista concreta de lo que pide
            cada uno. Si ya tienes algo listo para donar, te decimos dónde hace falta de verdad —
            no dónde ya sobra.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link to="/donar">
              <Boton tamano="grande" className="w-full sm:w-auto">
                <PackageCheck aria-hidden="true" className="h-4 w-4" />
                Tengo algo para donar
              </Boton>
            </Link>
            <Link to="/puntos">
              <Boton variante="secundario" tamano="grande" className="w-full sm:w-auto">
                <Search aria-hidden="true" className="h-4 w-4" />
                Ver puntos de acopio
              </Boton>
            </Link>
          </div>

          {/* Cifras del tablero, en mono porque son datos operativos. */}
          {stats && (
            <dl className="border-line mt-10 grid grid-cols-2 gap-x-6 gap-y-5 border-t pt-6 sm:grid-cols-4">
              {[
                { t: 'Puntos activos', v: cifra(stats.puntos_activos) },
                { t: 'Departamentos', v: cifra(stats.departamentos_cubiertos) },
                { t: 'Necesidades abiertas', v: cifra(stats.necesidades_abiertas) },
                {
                  t: 'Últ. actualización',
                  v: haceCuanto(stats.ultima_actualizacion),
                  pequeno: true,
                },
              ].map((d) => (
                <div key={d.t}>
                  <dd
                    data-cifra
                    className={`font-mono font-medium ${d.pequeno ? 'text-[0.9375rem]' : 'text-[1.75rem]'} leading-none`}
                  >
                    {d.v}
                  </dd>
                  <dt className="eyebrow mt-1.5 block">{d.t}</dt>
                </div>
              ))}
            </dl>
          )}
        </motion.div>

        {/* --- Manifiesto en vivo ----------------------------------------- */}
        <motion.aside
          initial="oculto"
          animate="visible"
          variants={entrada}
          className="panel self-start"
          aria-labelledby="titulo-manifiesto"
        >
          <div className="border-line flex items-baseline justify-between border-b px-4 py-3">
            <h2 id="titulo-manifiesto" className="display-estrecho text-[0.9375rem] font-bold uppercase">
              Lo más urgente ahora
            </h2>
            {stats && stats.necesidades_criticas > 0 && (
              <span data-cifra className="text-critica font-mono text-[0.75rem] font-medium">
                {cifra(stats.necesidades_criticas)} críticas
              </span>
            )}
          </div>

          <div className="px-4 py-3">
            {isPending && <Esqueleto filas={3} />}

            {isError && (
              <Aviso tono="error">No pudimos cargar las necesidades. Recarga la página.</Aviso>
            )}

            {criticas && criticas.length === 0 && (
              <p className="text-muted py-6 text-center text-[0.875rem]">
                Todavía no hay necesidades registradas con cantidades.
              </p>
            )}

            {criticas && criticas.length > 0 && (
              <motion.ul
                initial="oculto"
                animate="visible"
                variants={cascada}
                className="divide-line flex flex-col divide-y"
              >
                {criticas.map((n) => (
                  <motion.li key={n.need_id} variants={cascada} className="py-2.5 first:pt-0 last:pb-0">
                    <Manifiesto
                      compacto
                      datos={{
                        lugar: n.ciudad,
                        detalleLugar: n.punto,
                        emoji: n.emoji,
                        categoria: n.categoria_nombre,
                        cantidadSolicitada: n.cantidad_solicitada,
                        cantidadCubierta: n.cantidad_cubierta,
                        unidad: n.unidad,
                        urgencia: n.urgencia,
                        zonaAfectada: n.zona_afectada,
                        enlace: `/puntos/${n.point_slug}`,
                      }}
                    />
                  </motion.li>
                ))}
              </motion.ul>
            )}
          </div>

          <div className="border-line border-t px-4 py-3">
            <Link
              to="/puntos"
              className="font-mono text-eyebrow inline-flex items-center gap-1.5 tracking-[0.12em] uppercase hover:subrayado-signal"
            >
              Ver los {stats ? cifra(stats.puntos_activos) : ''} puntos
              <ArrowRight aria-hidden="true" className="h-3 w-3" />
            </Link>
          </div>
        </motion.aside>
      </section>

      {/* --- Cómo funciona ------------------------------------------------- */}
      {/* Numerado porque sí es una secuencia: cada paso depende del anterior. */}
      <section className="bg-paper border-line border-y">
        <div className="contenedor py-14">
          <Eyebrow>Cómo llega tu donación a donde hace falta</Eyebrow>

          <ol className="mt-8 grid gap-8 md:grid-cols-3 md:gap-12">
            {[
              {
                n: '01',
                t: 'Dices qué tienes',
                d: 'Agua, alimentos, cobijas, herramientas. Cuánto, desde qué ciudad, y si cuentas con transporte.',
              },
              {
                n: '02',
                t: 'Te mostramos dónde falta',
                d: 'Cruzamos tu donación con las necesidades abiertas y priorizamos las zonas con daño directo y lo que nadie ha cubierto.',
              },
              {
                n: '03',
                t: 'Coordinas directo',
                d: 'Abres WhatsApp con el mensaje ya escrito y hablas con el punto. Sin intermediarios y sin crear una cuenta.',
              },
            ].map((paso) => (
              <li key={paso.n}>
                <span
                  data-cifra
                  className="text-signal-oscuro font-mono text-[0.8125rem] font-medium tracking-[0.14em]"
                >
                  {paso.n}
                </span>
                <h3 className="display-ancho mt-2 text-[1.25rem] font-bold">{paso.t}</h3>
                <p className="text-muted mt-2 text-[0.9375rem] leading-relaxed">{paso.d}</p>
              </li>
            ))}
          </ol>

          <div className="mt-10">
            <Link to="/donar">
              <Boton>
                Empezar
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Boton>
            </Link>
          </div>
        </div>
      </section>

      {/* --- Antes de salir de casa --------------------------------------- */}
      <section className="contenedor py-14">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,22rem)_1fr] lg:gap-16">
          <div>
            <Eyebrow>Antes de salir de casa</Eyebrow>
            <h2 className="display-ancho mt-3 text-[1.75rem] leading-tight">
              Tres cosas que evitan que tu esfuerzo se pierda
            </h2>
          </div>

          <ul className="divide-line flex flex-col divide-y">
            {[
              {
                Icono: Phone,
                t: 'Llama antes de ir',
                d: 'Los puntos abren, se saturan y cierran de un día para otro. Un dato de ayer puede mandarte a una puerta cerrada. En cada ficha está el teléfono.',
              },
              {
                Icono: PackageCheck,
                t: 'Lleva exactamente lo que ese punto pide',
                d: 'Un centro que pide cascos y guantes no puede hacer nada con ropa usada, y almacenarla le quita espacio y manos a lo que sí necesita.',
              },
              {
                Icono: Search,
                t: 'Revisa fechas de vencimiento y empaques',
                d: 'Los alimentos vencidos o con el empaque roto se descartan al llegar. Revisarlos en casa ahorra trabajo en el punto de acopio.',
              },
            ].map((item) => (
              <li key={item.t} className="flex gap-4 py-5 first:pt-0 last:pb-0">
                <item.Icono
                  aria-hidden="true"
                  className="text-signal-oscuro mt-0.5 h-5 w-5 shrink-0"
                />
                <div>
                  <h3 className="text-[1.0625rem] font-medium">{item.t}</h3>
                  <p className="text-muted mt-1 text-[0.9375rem] leading-relaxed">{item.d}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* --- Colaborar ---------------------------------------------------- */}
      <section className="contenedor pb-4">
        <div className="cinta-aviso panel px-5 py-6 sm:px-8 sm:py-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <h2 className="display-ancho text-[1.375rem] leading-tight">
                ¿Conoces un punto que no está en la lista?
              </h2>
              <p className="text-muted mt-2 text-[0.9375rem] leading-relaxed">
                Agrégalo sin crear cuenta. Un moderador lo revisa antes de publicarlo, para que
                nadie viaje por un dato falso. También puedes corregir o reportar cualquier punto
                que ya esté publicado.
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-2.5 sm:flex-row">
              <Link to="/agregar">
                <Boton className="w-full sm:w-auto">Agregar un punto</Boton>
              </Link>
              <Link to="/puntos">
                <Boton variante="secundario" className="w-full sm:w-auto">
                  Revisar los publicados
                </Boton>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
