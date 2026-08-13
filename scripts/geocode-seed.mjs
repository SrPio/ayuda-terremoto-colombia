#!/usr/bin/env node
/**
 * geocode-seed.mjs — refina las coordenadas del seed con Nominatim (OpenStreetMap).
 *
 * Por qué existe: el artículo fuente publica direcciones en texto
 * ("Carrera 52 #30A-97"), no coordenadas. El seed arranca con el centro de
 * cada ciudad, que sirve para el mapa a escala de país pero no para que
 * alguien encuentre la puerta. Este script consulta Nominatim una sola vez,
 * en tiempo de desarrollo, e imprime un SQL con las coordenadas encontradas.
 *
 * Nunca se llama desde la app en producción: las coordenadas quedan congeladas
 * en la base. Así no dependemos de un servicio externo cuando alguien está
 * buscando dónde llevar agua.
 *
 * Uso:
 *   node scripts/geocode-seed.mjs                 # imprime el SQL por stdout
 *   node scripts/geocode-seed.mjs > coords.sql    # y lo guarda
 *
 * Nominatim exige un User-Agent identificable y máximo 1 petición por segundo.
 * Ambas cosas se respetan abajo. https://operations.osmfoundation.org/policies/nominatim/
 */

import { readFile } from 'node:fs/promises'
import path from 'node:path'

const RAIZ = path.resolve(import.meta.dirname, '..')
const SEED = path.join(RAIZ, 'supabase', 'migrations', '0004_seed.sql')
const USER_AGENT =
  'ayuda-terremoto-colombia/1.0 (proyecto open source de ayuda humanitaria; https://github.com/SrPio/ayuda-terremoto-colombia)'
const ESPERA_MS = 1100

/** Extrae del seed los puntos que tienen dirección publicada. */
async function leerPuntosConDireccion() {
  const sql = await readFile(SEED, 'utf8')
  const puntos = []

  // Se recorta al bloque de collection_points. Sin esto, las filas de
  // need_categories también tienen cinco cadenas seguidas y el patrón las
  // tomaría por direcciones.
  const desde = sql.indexOf('insert into public.collection_points')
  const hasta = sql.indexOf('insert into public.point_needs')
  if (desde === -1 || hasta === -1) {
    throw new Error('No se encontró el bloque de collection_points en el seed')
  }
  const bloque = sql.slice(desde, hasta)

  // Cada punto del seed arranca con ('slug', 'Nombre', 'departamento',
  // 'Ciudad', 'Dirección' | null, ...
  const patron =
    /\('([a-z0-9-]+)',\s*'((?:[^']|'')+)',\s*'([a-z-]+)',\s*'((?:[^']|'')+)',\s*'((?:[^']|'')+)'/g

  for (const m of bloque.matchAll(patron)) {
    const [, slug, nombre, departamento, ciudad, direccion] = m
    puntos.push({
      slug,
      nombre: nombre.replaceAll("''", "'"),
      departamento,
      ciudad: ciudad.replaceAll("''", "'"),
      direccion: direccion.replaceAll("''", "'"),
    })
  }

  return puntos
}

async function geocodificar(consulta) {
  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('q', consulta)
  url.searchParams.set('countrycodes', 'co')
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('limit', '1')

  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (!res.ok) throw new Error(`Nominatim respondió ${res.status}`)

  const [primero] = await res.json()
  if (!primero) return null

  const lat = Number(primero.lat)
  const lng = Number(primero.lon)

  // Guardia mínima: si el resultado cae fuera de Colombia continental, se
  // descarta. Un match malo es peor que no tener match.
  if (lat < -5 || lat > 14 || lng < -82 || lng > -66) return null

  return { lat, lng, etiqueta: primero.display_name }
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const puntos = await leerPuntosConDireccion()
  process.stderr.write(`Puntos con dirección publicada: ${puntos.length}\n\n`)

  const lineas = [
    '-- Coordenadas refinadas con Nominatim (OpenStreetMap).',
    `-- Generado por scripts/geocode-seed.mjs. Revisar antes de aplicar.`,
    '',
  ]
  let encontrados = 0

  for (const [i, punto] of puntos.entries()) {
    const consulta = `${punto.direccion}, ${punto.ciudad}, Colombia`
    process.stderr.write(`[${i + 1}/${puntos.length}] ${punto.slug} … `)

    try {
      const r = await geocodificar(consulta)
      if (r) {
        encontrados++
        process.stderr.write(`${r.lat}, ${r.lng}\n`)
        lineas.push(
          `-- ${punto.nombre} → ${r.etiqueta}`,
          `update public.collection_points set lat = ${r.lat}, lng = ${r.lng} where slug = '${punto.slug}';`,
          '',
        )
      } else {
        process.stderr.write('sin resultado, queda en el centro de la ciudad\n')
      }
    } catch (err) {
      process.stderr.write(`error: ${err.message}\n`)
    }

    if (i < puntos.length - 1) await esperar(ESPERA_MS)
  }

  process.stderr.write(
    `\nResueltos ${encontrados} de ${puntos.length}. El resto conserva el centro de su ciudad.\n`,
  )
  process.stdout.write(lineas.join('\n'))
}

main().catch((err) => {
  process.stderr.write(`\nFalló: ${err.message}\n`)
  process.exit(1)
})
