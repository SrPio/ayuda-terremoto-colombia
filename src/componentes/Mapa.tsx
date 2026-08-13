import { useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import { URGENCIA_COLOR, URGENCIA_ETIQUETA, URGENCIA_PESO } from '@/lib/formato'
import type { Punto, Urgencia } from '@/lib/tipos'

// ============================================================================
// Mapa de puntos de acopio.
//
// Este módulo es el más pesado del proyecto, así que se carga en diferido
// (React.lazy) y va en su propio chunk: quien solo consulta la lista nunca lo
// descarga. Las teselas se cachean en el service worker, de modo que el mapa
// sigue mostrando algo con mala señal.
//
// OpenStreetMap y no un proveedor con API key: sin llaves, sin cuotas y sin
// tarjeta de crédito, para que cualquiera pueda desplegar su propia copia.
// ============================================================================

const CENTRO_COLOMBIA: [number, number] = [4.6, -74.3]

/** Marcador circular con el color de la urgencia más apremiante del punto. */
function iconoPunto(urgencia: Urgencia | null, emoji: string) {
  const color = urgencia ? URGENCIA_COLOR[urgencia] : 'var(--color-line-fuerte)'
  return L.divIcon({
    className: '',
    html: `<div class="marcador-acopio" style="width:28px;height:28px;background:${color}">${emoji}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16],
  })
}

function escapar(texto: string): string {
  const div = document.createElement('div')
  div.textContent = texto
  return div.innerHTML
}

function Marcadores({ puntos }: { puntos: Punto[] }) {
  const mapa = useMap()

  useEffect(() => {
    const grupo = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 46,
      iconCreateFunction: (cluster) =>
        L.divIcon({
          className: '',
          html: `<div class="cluster-acopio" style="width:34px;height:34px">${cluster.getChildCount()}</div>`,
          iconSize: [34, 34],
        }),
    })

    for (const punto of puntos) {
      if (punto.lat === null || punto.lng === null) continue

      const activas = punto.point_needs.filter((n) => n.activa)
      const urgencia = activas.length
        ? activas.reduce<Urgencia>(
            (max, n) => (URGENCIA_PESO[n.urgencia] > URGENCIA_PESO[max] ? n.urgencia : max),
            'baja',
          )
        : null

      const marcador = L.marker([punto.lat, punto.lng], {
        icon: iconoPunto(urgencia, activas.length ? '' : '·'),
        title: punto.nombre,
        alt: punto.nombre,
      })

      const necesidades = activas
        .slice(0, 4)
        .map((n) => escapar(n.category_slug.replace(/-/g, ' ')))
        .join(' · ')

      marcador.bindPopup(
        `<div style="padding:12px 14px">
           <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:${
             urgencia ? URGENCIA_COLOR[urgencia] : 'var(--color-muted)'
           }">${urgencia ? escapar(URGENCIA_ETIQUETA[urgencia]) : 'Sin datos'}</div>
           <div style="font-family:Archivo,sans-serif;font-weight:700;font-size:15px;line-height:1.15;margin-top:4px">${escapar(
             punto.nombre,
           )}</div>
           <div style="font-size:13px;color:var(--color-muted);margin-top:2px">${escapar(punto.ciudad)}</div>
           ${
             necesidades
               ? `<div style="font-size:12px;margin-top:8px;text-transform:capitalize">${necesidades}</div>`
               : ''
           }
           <a href="/puntos/${escapar(punto.slug)}"
              style="display:inline-block;margin-top:10px;font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--color-ink);text-decoration:underline;text-decoration-color:var(--color-signal);text-decoration-thickness:2px;text-underline-offset:3px">Ver punto →</a>
         </div>`,
        { closeButton: false },
      )

      grupo.addLayer(marcador)
    }

    mapa.addLayer(grupo)

    // Encuadre automático a los puntos visibles: si alguien filtró por Risaralda,
    // el mapa va a Risaralda en vez de dejarlo buscando.
    const conCoordenadas = puntos.filter((p) => p.lat !== null && p.lng !== null)
    if (conCoordenadas.length > 1) {
      mapa.fitBounds(
        L.latLngBounds(conCoordenadas.map((p) => [p.lat!, p.lng!] as [number, number])),
        { padding: [40, 40], maxZoom: 12 },
      )
    } else if (conCoordenadas.length === 1) {
      mapa.setView([conCoordenadas[0].lat!, conCoordenadas[0].lng!], 13)
    }

    return () => {
      mapa.removeLayer(grupo)
    }
  }, [mapa, puntos])

  return null
}

export default function Mapa({ puntos, altura = 460 }: { puntos: Punto[]; altura?: number }) {
  // Los puntos sin coordenadas no se pueden dibujar; se informa aparte para no
  // dar la impresión de que el mapa muestra todo.
  const conCoordenadas = useMemo(
    () => puntos.filter((p) => p.lat !== null && p.lng !== null),
    [puntos],
  )
  const sinCoordenadas = puntos.length - conCoordenadas.length

  return (
    <div className="panel overflow-hidden">
      <MapContainer
        center={CENTRO_COLOMBIA}
        zoom={5}
        scrollWheelZoom={false}
        style={{ height: altura, width: '100%' }}
        attributionControl
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          maxZoom={19}
        />
        <Marcadores puntos={conCoordenadas} />
      </MapContainer>

      {sinCoordenadas > 0 && (
        <p className="border-line text-muted border-t px-4 py-2.5 font-mono text-[0.6875rem] tracking-wide uppercase">
          {sinCoordenadas} {sinCoordenadas === 1 ? 'punto' : 'puntos'} sin ubicación exacta ·{' '}
          {sinCoordenadas === 1 ? 'aparece' : 'aparecen'} solo en la lista
        </p>
      )}
    </div>
  )
}
