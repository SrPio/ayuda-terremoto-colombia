import { createClient } from '@supabase/supabase-js'

// ============================================================================
// Cliente de Supabase — SOLO LECTURA.
//
// Esta llave es pública por diseño: viaja en el bundle y cualquiera puede
// leerla. Eso está bien porque las políticas de RLS solo le conceden SELECT
// sobre puntos aprobados y sus necesidades. No existe ninguna política de
// escritura para el rol anónimo, así que con esta llave no se puede alterar
// nada, ni siquiera insertando a mano contra la API REST.
//
// Toda la escritura va por las Edge Functions (ver src/lib/api.ts).
// ============================================================================

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    'Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. Copia .env.example a .env y completa los valores.',
  )
}

export const supabase = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { headers: { 'x-aplicacion': 'ayuda-terremoto-colombia' } },
})

export const SUPABASE_URL = url
export const SUPABASE_ANON_KEY = anonKey
