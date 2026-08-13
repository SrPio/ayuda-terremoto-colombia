import { useReducedMotion, type Transition, type Variants } from 'motion/react'

// ============================================================================
// Movimiento.
//
// Una sola curva y tres duraciones para todo el producto. El movimiento aquí
// tiene un trabajo concreto: mostrar de dónde salió cada cosa (los resultados
// del asistente entran desde donde estaba el formulario) y dejar claro qué
// acaba de cambiar. Nada gira, nada rebota, nada llama la atención sobre sí
// mismo.
//
// Todo se apaga cuando el sistema pide menos movimiento: el CSS corta las
// transiciones y estos hooks devuelven variantes sin desplazamiento, porque
// las animaciones de Motion son JavaScript y la media query no las alcanza.
// ============================================================================

export const SUAVE: Transition = { duration: 0.42, ease: [0.22, 1, 0.36, 1] }
export const RAPIDO: Transition = { duration: 0.22, ease: [0.22, 1, 0.36, 1] }

/** Entrada estándar: sube 12px y aparece. */
export function useEntrada(): Variants {
  const quieto = useReducedMotion()
  return {
    oculto: { opacity: 0, y: quieto ? 0 : 12 },
    visible: { opacity: 1, y: 0, transition: SUAVE },
  }
}

/**
 * Lista escalonada. El retraso entre filas hace legible el orden de la
 * información: en el manifiesto de la portada, lo más urgente aparece primero.
 */
export function useCascada(retraso = 0.05): Variants {
  const quieto = useReducedMotion()
  return {
    oculto: {},
    visible: {
      transition: { staggerChildren: quieto ? 0 : retraso, delayChildren: quieto ? 0 : 0.04 },
    },
  }
}

export function useFila(): Variants {
  const quieto = useReducedMotion()
  return {
    oculto: { opacity: 0, x: quieto ? 0 : -10 },
    visible: { opacity: 1, x: 0, transition: SUAVE },
  }
}

/**
 * Pasos del asistente: entran por el lado hacia el que se avanza.
 *
 * Devuelve props directas (initial/animate/exit) en vez de variantes con
 * función y `custom`. La versión con variantes dinámicas dejaba a
 * `AnimatePresence mode="wait"` esperando un `onExitComplete` que nunca
 * llegaba: el paso viejo se quedaba en pantalla con el estado ya avanzado, y el
 * asistente se trababa después de la primera pregunta. Props planas no tienen
 * ese problema y el código se lee mejor.
 */
export function usePasos(direccion: number) {
  const quieto = useReducedMotion()
  const desplazamiento = quieto ? 0 : 36

  return {
    initial: { opacity: 0, x: direccion * desplazamiento },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: direccion * -desplazamiento },
    transition: SUAVE,
  }
}
