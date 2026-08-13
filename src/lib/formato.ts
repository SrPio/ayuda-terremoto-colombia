import type { Urgencia } from './tipos'

// ============================================================================
// Formato y vocabulario compartido.
//
// Un solo lugar decide cómo se dice cada cosa en toda la app. Si "crítico" se
// escribe distinto en dos pantallas, la persona deja de confiar en la etiqueta.
// ============================================================================

const numeroCO = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 })

export function cifra(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return '—'
  return numeroCO.format(valor)
}

/** "hace 3 horas", "hace 2 días". La frescura del dato es información crítica. */
export function haceCuanto(iso: string | null | undefined): string {
  if (!iso) return 'sin fecha'
  const ms = Date.now() - new Date(iso).getTime()
  const minutos = Math.round(ms / 60000)

  if (minutos < 1) return 'ahora mismo'
  if (minutos < 60) return `hace ${minutos} min`

  const horas = Math.round(minutos / 60)
  if (horas < 24) return `hace ${horas} ${horas === 1 ? 'hora' : 'horas'}`

  const dias = Math.round(horas / 24)
  if (dias < 30) return `hace ${dias} ${dias === 1 ? 'día' : 'días'}`

  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
}

/**
 * Un dato de más de 72 horas se marca como "por verificar".
 * En una emergencia la información vieja no es neutra: manda gente a un lugar
 * que quizá ya cerró. Preferimos decir "no sabemos" a fingir que sí.
 */
export const HORAS_FRESCURA = 72

export function estaFresco(iso: string | null | undefined): boolean {
  if (!iso) return false
  return Date.now() - new Date(iso).getTime() < HORAS_FRESCURA * 3600 * 1000
}

export const URGENCIA_ETIQUETA: Record<Urgencia, string> = {
  critica: 'Crítico',
  alta: 'Alta',
  media: 'Media',
  baja: 'Baja',
}

/** Variable CSS con el color de la escala de urgencia. */
export const URGENCIA_COLOR: Record<Urgencia, string> = {
  critica: 'var(--color-critica)',
  alta: 'var(--color-alta)',
  media: 'var(--color-media)',
  baja: 'var(--color-baja)',
}

export const URGENCIA_PESO: Record<Urgencia, number> = {
  critica: 4,
  alta: 3,
  media: 2,
  baja: 1,
}

export const MOTIVO_REPORTE_ETIQUETA: Record<string, string> = {
  cerrado: 'El punto ya cerró',
  info_incorrecta: 'La información está incorrecta',
  duplicado: 'Está repetido con otro punto',
  ya_no_necesita: 'Ya no necesitan lo que aparece',
  saturado: 'Está saturado, no reciben más',
  otro: 'Otro motivo',
}

/**
 * Progreso de una necesidad, entre 0 y 1.
 * Devuelve null cuando no hay cantidad confirmada, porque en ese caso una
 * barra de progreso sería una invención.
 */
export function progreso(solicitada: number | null, cubierta: number | null): number | null {
  if (!solicitada || solicitada <= 0) return null
  return Math.min((cubierta ?? 0) / solicitada, 1)
}

/** "faltan 80 cajas" o "cantidad por confirmar". Nunca inventa una cifra. */
export function faltanteTexto(
  solicitada: number | null,
  cubierta: number | null,
  unidad: string,
): string {
  if (solicitada === null) return 'cantidad por confirmar'
  const falta = Math.max(solicitada - (cubierta ?? 0), 0)
  if (falta === 0) return 'necesidad cubierta'
  return `faltan ${cifra(falta)} ${unidad}`
}

export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(new RegExp('[\\u0300-\\u036F]', 'g'), '')
    .toLowerCase()
    .trim()
}
