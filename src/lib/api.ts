import { SUPABASE_ANON_KEY, SUPABASE_URL } from './supabase'
import type { Colas } from './tipos'

// ============================================================================
// Escritura y moderación — vía Edge Functions.
//
// El cliente de Supabase no puede escribir nada (RLS solo concede lectura), así
// que todo aporte pasa por la función `submit`, que valida, verifica el captcha
// y aplica el límite por IP antes de guardar como pendiente.
// ============================================================================

const BASE = `${SUPABASE_URL}/functions/v1`

export type TipoAporte = 'nuevo_punto' | 'edicion' | 'eliminacion' | 'reporte' | 'oferta_donacion'

export interface RespuestaAporte {
  ok: boolean
  mensaje?: string
  error?: string
  id?: string
}

/**
 * Campos anti-bot que acompañan cada envío.
 *  - website: honeypot. Va oculto en el formulario; un humano nunca lo llena.
 *  - abierto_en: cuándo se abrió el formulario. Menos de 3 segundos = bot.
 */
export interface CamposTrampa {
  website: string
  abierto_en: number
}

export function camposTrampaIniciales(): CamposTrampa {
  return { website: '', abierto_en: Date.now() }
}

async function pedir<T>(
  ruta: string,
  cuerpo: unknown,
  cabecerasExtra: Record<string, string> = {},
): Promise<T> {
  let respuesta: Response
  try {
    respuesta = await fetch(`${BASE}/${ruta}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // La anon key identifica el proyecto ante la puerta de Supabase; la
        // autorización real la hace cada función por dentro.
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        apikey: SUPABASE_ANON_KEY,
        ...cabecerasExtra,
      },
      body: JSON.stringify(cuerpo),
    })
  } catch {
    throw new Error('No hay conexión. Revisa tu red e intenta de nuevo.')
  }

  let datos: unknown = null
  try {
    datos = await respuesta.json()
  } catch {
    // Respuesta sin cuerpo: se maneja abajo con el status.
  }

  if (!respuesta.ok) {
    const mensaje =
      (datos as { error?: string } | null)?.error ??
      (respuesta.status === 429
        ? 'Demasiados envíos desde esta conexión. Intenta más tarde.'
        : 'No pudimos completar la operación.')
    throw new Error(mensaje)
  }

  return datos as T
}

export function enviarAporte(
  tipo: TipoAporte,
  datos: Record<string, unknown>,
  trampas: CamposTrampa,
  turnstileToken?: string,
): Promise<RespuestaAporte> {
  return pedir<RespuestaAporte>('submit', {
    tipo,
    datos,
    website: trampas.website,
    abierto_en: trampas.abierto_en,
    turnstile_token: turnstileToken,
  })
}

// --- Moderación ------------------------------------------------------------

export type AccionModeracion =
  | 'colas'
  | 'aprobar_punto'
  | 'rechazar_punto'
  | 'inactivar_punto'
  | 'reactivar_punto'
  | 'actualizar_punto'
  | 'aplicar_edicion'
  | 'rechazar_solicitud'
  | 'resolver_reporte'
  | 'guardar_necesidad'
  | 'eliminar_necesidad'

/**
 * La clave de moderador solo existe en sessionStorage y en la cabecera de esta
 * petición. Nunca se guarda en el código, ni en el bundle, ni en localStorage
 * (que sobrevive al cierre del navegador).
 */
export function moderar<T = { ok: true; mensaje: string }>(
  accion: AccionModeracion,
  datos: Record<string, unknown>,
  clave: string,
): Promise<T> {
  return pedir<T>('moderate', { accion, datos }, { 'x-moderator-key': clave })
}

export function cargarColas(clave: string): Promise<Colas> {
  return moderar<Colas>('colas', {}, clave)
}
