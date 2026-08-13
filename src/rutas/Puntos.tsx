import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { List, Map as MapIcon, Search, SlidersHorizontal, Truck, X } from 'lucide-react'
import { TarjetaPunto } from '@/componentes/TarjetaPunto'
import {
  Aviso,
  Boton,
  Esqueleto,
  ErrorCarga,
  Eyebrow,
  Insignia,
  SinResultados,
} from '@/componentes/ui'
import { URGENCIA_ETIQUETA, URGENCIA_PESO, cifra, normalizar } from '@/lib/formato'
import { useCascada } from '@/lib/movimiento'
import { useCategorias, useDepartamentos, usePuntos } from '@/lib/consultas'
import type { Punto, Urgencia } from '@/lib/tipos'

const Mapa = lazy(() => import('@/componentes/Mapa'))

// ============================================================================
// Listado de puntos de acopio.
//
// Los filtros viven en la URL, no en el estado del componente. Así un enlace
// como /puntos?departamento=risaralda&categoria=agua se puede pegar en un grupo
// de WhatsApp y llega mostrando exactamente lo mismo que veía quien lo mandó.
// Durante una emergencia la gente comparte enlaces, no instrucciones.
// ============================================================================

const URGENCIAS: Urgencia[] = ['critica', 'alta', 'media', 'baja']

export default function Puntos() {
  const [params, setParams] = useSearchParams()
  const cascada = useCascada(0.04)

  const { data: puntos, isPending, isError, error } = usePuntos()
  const { data: departamentos } = useDepartamentos()
  const { data: categorias } = useCategorias()

  const [vista, setVista] = useState<'lista' | 'mapa'>('lista')
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false)

  const busqueda = params.get('q') ?? ''
  const departamento = params.get('departamento') ?? ''
  const categoria = params.get('categoria') ?? ''
  const urgencia = params.get('urgencia') ?? ''
  const soloCamion = params.get('camion') === '1'
  const soloVerificados = params.get('verificados') === '1'

  const actualizar = (clave: string, valor: string | null) => {
    const siguiente = new URLSearchParams(params)
    if (valor === null || valor === '') siguiente.delete(clave)
    else siguiente.set(clave, valor)
    setParams(siguiente, { replace: true })
  }

  const limpiar = () => setParams(new URLSearchParams(), { replace: true })

  const filtrosActivos =
    [busqueda, departamento, categoria, urgencia].filter(Boolean).length +
    (soloCamion ? 1 : 0) +
    (soloVerificados ? 1 : 0)

  const mapaCategorias = useMemo(
    () => new Map((categorias ?? []).map((c) => [c.slug, c])),
    [categorias],
  )

  const visibles = useMemo(() => {
    if (!puntos) return []
    const termino = normalizar(busqueda)

    return puntos
      .filter((p) => {
        if (departamento && p.department_code !== departamento) return false
        if (soloCamion && !p.acepta_transporte_grande) return false
        if (soloVerificados && !p.verificado) return false

        const activas = p.point_needs.filter((n) => n.activa)
        if (categoria && !activas.some((n) => n.category_slug === categoria)) return false
        if (urgencia && !activas.some((n) => n.urgencia === urgencia)) return false

        if (termino) {
          const heno = normalizar(
            [p.nombre, p.ciudad, p.direccion, p.organizacion, p.departments?.nombre]
              .filter(Boolean)
              .join(' '),
          )
          if (!heno.includes(termino)) return false
        }
        return true
      })
      .sort(ordenarPorApremio)
  }, [puntos, busqueda, departamento, categoria, urgencia, soloCamion, soloVerificados])

  // El título de la pestaña dice cuántos hay: útil con varias pestañas abiertas.
  useEffect(() => {
    document.title = `Puntos de acopio${visibles.length ? ` (${visibles.length})` : ''} — Ayuda Terremoto Colombia`
  }, [visibles.length])

  return (
    <div className="contenedor py-10 lg:py-14">
      <header className="max-w-2xl">
        <Eyebrow>Directorio</Eyebrow>
        <h1 className="display-ancho mt-3 text-[2rem] leading-tight sm:text-[2.5rem]">
          Puntos de acopio habilitados
        </h1>
        <p className="text-muted mt-3 text-[1.0625rem] leading-relaxed">
          Filtra por departamento o por lo que quieres donar. Cada ficha muestra lo que ese punto
          pide y cuándo se confirmó por última vez.
        </p>
      </header>

      {/* --- Barra de filtros ---------------------------------------------- */}
      <section aria-label="Filtros" className="panel mt-8 p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search
              aria-hidden="true"
              className="text-muted-claro pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
            />
            <label htmlFor="buscar" className="sr-only">
              Buscar por nombre, ciudad o dirección
            </label>
            <input
              id="buscar"
              type="search"
              value={busqueda}
              onChange={(e) => actualizar('q', e.target.value)}
              placeholder="Buscar por nombre, ciudad o dirección"
              className="border-line-fuerte bg-mineral placeholder:text-muted-claro focus:border-ink w-full rounded-[2px] border py-2.5 pr-3 pl-9 text-[0.9375rem]"
            />
          </div>

          <div className="flex gap-2">
            <label htmlFor="departamento" className="sr-only">
              Departamento
            </label>
            <select
              id="departamento"
              value={departamento}
              onChange={(e) => actualizar('departamento', e.target.value)}
              className="border-line-fuerte bg-mineral focus:border-ink flex-1 rounded-[2px] border px-3 py-2.5 text-[0.9375rem] lg:flex-none"
            >
              <option value="">Todo el país</option>
              {(departamentos ?? [])
                .filter((d) => (puntos ?? []).some((p) => p.department_code === d.code))
                .map((d) => (
                  <option key={d.code} value={d.code}>
                    {d.nombre}
                    {d.afectado ? ' · zona afectada' : ''}
                  </option>
                ))}
            </select>

            <Boton
              variante="secundario"
              onClick={() => setFiltrosAbiertos((v) => !v)}
              aria-expanded={filtrosAbiertos}
              aria-controls="mas-filtros"
            >
              <SlidersHorizontal aria-hidden="true" className="h-4 w-4" />
              <span className="hidden sm:inline">Más filtros</span>
              {filtrosActivos > 0 && (
                <span data-cifra className="bg-signal text-ink rounded-full px-1.5 font-mono text-[0.6875rem]">
                  {filtrosActivos}
                </span>
              )}
            </Boton>
          </div>

          {/* Alternador de vista: en móvil la lista siempre gana por defecto,
              porque el mapa en pantalla pequeña oculta más de lo que muestra. */}
          <div
            role="group"
            aria-label="Cambiar vista"
            className="border-line-fuerte flex shrink-0 rounded-[2px] border"
          >
            {(
              [
                { v: 'lista' as const, Icono: List, texto: 'Lista' },
                { v: 'mapa' as const, Icono: MapIcon, texto: 'Mapa' },
              ]
            ).map(({ v, Icono, texto }) => (
              <button
                key={v}
                onClick={() => setVista(v)}
                aria-pressed={vista === v}
                className={`flex items-center gap-1.5 px-3 py-2.5 font-mono text-[0.6875rem] tracking-[0.12em] uppercase transition-colors ${
                  vista === v ? 'bg-ink text-mineral' : 'text-muted hover:text-ink'
                }`}
              >
                <Icono aria-hidden="true" className="h-3.5 w-3.5" />
                {texto}
              </button>
            ))}
          </div>
        </div>

        <AnimatePresence initial={false}>
          {filtrosAbiertos && (
            <motion.div
              id="mas-filtros"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="border-line mt-4 flex flex-col gap-4 border-t pt-4">
                <fieldset>
                  <legend className="eyebrow mb-2.5">Qué quieres donar</legend>
                  <div className="flex flex-wrap gap-2">
                    {(categorias ?? []).map((c) => {
                      const activo = categoria === c.slug
                      return (
                        <button
                          key={c.slug}
                          onClick={() => actualizar('categoria', activo ? null : c.slug)}
                          aria-pressed={activo}
                          className={`flex items-center gap-1.5 rounded-[2px] border px-2.5 py-1.5 text-[0.8125rem] transition-colors ${
                            activo
                              ? 'border-ink bg-ink text-mineral'
                              : 'border-line-fuerte hover:border-ink'
                          }`}
                        >
                          <span aria-hidden="true">{c.emoji}</span>
                          {c.nombre}
                        </button>
                      )
                    })}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="eyebrow mb-2.5">Urgencia</legend>
                  <div className="flex flex-wrap gap-2">
                    {URGENCIAS.map((u) => {
                      const activo = urgencia === u
                      return (
                        <button
                          key={u}
                          onClick={() => actualizar('urgencia', activo ? null : u)}
                          aria-pressed={activo}
                          className={`rounded-[2px] border px-2.5 py-1.5 font-mono text-[0.75rem] tracking-wide uppercase transition-colors ${
                            activo
                              ? 'border-ink bg-ink text-mineral'
                              : 'border-line-fuerte hover:border-ink'
                          }`}
                        >
                          {URGENCIA_ETIQUETA[u]}
                        </button>
                      )
                    })}
                  </div>
                </fieldset>

                <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                  <label className="flex cursor-pointer items-center gap-2 text-[0.9375rem]">
                    <input
                      type="checkbox"
                      checked={soloCamion}
                      onChange={(e) => actualizar('camion', e.target.checked ? '1' : null)}
                      className="accent-ink h-4 w-4"
                    />
                    <Truck aria-hidden="true" className="h-4 w-4" />
                    Solo puntos que reciben camión
                  </label>

                  <label className="flex cursor-pointer items-center gap-2 text-[0.9375rem]">
                    <input
                      type="checkbox"
                      checked={soloVerificados}
                      onChange={(e) => actualizar('verificados', e.target.checked ? '1' : null)}
                      className="accent-ink h-4 w-4"
                    />
                    Solo puntos verificados
                  </label>

                  {filtrosActivos > 0 && (
                    <button
                      onClick={limpiar}
                      className="text-muted hover:text-ink ml-auto flex items-center gap-1.5 font-mono text-[0.75rem] tracking-wide uppercase"
                    >
                      <X aria-hidden="true" className="h-3.5 w-3.5" />
                      Quitar filtros
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* --- Resultados ---------------------------------------------------- */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p aria-live="polite" className="eyebrow">
          {isPending
            ? 'Cargando puntos'
            : `${cifra(visibles.length)} ${visibles.length === 1 ? 'punto' : 'puntos'}${
                puntos && visibles.length !== puntos.length ? ` de ${cifra(puntos.length)}` : ''
              }`}
        </p>
        {departamento && departamentos && (
          <Insignia>
            {departamentos.find((d) => d.code === departamento)?.nombre ?? departamento}
          </Insignia>
        )}
      </div>

      <div className="mt-4">
        {isPending && <Esqueleto filas={4} />}
        {isError && <ErrorCarga mensaje={error instanceof Error ? error.message : undefined} />}

        {!isPending && !isError && visibles.length === 0 && (
          <SinResultados titulo="Ningún punto coincide con esos filtros">
            <p>
              Prueba quitando algún filtro o busca en todo el país. Si conoces un punto que falta,{' '}
              <a href="/agregar" className="subrayado-signal">
                agrégalo
              </a>
              .
            </p>
            {filtrosActivos > 0 && (
              <div className="mt-4">
                <Boton variante="secundario" onClick={limpiar}>
                  Quitar filtros
                </Boton>
              </div>
            )}
          </SinResultados>
        )}

        {visibles.length > 0 && vista === 'mapa' && (
          <Suspense
            fallback={
              <div className="panel grid h-[460px] place-items-center">
                <p className="eyebrow">Cargando mapa</p>
              </div>
            }
          >
            <Mapa puntos={visibles} />
          </Suspense>
        )}

        {visibles.length > 0 && vista === 'lista' && (
          <motion.div
            initial="oculto"
            animate="visible"
            variants={cascada}
            className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
          >
            {visibles.map((p) => (
              <TarjetaPunto key={p.id} punto={p} categorias={mapaCategorias} />
            ))}
          </motion.div>
        )}
      </div>

      <div className="mt-10">
        <Aviso tono="atencion">
          La información la aportan personas y medios públicos. Confirma por teléfono antes de
          desplazarte: los puntos se saturan y cierran rápido.
        </Aviso>
      </div>
    </div>
  )
}

/**
 * Orden por apremio: primero la urgencia más alta que tenga el punto, luego las
 * zonas afectadas, luego lo actualizado más recientemente. Un listado ordenado
 * alfabéticamente sería más fácil de programar y peor para quien decide a dónde
 * ir.
 */
function ordenarPorApremio(a: Punto, b: Punto): number {
  const pico = (p: Punto) =>
    p.point_needs
      .filter((n) => n.activa)
      .reduce((max, n) => Math.max(max, URGENCIA_PESO[n.urgencia]), 0)

  const diferencia = pico(b) - pico(a)
  if (diferencia !== 0) return diferencia

  const afectada = Number(b.departments?.afectado ?? false) - Number(a.departments?.afectado ?? false)
  if (afectada !== 0) return afectada

  return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
}
