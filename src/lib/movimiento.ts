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

/** Pasos del asistente: entran por el lado hacia el que se avanza. */
export function usePasos() {
  const quieto = useReducedMotion()
  return {
    inicial: (direccion: number) => ({
      opacity: 0,
      x: quieto ? 0 : direccion * 36,
    }),
    animar: { opacity: 1, x: 0, transition: SUAVE },
    salir: (direccion: number) => ({
      opacity: 0,
      x: quieto ? 0 : direccion * -36,
      transition: RAPIDO,
    }),
  }
}
