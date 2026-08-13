import type { CSSProperties } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { Link } from 'react-router-dom'
import { URGENCIA_COLOR, URGENCIA_ETIQUETA, cifra, faltanteTexto, progreso } from '@/lib/formato'
import type { Urgencia } from '@/lib/tipos'

// ============================================================================
// ELEMENTO FIRMA — la línea de manifiesto.
//
// Se lee como un renglón de manifiesto de carga:
//
//   ▌ QUIBDÓ · 💧 AGUA · FALTAN 80 CAJAS · CRÍTICO
//   ▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁░░░░░░░░░░░░░░░░░░░
//
// La barra de la izquierda lleva el color de urgencia; las cifras van en
// monoespaciada porque son inventario; la regla del pie muestra lo cubierto
// contra lo solicitado, y solo aparece cuando hay una cantidad confirmada —
// una barra de progreso sobre un dato que no existe sería una invención.
//
// Se reutiliza en la portada, en el listado y en los resultados del asistente.
// Un solo objeto visual memorable, tres contextos.
// ============================================================================

export interface DatosManifiesto {
  lugar: string
  detalleLugar?: string | null
  emoji: string
  /** Se omite cuando el lugar ya es la categoría (por ejemplo en la ficha de un punto). */
  categoria?: string | null
  cantidadSolicitada: number | null
  cantidadCubierta: number | null
  unidad: string
  urgencia: Urgencia
  zonaAfectada?: boolean
  distanciaKm?: number | null
  enlace?: string
}

export function Manifiesto({
  datos,
  compacto = false,
}: {
  datos: DatosManifiesto
  compacto?: boolean
}) {
  const quieto = useReducedMotion()
  const avance = progreso(datos.cantidadSolicitada, datos.cantidadCubierta)
  const color = URGENCIA_COLOR[datos.urgencia]

  const contenido = (
    <div className="manifiesto" style={{ '--urgencia': color } as CSSProperties}>
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <span className="display-estrecho text-[0.9375rem] font-bold tracking-tight uppercase">
          {datos.lugar}
        </span>

        {datos.detalleLugar && (
          <span className="text-muted text-[0.8125rem]">{datos.detalleLugar}</span>
        )}

        <span aria-hidden="true" className="text-line-fuerte">
          ·
        </span>

        <span className="text-[0.875rem]">
          <span aria-hidden="true">{datos.emoji}</span>
          {datos.categoria && <span className="font-medium"> {datos.categoria}</span>}
        </span>

        <span aria-hidden="true" className="text-line-fuerte">
          ·
        </span>

        <span data-cifra className="font-mono text-dato font-medium" style={{ color }}>
          {faltanteTexto(datos.cantidadSolicitada, datos.cantidadCubierta, datos.unidad)}
        </span>

        <span
          className="font-mono text-eyebrow ml-auto font-medium tracking-[0.14em] uppercase"
          style={{ color }}
        >
          {URGENCIA_ETIQUETA[datos.urgencia]}
        </span>
      </div>

      {!compacto && (
        <div className="text-muted mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-[0.6875rem] tracking-wide uppercase">
          {datos.zonaAfectada && <span style={{ color: 'var(--color-critica)' }}>Zona afectada</span>}
          {typeof datos.distanciaKm === 'number' && <span>{cifra(datos.distanciaKm)} km</span>}
          {datos.cantidadSolicitada !== null && (
            <span>
              {cifra(datos.cantidadCubierta ?? 0)} de {cifra(datos.cantidadSolicitada)}{' '}
              {datos.unidad}
            </span>
          )}
        </div>
      )}

      {avance !== null && (
        <div
          className="regla-progreso mt-2"
          style={{ '--urgencia': color } as CSSProperties}
          role="img"
          aria-label={`${Math.round(avance * 100)} por ciento cubierto`}
        >
          <motion.span
            initial={{ scaleX: quieto ? avance : 0 }}
            animate={{ scaleX: avance }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            style={{ width: '100%' }}
          />
        </div>
      )}
    </div>
  )

  if (!datos.enlace) return contenido

  return (
    <Link
      to={datos.enlace}
      className="hover:bg-paper block rounded-[2px] py-1.5 transition-colors"
    >
      {contenido}
    </Link>
  )
}
