import type {
  ButtonHTMLAttributes,
  CSSProperties,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { AlertTriangle, Check, Info, Loader2, X } from 'lucide-react'
import { URGENCIA_COLOR, URGENCIA_ETIQUETA, estaFresco, haceCuanto } from '@/lib/formato'
import type { Urgencia } from '@/lib/tipos'

// ============================================================================
// Piezas compartidas de interfaz.
//
// Vocabulario: cada control dice exactamente lo que hace al usarlo, y conserva
// el mismo nombre durante todo el flujo. El botón que dice "Publicar el punto"
// produce el aviso "Punto enviado a revisión", no "Éxito".
// ============================================================================

// --- Etiquetas -------------------------------------------------------------

export function Eyebrow({ children, claro = false }: { children: ReactNode; claro?: boolean }) {
  return <span className={`eyebrow ${claro ? 'eyebrow-claro' : ''}`}>{children}</span>
}

export function EtiquetaUrgencia({ urgencia }: { urgencia: Urgencia }) {
  const color = URGENCIA_COLOR[urgencia]
  return (
    <span
      className="font-mono text-eyebrow inline-flex items-center gap-1.5 font-medium tracking-[0.14em] uppercase"
      style={{ color }}
    >
      <span
        aria-hidden="true"
        className="inline-block h-2 w-2 rounded-full"
        style={{ backgroundColor: color }}
      />
      {URGENCIA_ETIQUETA[urgencia]}
    </span>
  )
}

/**
 * Sello de frescura. Es una de las piezas más importantes de la app: un dato de
 * hace cuatro días no es un dato neutro, manda gente a un sitio que quizá ya
 * cerró. Cuando pasa el umbral, lo dice.
 */
export function SelloFrescura({ actualizado }: { actualizado: string | null | undefined }) {
  const fresco = estaFresco(actualizado)
  return (
    <span
      className="font-mono text-eyebrow inline-flex items-center gap-1.5 tracking-[0.1em] uppercase"
      style={{ color: fresco ? 'var(--color-verificado)' : 'var(--color-alta)' }}
      title={fresco ? undefined : 'Este dato lleva más de 72 horas sin confirmarse'}
    >
      <span
        aria-hidden="true"
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: 'currentColor' }}
      />
      {fresco ? `Actualizado ${haceCuanto(actualizado)}` : `Por verificar · ${haceCuanto(actualizado)}`}
    </span>
  )
}

export function Insignia({
  children,
  tono = 'neutro',
}: {
  children: ReactNode
  tono?: 'neutro' | 'verificado' | 'aviso'
}) {
  const estilos: Record<string, CSSProperties> = {
    neutro: { color: 'var(--color-muted)', borderColor: 'var(--color-line)' },
    verificado: { color: 'var(--color-verificado)', borderColor: 'currentColor' },
    aviso: { color: 'var(--color-alta)', borderColor: 'currentColor' },
  }
  return (
    <span
      className="font-mono text-eyebrow inline-flex items-center gap-1 border px-1.5 py-0.5 tracking-[0.1em] uppercase"
      style={estilos[tono]}
    >
      {children}
    </span>
  )
}

// --- Botones ---------------------------------------------------------------

type VarianteBoton = 'primario' | 'secundario' | 'fantasma' | 'peligro'

const BOTON_BASE =
  'inline-flex items-center justify-center gap-2 rounded-[2px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50'

const BOTON_VARIANTE: Record<VarianteBoton, string> = {
  primario: 'bg-ink text-mineral hover:bg-panel-alto',
  secundario: 'border border-line-fuerte bg-paper text-ink hover:border-ink',
  fantasma: 'text-muted hover:text-ink',
  peligro: 'border border-critica text-critica hover:bg-critica hover:text-paper',
}

export function Boton({
  children,
  variante = 'primario',
  cargando = false,
  className = '',
  tamano = 'normal',
  ...props
}: {
  children: ReactNode
  variante?: VarianteBoton
  cargando?: boolean
  tamano?: 'normal' | 'grande' | 'pequeno'
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const tamanos = {
    pequeno: 'px-2.5 py-1.5 text-[0.8125rem]',
    normal: 'px-4 py-2.5 text-[0.9375rem]',
    grande: 'px-6 py-3.5 text-base',
  }
  return (
    <button
      {...props}
      disabled={props.disabled || cargando}
      className={`${BOTON_BASE} ${BOTON_VARIANTE[variante]} ${tamanos[tamano]} ${className}`}
    >
      {cargando && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  )
}

// --- Campos de formulario --------------------------------------------------

function EnvolturaCampo({
  etiqueta,
  ayuda,
  error,
  requerido,
  htmlFor,
  children,
}: {
  etiqueta: string
  ayuda?: string
  error?: string
  requerido?: boolean
  htmlFor: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[0.875rem] font-medium">
        {etiqueta}
        {!requerido && <span className="text-muted-claro font-normal"> · opcional</span>}
      </label>
      {ayuda && <p className="text-muted text-[0.8125rem] leading-snug">{ayuda}</p>}
      {children}
      {error && (
        <p role="alert" className="text-critica text-[0.8125rem]">
          {error}
        </p>
      )}
    </div>
  )
}

const CONTROL =
  'w-full rounded-[2px] border border-line-fuerte bg-paper px-3 py-2.5 text-[0.9375rem] transition-colors placeholder:text-muted-claro focus:border-ink'

export function Campo({
  etiqueta,
  ayuda,
  error,
  requerido,
  id,
  ...props
}: {
  etiqueta: string
  ayuda?: string
  error?: string
  requerido?: boolean
  id: string
} & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <EnvolturaCampo
      etiqueta={etiqueta}
      ayuda={ayuda}
      error={error}
      requerido={requerido}
      htmlFor={id}
    >
      <input
        id={id}
        {...props}
        required={requerido}
        aria-invalid={error ? true : undefined}
        className={CONTROL}
      />
    </EnvolturaCampo>
  )
}

export function CampoTexto({
  etiqueta,
  ayuda,
  error,
  requerido,
  id,
  ...props
}: {
  etiqueta: string
  ayuda?: string
  error?: string
  requerido?: boolean
  id: string
} & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <EnvolturaCampo
      etiqueta={etiqueta}
      ayuda={ayuda}
      error={error}
      requerido={requerido}
      htmlFor={id}
    >
      <textarea
        id={id}
        rows={3}
        {...props}
        required={requerido}
        aria-invalid={error ? true : undefined}
        className={`${CONTROL} resize-y`}
      />
    </EnvolturaCampo>
  )
}

export function CampoSelect({
  etiqueta,
  ayuda,
  error,
  requerido,
  id,
  children,
  ...props
}: {
  etiqueta: string
  ayuda?: string
  error?: string
  requerido?: boolean
  id: string
  children: ReactNode
} & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <EnvolturaCampo
      etiqueta={etiqueta}
      ayuda={ayuda}
      error={error}
      requerido={requerido}
      htmlFor={id}
    >
      <select
        id={id}
        {...props}
        required={requerido}
        aria-invalid={error ? true : undefined}
        className={CONTROL}
      >
        {children}
      </select>
    </EnvolturaCampo>
  )
}

/** Honeypot: invisible para una persona, irresistible para un bot. */
export function CampoTrampa({
  valor,
  onChange,
}: {
  valor: string
  onChange: (v: string) => void
}) {
  return (
    <div aria-hidden="true" className="absolute h-0 w-0 overflow-hidden opacity-0">
      <label htmlFor="website">Sitio web</label>
      <input
        id="website"
        name="website"
        type="text"
        tabIndex={-1}
        autoComplete="off"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

// --- Avisos ----------------------------------------------------------------

export function Aviso({
  tono,
  children,
  onCerrar,
}: {
  tono: 'info' | 'exito' | 'error' | 'atencion'
  children: ReactNode
  onCerrar?: () => void
}) {
  const config = {
    info: { color: 'var(--color-muted)', Icono: Info },
    exito: { color: 'var(--color-verificado)', Icono: Check },
    error: { color: 'var(--color-critica)', Icono: AlertTriangle },
    atencion: { color: 'var(--color-alta)', Icono: AlertTriangle },
  }[tono]

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      role={tono === 'error' ? 'alert' : 'status'}
      className="flex items-start gap-2.5 border-l-2 bg-paper px-3.5 py-3 text-[0.875rem]"
      style={{ borderColor: config.color }}
    >
      <config.Icono
        aria-hidden="true"
        className="mt-0.5 h-4 w-4 shrink-0"
        style={{ color: config.color }}
      />
      <div className="flex-1 leading-snug">{children}</div>
      {onCerrar && (
        <button onClick={onCerrar} aria-label="Cerrar aviso" className="text-muted hover:text-ink">
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      )}
    </motion.div>
  )
}

// --- Estados vacíos y de carga ---------------------------------------------

export function SinResultados({
  titulo,
  children,
}: {
  titulo: string
  children?: ReactNode
}) {
  return (
    <div className="panel px-6 py-12 text-center">
      <p className="display-ancho text-lg font-bold">{titulo}</p>
      {children && <div className="text-muted mx-auto mt-2 max-w-md text-[0.9375rem]">{children}</div>}
    </div>
  )
}

export function Esqueleto({ filas = 3 }: { filas?: number }) {
  const quieto = useReducedMotion()
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-live="polite">
      <span className="sr-only">Cargando</span>
      {Array.from({ length: filas }).map((_, i) => (
        <motion.div
          key={i}
          className="panel h-24"
          animate={quieto ? undefined : { opacity: [0.45, 0.8, 0.45] }}
          transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.12 }}
        />
      ))}
    </div>
  )
}

export function ErrorCarga({ mensaje }: { mensaje?: string }) {
  return (
    <Aviso tono="error">
      No pudimos cargar la información. {mensaje ?? 'Revisa tu conexión y recarga la página.'}
    </Aviso>
  )
}
