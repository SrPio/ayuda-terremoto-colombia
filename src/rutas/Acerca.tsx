import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Download, Github } from 'lucide-react'
import { REPO_URL } from '@/componentes/Diseno'
import { Aviso, Boton, Eyebrow } from '@/componentes/ui'
import { SUPABASE_URL } from '@/lib/supabase'

// ============================================================================
// Acerca del proyecto.
//
// Esta página existe para responder una pregunta legítima: "¿quién está detrás
// de esto y por qué debería creerle?". Así que dice de dónde salen los datos,
// qué se verifica y qué no, y cómo cualquiera puede auditar o replicar todo.
// ============================================================================

const FUENTE_ELTIEMPO =
  'https://www.eltiempo.com/datos/este-es-el-mapa-completo-de-los-centros-de-acopio-habilitados-en-colombia-para-ayudar-a-los-damnificados-del-terremoto-de-magnitud-7-3577654'

export default function Acerca() {
  useEffect(() => {
    document.title = 'Acerca del proyecto — Ayuda Terremoto Colombia'
  }, [])

  return (
    <div className="contenedor max-w-3xl py-10 lg:py-14">
      <header>
        <Eyebrow>Proyecto abierto</Eyebrow>
        <h1 className="display-ancho mt-3 text-[2rem] leading-tight sm:text-[2.5rem]">
          Acerca de este proyecto
        </h1>
        <p className="text-muted mt-4 text-[1.0625rem] leading-relaxed">
          Tras el sismo del 10 de agosto de 2026 la información de los puntos de acopio quedó
          repartida entre alcaldías, gobernaciones, la Cruz Roja, bancos de alimentos, notas de
          prensa y cadenas de WhatsApp. El resultado conocido: unos puntos desbordados de cosas que
          no necesitan, y municipios enteros esperando agua.
        </p>
        <p className="text-muted mt-3 text-[1.0625rem] leading-relaxed">
          Esta página hace una sola cosa: junta esa información en un lugar y la cruza con lo que
          cada persona tiene para donar.
        </p>
      </header>

      <section className="mt-12">
        <h2 className="display-ancho text-[1.5rem] leading-tight">De dónde salen los datos</h2>
        <p className="text-muted mt-3 leading-relaxed">
          Los puntos iniciales se tomaron del mapa de centros de acopio publicado por{' '}
          <a href={FUENTE_ELTIEMPO} target="_blank" rel="noreferrer noopener" className="subrayado-signal">
            El Tiempo
          </a>
          , que recoge los habilitados por alcaldías, gobernaciones, la Cruz Roja Colombiana, los
          bancos de alimentos y la red SCARE. Cada ficha enlaza su fuente.
        </p>
        <p className="text-muted mt-3 leading-relaxed">
          A partir de ahí, la información la mantiene quien la conoce de primera mano: cualquiera
          puede agregar un punto, corregir un dato o reportar que un sitio cerró.
        </p>

        <div className="mt-5">
          <Aviso tono="atencion">
            <strong>Lo que no inventamos.</strong> Las fuentes publican qué recibe cada punto, pero
            casi nunca cuánto le falta. Cuando no hay una cifra confirmada, la página dice "cantidad
            por confirmar" en lugar de estimar un número. Una cifra inventada haría que alguien
            cargue un camión con destino equivocado.
          </Aviso>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="display-ancho text-[1.5rem] leading-tight">Cómo se moderan los aportes</h2>
        <ul className="text-muted mt-3 flex flex-col gap-3 leading-relaxed">
          <li>
            <strong className="text-ink">Nada se publica solo.</strong> Los puntos nuevos, las
            correcciones y las solicitudes de retiro entran a una cola y un moderador las revisa
            antes de que cambien algo en la página.
          </li>
          <li>
            <strong className="text-ink">No pedimos cuenta a nadie.</strong> Registrarse sería una
            barrera absurda para quien está organizando un acopio en su barrio. En su lugar, la
            escritura pasa por un servidor que valida, aplica un captcha invisible y limita los
            envíos por conexión.
          </li>
          <li>
            <strong className="text-ink">No guardamos direcciones IP.</strong> Para frenar el spam
            se guarda un hash con sal secreta, no la IP. Alcanza para contar envíos y no construye un
            registro de quién consultó qué.
          </li>
          <li>
            <strong className="text-ink">Los puntos cerrados no se borran.</strong> Se marcan como
            cerrados. Borrarlos garantiza que alguien los vuelva a agregar mañana.
          </li>
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="display-ancho text-[1.5rem] leading-tight">Código y datos abiertos</h2>
        <p className="text-muted mt-3 leading-relaxed">
          Todo el proyecto es open source bajo licencia MIT: el frontend, el esquema de la base de
          datos, las políticas de seguridad y los datos iniciales. Puedes auditarlo, replicarlo para
          otra emergencia o levantar tu propia copia.
        </p>
        <p className="text-muted mt-3 leading-relaxed">
          Los puntos publicados también se pueden consultar como datos abiertos, sin llave, en caso
          de que un medio o otra iniciativa quiera reutilizarlos.
        </p>

        <div className="mt-5 flex flex-wrap gap-2.5">
          <a href={REPO_URL} target="_blank" rel="noreferrer noopener">
            <Boton>
              <Github aria-hidden="true" className="h-4 w-4" />
              Ver el código en GitHub
            </Boton>
          </a>
          <a
            href={`${SUPABASE_URL}/rest/v1/collection_points?select=slug,nombre,ciudad,department_code,direccion,telefono,whatsapp,lat,lng,point_needs(category_slug,cantidad_solicitada,cantidad_cubierta,unidad,urgencia)&status=eq.approved`}
            target="_blank"
            rel="noreferrer noopener"
          >
            <Boton variante="secundario">
              <Download aria-hidden="true" className="h-4 w-4" />
              Descargar los datos en JSON
            </Boton>
          </a>
        </div>
        <p className="text-muted mt-3 text-[0.8125rem]">
          El enlace de datos requiere la cabecera <code className="font-mono">apikey</code> con la
          llave pública del proyecto; el README explica cómo consultarlo desde la terminal.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="display-ancho text-[1.5rem] leading-tight">Aviso importante</h2>
        <div className="mt-3 flex flex-col gap-4">
          <Aviso tono="atencion">
            Confirma por teléfono antes de desplazarte. Los puntos abren, se saturan y cierran de un
            día para otro, y ningún dato de esta página reemplaza una llamada.
          </Aviso>
          <Aviso tono="info">
            Este proyecto no recibe, administra ni solicita dinero. Si vas a hacer un aporte
            económico, hazlo únicamente por los canales oficiales de la Cruz Roja Colombiana, los
            bancos de alimentos o las entidades que estén coordinando la respuesta.
          </Aviso>
        </div>
      </section>

      <section className="border-line mt-12 border-t pt-8">
        <h2 className="display-ancho text-[1.5rem] leading-tight">Cómo ayudar con el proyecto</h2>
        <p className="text-muted mt-3 leading-relaxed">
          Se puede contribuir de tres maneras: aportando información de puntos, reportando datos
          desactualizados, o con código y traducciones en el repositorio.
        </p>
        <div className="mt-5 flex flex-wrap gap-2.5">
          <Link to="/agregar">
            <Boton>Agregar un punto</Boton>
          </Link>
          <a href={`${REPO_URL}/issues/new/choose`} target="_blank" rel="noreferrer noopener">
            <Boton variante="secundario">Abrir un issue</Boton>
          </a>
        </div>
      </section>
    </div>
  )
}
