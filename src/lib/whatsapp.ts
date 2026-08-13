import { cifra } from './formato'
import type { Coincidencia, Punto } from './tipos'

// ============================================================================
// Enlaces de contacto.
//
// Aquí no hay chat interno a propósito: quien coordina un punto de acopio está
// con el teléfono en la mano, no revisando una bandeja de entrada de una web
// que acaba de conocer. WhatsApp es el canal que ya usa.
//
// El mensaje va prellenado con todo lo que la otra persona necesita para
// responder en un solo mensaje: qué, cuánto, desde dónde y si hay transporte.
// ============================================================================

/** Normaliza a formato internacional colombiano para wa.me. */
export function telefonoWhatsapp(numero: string | null | undefined): string | null {
  if (!numero) return null
  const digitos = numero.replace(/\D/g, '')
  if (digitos.length === 0) return null

  // Celular colombiano de 10 dígitos → se le agrega el indicativo 57.
  if (digitos.length === 10 && digitos.startsWith('3')) return `57${digitos}`
  if (digitos.startsWith('57') && digitos.length >= 12) return digitos
  // Fijos de 7 dígitos no sirven para WhatsApp.
  if (digitos.length < 10) return null
  return digitos
}

export function enlaceWhatsapp(numero: string | null | undefined, mensaje: string): string | null {
  const tel = telefonoWhatsapp(numero)
  if (!tel) return null
  return `https://wa.me/${tel}?text=${encodeURIComponent(mensaje)}`
}

export interface DatosOferta {
  categoriaNombre: string
  cantidad: number
  unidad: string
  ciudadOrigen: string
  transporte: boolean
}

/** Mensaje para coordinar una entrega concreta contra una necesidad detectada. */
export function mensajeCoordinacion(m: Coincidencia, oferta: DatosOferta): string {
  const lineas = [
    `Hola, escribo por la página Ayuda Terremoto Colombia.`,
    ``,
    `Tengo ${cifra(oferta.cantidad)} ${oferta.unidad} de ${oferta.categoriaNombre.toLowerCase()} en ${oferta.ciudadOrigen}.`,
    `Vi que en ${m.punto} (${m.ciudad}) están recibiendo ${m.categoria_nombre.toLowerCase()}.`,
  ]

  if (m.faltante !== null) {
    lineas.push(`La página indica que faltan ${cifra(m.faltante)} ${m.unidad}.`)
  }

  lineas.push(
    oferta.transporte
      ? `Cuento con transporte para llevarlo.`
      : `No tengo transporte, necesitaría coordinar la entrega o una recogida.`,
    ``,
    `¿Sigue vigente la necesidad? ¿En qué horario puedo llegar?`,
  )

  return lineas.join('\n')
}

/** Mensaje genérico desde la ficha de un punto, sin oferta de por medio. */
export function mensajePunto(punto: Punto): string {
  return [
    `Hola, escribo por la página Ayuda Terremoto Colombia.`,
    ``,
    `Quiero llevar una donación a ${punto.nombre}${punto.direccion ? ` (${punto.direccion})` : ''} en ${punto.ciudad}.`,
    `¿Qué están necesitando hoy y en qué horario puedo llegar?`,
  ].join('\n')
}

/** Enlace a la app de mapas del dispositivo, con dirección o coordenadas. */
export function enlaceMapa(punto: {
  nombre: string
  direccion: string | null
  ciudad: string
  lat: number | null
  lng: number | null
}): string {
  if (punto.direccion) {
    const consulta = `${punto.direccion}, ${punto.ciudad}, Colombia`
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(consulta)}`
  }
  if (punto.lat !== null && punto.lng !== null) {
    return `https://www.google.com/maps/search/?api=1&query=${punto.lat},${punto.lng}`
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${punto.nombre}, ${punto.ciudad}, Colombia`)}`
}
