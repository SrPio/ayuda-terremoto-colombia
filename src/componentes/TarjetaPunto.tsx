import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { MapPin, Truck } from 'lucide-react'
import { URGENCIA_COLOR, URGENCIA_PESO, faltanteTexto } from '@/lib/formato'
import { useFila } from '@/lib/movimiento'
import { Insignia, SelloFrescura } from './ui'
import type { Categoria, Punto, Urgencia } from '@/lib/tipos'

// ============================================================================
// Tarjeta de punto de acopio.
//
// Ordena la información por lo que la persona necesita decidir, en este orden:
// qué necesitan aquí → dónde queda → qué tan confiable es el dato. El nombre
// del punto va antes que la organización porque es lo que la gente busca.
//
// El canto izquierdo lleva el color de la urgencia más alta del punto: permite
// barrer una lista larga y ver dónde apremia sin leer una palabra.
// ============================================================================

export function TarjetaPunto({
  punto,
  categorias,
}: {
  punto: Punto
  categorias: Map<string, Categoria>
}) {
  const fila = useFila()
  const activas = punto.point_needs.filter((n) => n.activa)

  const urgenciaMaxima = activas.reduce<Urgencia>(
    (max, n) => (URGENCIA_PESO[n.urgencia] > URGENCIA_PESO[max] ? n.urgencia : max),
    'baja',
  )
  const color = activas.length > 0 ? URGENCIA_COLOR[urgenciaMaxima] : 'var(--color-line-fuerte)'

  return (
    <motion.article variants={fila} className="panel relative overflow-hidden">
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{ backgroundColor: color }}
      />

      <div className="flex flex-col gap-3 p-4 pl-5 sm:p-5 sm:pl-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="display-ancho text-[1.0625rem] leading-tight font-bold">
              <Link to={`/puntos/${punto.slug}`} className="hover:subrayado-signal">
                {punto.nombre}
              </Link>
            </h3>
            <p className="text-muted mt-1 flex flex-wrap items-center gap-x-1.5 text-[0.875rem]">
              <MapPin aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
              <span>
                {punto.ciudad}
                {punto.departments?.nombre ? `, ${punto.departments.nombre}` : ''}
              </span>
            </p>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-1.5">
            {punto.verificado && <Insignia tono="verificado">Verificado</Insignia>}
            {punto.acepta_transporte_grande && (
              <Insignia>
                <Truck aria-hidden="true" className="h-3 w-3" />
                Recibe camión
              </Insignia>
            )}
          </div>
        </div>

        {punto.organizacion && (
          <p className="text-muted text-[0.8125rem]">{punto.organizacion}</p>
        )}

        {activas.length > 0 ? (
          <ul className="flex flex-col gap-1.5">
            {activas
              .slice()
              .sort((a, b) => URGENCIA_PESO[b.urgencia] - URGENCIA_PESO[a.urgencia])
              .slice(0, 4)
              .map((n) => {
                const cat = categorias.get(n.category_slug)
                return (
                  <li key={n.id} className="flex flex-wrap items-baseline gap-x-2 text-[0.875rem]">
                    <span aria-hidden="true">{cat?.emoji ?? '📦'}</span>
                    <span className="font-medium">{cat?.nombre ?? n.category_slug}</span>
                    <span
                      data-cifra
                      className="font-mono text-[0.75rem]"
                      style={{ color: URGENCIA_COLOR[n.urgencia] }}
                    >
                      {faltanteTexto(n.cantidad_solicitada, n.cantidad_cubierta, n.unidad)}
                    </span>
                  </li>
                )
              })}
            {activas.length > 4 && (
              <li className="text-muted font-mono text-[0.75rem]">
                y {activas.length - 4} más
              </li>
            )}
          </ul>
        ) : (
          <p className="text-muted text-[0.875rem]">
            Sin necesidades registradas. Confirma con el punto antes de llevar algo.
          </p>
        )}

        <div className="border-line mt-1 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
          <SelloFrescura actualizado={punto.updated_at} />
          <Link
            to={`/puntos/${punto.slug}`}
            className="font-mono text-eyebrow tracking-[0.12em] uppercase hover:subrayado-signal"
          >
            Ver punto →
          </Link>
        </div>
      </div>
    </motion.article>
  )
}
