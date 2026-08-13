import { useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { motion, useReducedMotion } from 'motion/react'
import { Github, Menu, X } from 'lucide-react'
import { Eyebrow } from './ui'

// ============================================================================
// Marco de la aplicación: marca, navegación y pie.
//
// La barra superior es oscura y fija: funciona como el encabezado de un tablero
// de operaciones, siempre presente, nunca protagonista.
// ============================================================================

export const REPO_URL = 'https://github.com/SrPio/ayuda-terremoto-colombia'

const ENLACES = [
  { a: '/puntos', texto: 'Puntos de acopio' },
  { a: '/donar', texto: 'Tengo algo para donar' },
  { a: '/agregar', texto: 'Agregar un punto' },
  { a: '/acerca', texto: 'Acerca del proyecto' },
]

/**
 * La marca es el sello sísmico: una traza de sismograma que se aplana. Es lo
 * único decorativo de toda la interfaz, y aparece a un solo tamaño.
 */
function Sello() {
  const quieto = useReducedMotion()
  return (
    <svg
      viewBox="0 0 34 20"
      className="h-5 w-[34px] shrink-0"
      role="img"
      aria-label="Ayuda Terremoto Colombia"
    >
      <motion.path
        d="M0 10h6l2.5-7 3 14 3-11 2.5 8 2-4h15"
        fill="none"
        stroke="var(--color-signal)"
        strokeWidth="1.6"
        strokeLinecap="square"
        initial={quieto ? undefined : { pathLength: 0 }}
        animate={quieto ? undefined : { pathLength: 1 }}
        transition={{ duration: 1.1, ease: 'easeOut' }}
      />
    </svg>
  )
}

export function Encabezado() {
  const [abierto, setAbierto] = useState(false)
  const { pathname } = useLocation()

  return (
    <header className="bg-ink text-mineral sticky top-0 z-50">
      <div className="contenedor flex h-14 items-center gap-6">
        <Link
          to="/"
          onClick={() => setAbierto(false)}
          className="flex items-center gap-2.5"
        >
          <Sello />
          <span className="display-estrecho text-[0.9375rem] font-bold tracking-tight uppercase">
            Ayuda Terremoto Colombia
          </span>
        </Link>

        <nav aria-label="Principal" className="ml-auto hidden items-center gap-6 lg:flex">
          {ENLACES.map((e) => (
            <NavLink
              key={e.a}
              to={e.a}
              className={({ isActive }) =>
                `font-mono text-eyebrow tracking-[0.12em] uppercase transition-colors ${
                  isActive ? 'text-signal' : 'text-muted-claro hover:text-mineral'
                }`
              }
            >
              {e.texto}
            </NavLink>
          ))}
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="text-muted-claro hover:text-mineral"
            aria-label="Código fuente en GitHub"
          >
            <Github aria-hidden="true" className="h-4 w-4" />
          </a>
        </nav>

        <button
          onClick={() => setAbierto((v) => !v)}
          className="text-mineral ml-auto lg:hidden"
          aria-expanded={abierto}
          aria-controls="menu-movil"
          aria-label={abierto ? 'Cerrar menú' : 'Abrir menú'}
        >
          {abierto ? (
            <X aria-hidden="true" className="h-5 w-5" />
          ) : (
            <Menu aria-hidden="true" className="h-5 w-5" />
          )}
        </button>
      </div>

      {abierto && (
        <motion.nav
          id="menu-movil"
          aria-label="Principal"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className="border-panel-alto overflow-hidden border-t lg:hidden"
        >
          <div className="contenedor flex flex-col py-2">
            {ENLACES.map((e) => (
              <Link
                key={e.a}
                to={e.a}
                onClick={() => setAbierto(false)}
                className={`border-panel-alto border-b py-3 font-mono text-[0.8125rem] tracking-[0.1em] uppercase last:border-0 ${
                  pathname === e.a ? 'text-signal' : 'text-muted-claro'
                }`}
              >
                {e.texto}
              </Link>
            ))}
          </div>
        </motion.nav>
      )}
    </header>
  )
}

export function PieDePagina() {
  return (
    <footer className="bg-ink text-muted-claro mt-20">
      <div className="contenedor grid gap-8 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <div className="flex items-center gap-2.5">
            <Sello />
            <span className="text-mineral display-estrecho text-[0.9375rem] font-bold uppercase">
              Ayuda Terremoto Colombia
            </span>
          </div>
          <p className="mt-3 max-w-md text-[0.875rem] leading-relaxed">
            Proyecto abierto y sin ánimo de lucro para centralizar dónde llevar donaciones tras el
            sismo del 10 de agosto de 2026. La información la mantiene la comunidad y la revisa un
            equipo de moderación.
          </p>
          <p className="mt-3 max-w-md text-[0.875rem] leading-relaxed">
            <strong className="text-mineral">Confirma por teléfono antes de desplazarte.</strong> Los
            puntos abren y cierran de un día para otro.
          </p>
        </div>

        <div>
          <Eyebrow claro>Navegar</Eyebrow>
          <ul className="mt-3 flex flex-col gap-2 text-[0.875rem]">
            {ENLACES.map((e) => (
              <li key={e.a}>
                <Link to={e.a} className="hover:text-mineral">
                  {e.texto}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <Eyebrow claro>Código abierto</Eyebrow>
          <ul className="mt-3 flex flex-col gap-2 text-[0.875rem]">
            <li>
              <a
                href={REPO_URL}
                target="_blank"
                rel="noreferrer noopener"
                className="hover:text-mineral inline-flex items-center gap-1.5"
              >
                <Github aria-hidden="true" className="h-3.5 w-3.5" />
                Repositorio en GitHub
              </a>
            </li>
            <li>
              <a
                href={`${REPO_URL}/blob/main/LICENSE`}
                target="_blank"
                rel="noreferrer noopener"
                className="hover:text-mineral"
              >
                Licencia MIT
              </a>
            </li>
            <li>
              <a
                href={`${REPO_URL}/issues/new/choose`}
                target="_blank"
                rel="noreferrer noopener"
                className="hover:text-mineral"
              >
                Reportar un problema
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-panel-alto border-t">
        <div className="contenedor py-5">
          <p className="font-mono text-[0.6875rem] tracking-[0.1em] uppercase">
            Datos iniciales tomados de fuentes públicas y de prensa · Sin ánimo de lucro · No
            solicitamos dinero
          </p>
        </div>
      </div>
    </footer>
  )
}
