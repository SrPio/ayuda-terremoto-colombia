// ============================================================================
// _shared/seguridad.ts
//
// Utilidades comunes a las dos Edge Functions. Todo lo que protege la base sin
// pedirle una cuenta a nadie vive aquí.
// ============================================================================

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0'

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-moderator-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export function json(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' },
  })
}

export function error(mensaje: string, status = 400, extra?: Record<string, unknown>): Response {
  return json({ ok: false, error: mensaje, ...extra }, status)
}

/**
 * Cliente con service_role. Omite RLS por definición, así que solo puede
 * existir aquí dentro: esta llave nunca sale del servidor.
 */
export function clienteAdmin(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { persistSession: false } })
}

/** IP de origen, según las cabeceras que pone el borde de Supabase. */
export function ipDe(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('cf-connecting-ip') ||
    'desconocida'
  )
}

/**
 * Hash de la IP con sal secreta.
 *
 * Guardamos el hash y no la IP a propósito: alcanza perfectamente para contar
 * "cuántos envíos hizo este visitante en la última hora", y no construye un
 * registro de quién estuvo mirando puntos de acopio. En una emergencia la
 * gente no debería pagar con privacidad por ayudar.
 */
export async function hashIp(ip: string): Promise<string> {
  const sal = Deno.env.get('IP_HASH_SALT')
  if (!sal) throw new Error('Falta el secreto IP_HASH_SALT')

  const clave = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(sal),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const firma = await crypto.subtle.sign('HMAC', clave, new TextEncoder().encode(ip))

  return Array.from(new Uint8Array(firma))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Comparación en tiempo constante.
 *
 * Un `a === b` sobre secretos termina antes en cuanto encuentra el primer
 * carácter distinto, y esa diferencia de tiempo es medible: permite adivinar la
 * clave carácter por carácter. Esto compara siempre el total.
 */
export function igualdadSegura(a: string, b: string): boolean {
  const ba = new TextEncoder().encode(a)
  const bb = new TextEncoder().encode(b)
  // Longitudes distintas: se sigue comparando igual para no filtrar el largo.
  let diff = ba.length ^ bb.length
  const n = Math.max(ba.length, bb.length)
  for (let i = 0; i < n; i++) {
    diff |= (ba[i] ?? 0) ^ (bb[i] ?? 0)
  }
  return diff === 0
}

export interface ResultadoLimite {
  permitido: boolean
  intentos: number
  limite: number
}

/** Cuenta un intento y dice si todavía está dentro del límite de la ventana. */
export async function registrarIntento(
  admin: SupabaseClient,
  ipHash: string,
  kind: string,
  limite: number,
): Promise<ResultadoLimite> {
  const { data, error: err } = await admin
    .rpc('registrar_intento', { p_ip_hash: ipHash, p_kind: kind, p_limite: limite })
    .single()

  // Si el contador falla, se deja pasar la petición. Perder un aporte legítimo
  // durante una emergencia es peor que dejar pasar un envío de más.
  if (err || !data) return { permitido: true, intentos: 0, limite }

  return data as ResultadoLimite
}

/**
 * Verifica el captcha de Cloudflare Turnstile.
 * Si TURNSTILE_SECRET no está configurado, el paso se omite: el proyecto debe
 * poder desplegarse y funcionar sin una cuenta de Cloudflare.
 */
export async function verificarTurnstile(token: unknown, ip: string): Promise<boolean> {
  const secreto = Deno.env.get('TURNSTILE_SECRET')
  if (!secreto) return true
  if (typeof token !== 'string' || token.length === 0) return false

  const cuerpo = new FormData()
  cuerpo.append('secret', secreto)
  cuerpo.append('response', token)
  if (ip) cuerpo.append('remoteip', ip)

  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: cuerpo,
    })
    const datos = (await res.json()) as { success?: boolean }
    return datos.success === true
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Validación
//
// A mano y no con una librería: son cinco formularios, las reglas caben en una
// pantalla y así la función no arrastra dependencias que haya que auditar.
// ---------------------------------------------------------------------------

export class ErrorValidacion extends Error {}

const CONTROL = new RegExp('[\u0000-\u001F\u007F]', 'g')
const DIACRITICOS = new RegExp('[\u0300-\u036F]', 'g')

export function texto(
  valor: unknown,
  { min = 0, max = 500, requerido = false, campo = 'campo', multilinea = false } = {},
): string | null {
  if (valor === null || valor === undefined || valor === '') {
    if (requerido) throw new ErrorValidacion(`Falta ${campo}`)
    return null
  }
  if (typeof valor !== 'string') throw new ErrorValidacion(`${campo} debe ser texto`)

  // Se neutralizan caracteres de control, que solo aparecen en payloads armados.
  //
  // Con `multilinea` se parte primero por saltos de línea y se limpia cada línea
  // por separado, de modo que los saltos sobreviven al filtro. Los campos de
  // texto largo —el mensaje al punto, el comentario de un reporte, la
  // descripción de un sitio— se escriben en párrafos, y aplanarlos deja a la
  // moderación leyendo un muro de texto.
  const limpio = multilinea
    ? valor
        .split('\n')
        .map((linea) => linea.replace(CONTROL, '').replace(/[ \t]+/g, ' ').trim())
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
    : valor.replace(CONTROL, '').trim().replace(/\s+/g, ' ')

  if (limpio.length === 0) {
    if (requerido) throw new ErrorValidacion(`Falta ${campo}`)
    return null
  }
  if (limpio.length < min) throw new ErrorValidacion(`${campo} es demasiado corto`)
  if (limpio.length > max) throw new ErrorValidacion(`${campo} supera ${max} caracteres`)

  return limpio
}

export function numero(
  valor: unknown,
  { min = 0, max = 1_000_000_000, requerido = false, campo = 'cantidad' } = {},
): number | null {
  if (valor === null || valor === undefined || valor === '') {
    if (requerido) throw new ErrorValidacion(`Falta ${campo}`)
    return null
  }
  const n = typeof valor === 'number' ? valor : Number(valor)
  if (!Number.isFinite(n)) throw new ErrorValidacion(`${campo} debe ser un número`)
  if (n < min || n > max) throw new ErrorValidacion(`${campo} está fuera de rango`)
  return n
}

export function booleano(valor: unknown): boolean {
  return valor === true || valor === 'true' || valor === 1 || valor === '1'
}

export function telefono(valor: unknown, campo = 'teléfono'): string | null {
  const t = texto(valor, { max: 40, campo })
  if (!t) return null
  const limpio = t.replace(/[^\d+]/g, '')
  if (limpio.replace(/\D/g, '').length < 7) {
    throw new ErrorValidacion(`El ${campo} no parece completo`)
  }
  return limpio
}

export function correo(valor: unknown): string | null {
  const t = texto(valor, { max: 160, campo: 'correo' })
  if (!t) return null
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(t)) {
    throw new ErrorValidacion('El correo no tiene un formato válido')
  }
  return t.toLowerCase()
}

export function unaDe<T extends string>(valor: unknown, opciones: readonly T[], campo: string): T {
  if (typeof valor !== 'string' || !opciones.includes(valor as T)) {
    throw new ErrorValidacion(`${campo} no es un valor permitido`)
  }
  return valor as T
}

/** Convierte un nombre en slug estable y único para URLs. */
export function slugificar(nombre: string, sufijo: string): string {
  const base = nombre
    .normalize('NFD')
    .replace(DIACRITICOS, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return `${base || 'punto'}-${sufijo}`
}

/**
 * Defensas de formulario que no le piden nada a la persona:
 *  - honeypot: un campo invisible que un humano nunca llena y un bot sí,
 *  - tiempo mínimo: un formulario enviado en menos de 3 segundos no lo llenó
 *    nadie leyendo.
 */
export function revisarTrampas(cuerpo: Record<string, unknown>): string | null {
  if (typeof cuerpo.website === 'string' && cuerpo.website.trim() !== '') {
    return 'honeypot'
  }
  const abierto = Number(cuerpo.abierto_en)
  if (Number.isFinite(abierto) && abierto > 0) {
    const segundos = (Date.now() - abierto) / 1000
    if (segundos < 3) return 'demasiado rápido'
    if (segundos > 60 * 60 * 6) return 'formulario vencido'
  }
  return null
}
