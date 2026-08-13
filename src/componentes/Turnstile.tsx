import { useEffect, useRef } from 'react'
import { TURNSTILE_SITE_KEY } from '@/lib/config'

// ============================================================================
// Cloudflare Turnstile — captcha invisible.
//
// Es opcional por diseño: si VITE_TURNSTILE_TURNSTILE_SITE_KEY no está definida, este
// componente no renderiza nada y la Edge Function omite la verificación. El
// proyecto tiene que poder clonarse y desplegarse sin obligar a nadie a abrir
// una cuenta de Cloudflare.
//
// Cuando sí está configurado, no le pide nada a la persona: resuelve el reto en
// segundo plano y entrega un token que viaja con el formulario.
// ============================================================================

const SCRIPT_ID = 'turnstile-script'

interface TurnstileAPI {
  render: (
    contenedor: HTMLElement,
    opciones: {
      sitekey: string
      callback: (token: string) => void
      'error-callback'?: () => void
      'expired-callback'?: () => void
      theme?: 'light' | 'dark' | 'auto'
      size?: 'normal' | 'flexible' | 'compact'
    },
  ) => string
  remove: (id: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileAPI
  }
}

function cargarScript(): Promise<void> {
  return new Promise((resolver, rechazar) => {
    if (window.turnstile) return resolver()

    const existente = document.getElementById(SCRIPT_ID)
    if (existente) {
      existente.addEventListener('load', () => resolver())
      existente.addEventListener('error', () => rechazar(new Error('No cargó Turnstile')))
      return
    }

    const script = document.createElement('script')
    script.id = SCRIPT_ID
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
    script.async = true
    script.defer = true
    script.onload = () => resolver()
    script.onerror = () => rechazar(new Error('No cargó Turnstile'))
    document.head.appendChild(script)
  })
}

export function Turnstile({ onToken }: { onToken: (token: string | null) => void }) {
  const contenedor = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string | null>(null)

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return
    let vivo = true

    cargarScript()
      .then(() => {
        if (!vivo || !contenedor.current || !window.turnstile) return
        widgetId.current = window.turnstile.render(contenedor.current, {
          sitekey: TURNSTILE_SITE_KEY,
          callback: (token) => onToken(token),
          'error-callback': () => onToken(null),
          'expired-callback': () => onToken(null),
          theme: 'light',
          size: 'flexible',
        })
      })
      .catch(() => {
        // Si Cloudflare no responde, no bloqueamos el formulario: el resto de
        // las defensas (honeypot, tiempo mínimo, límite por IP) siguen activas.
        onToken(null)
      })

    return () => {
      vivo = false
      if (widgetId.current && window.turnstile) {
        window.turnstile.remove(widgetId.current)
        widgetId.current = null
      }
    }
    // El widget se monta una sola vez: onToken cambia en cada render del padre
    // y volver a renderizarlo reiniciaría el reto del captcha.
  }, [])

  if (!TURNSTILE_SITE_KEY) return null

  return <div ref={contenedor} className="min-h-[65px]" />
}
