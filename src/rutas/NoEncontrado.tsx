import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Boton, Eyebrow } from '@/componentes/ui'

export default function NoEncontrado() {
  useEffect(() => {
    document.title = 'Página no encontrada — Ayuda Terremoto Colombia'
  }, [])

  return (
    <div className="contenedor max-w-xl py-24 text-center">
      <Eyebrow>Error 404</Eyebrow>
      <h1 className="display-ancho mt-3 text-[2rem] leading-tight">Esta página no existe</h1>
      <p className="text-muted mt-3 text-[1.0625rem] leading-relaxed">
        El enlace puede estar mal escrito, o el punto de acopio que buscas ya se retiró de la lista.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-2.5">
        <Link to="/puntos">
          <Boton>Ver los puntos de acopio</Boton>
        </Link>
        <Link to="/">
          <Boton variante="secundario">Ir al inicio</Boton>
        </Link>
      </div>
    </div>
  )
}
