import { Suspense, lazy, useEffect } from 'react'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Encabezado, PieDePagina } from './componentes/Diseno'
import { Esqueleto } from './componentes/ui'
import { useActualizacionesEnVivo } from './lib/consultas'
import Portada from './rutas/Portada'

// Cada ruta en su propio chunk. La portada sí va en el bundle inicial: es la
// que se abre cuando alguien recibe el enlace por WhatsApp.
const Puntos = lazy(() => import('./rutas/Puntos'))
const FichaPunto = lazy(() => import('./rutas/FichaPunto'))
const Donar = lazy(() => import('./rutas/Donar'))
const AgregarPunto = lazy(() => import('./rutas/AgregarPunto'))
const Acerca = lazy(() => import('./rutas/Acerca'))
const Admin = lazy(() => import('./rutas/Admin'))
const NoEncontrado = lazy(() => import('./rutas/NoEncontrado'))

const cliente = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: true,
      // Durante una emergencia los datos cambian: al volver a la pestaña se
      // revalida, pero no se refresca en bucle para no gastar datos móviles.
      staleTime: 60 * 1000,
    },
  },
})

/** Al cambiar de ruta se vuelve arriba y se anuncia la página al lector de pantalla. */
function AlCambiarDeRuta() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname])

  return null
}

function Contenido() {
  useActualizacionesEnVivo()

  return (
    <>
      <a
        href="#contenido"
        className="focus:bg-signal focus:text-ink sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-100 focus:px-3 focus:py-2"
      >
        Saltar al contenido
      </a>

      <Encabezado />

      <main id="contenido" className="flex-1">
        <Suspense
          fallback={
            <div className="contenedor py-16">
              <Esqueleto filas={3} />
            </div>
          }
        >
          <Routes>
            <Route path="/" element={<Portada />} />
            <Route path="/puntos" element={<Puntos />} />
            <Route path="/puntos/:slug" element={<FichaPunto />} />
            <Route path="/donar" element={<Donar />} />
            <Route path="/agregar" element={<AgregarPunto />} />
            <Route path="/acerca" element={<Acerca />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="*" element={<NoEncontrado />} />
          </Routes>
        </Suspense>
      </main>

      <PieDePagina />
    </>
  )
}

export function App() {
  return (
    <QueryClientProvider client={cliente}>
      <BrowserRouter>
        <AlCambiarDeRuta />
        <div className="flex min-h-dvh flex-col">
          <Contenido />
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
