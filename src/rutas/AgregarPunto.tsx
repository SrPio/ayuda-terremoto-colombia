import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { Check, Plus, Trash2 } from 'lucide-react'
import { Turnstile } from '@/componentes/Turnstile'
import { turnstileActivo } from '@/lib/config'
import {
  Aviso,
  Boton,
  Campo,
  CampoSelect,
  CampoTexto,
  CampoTrampa,
  Eyebrow,
} from '@/componentes/ui'
import { URGENCIA_ETIQUETA } from '@/lib/formato'
import { useEntrada } from '@/lib/movimiento'
import { useCategorias, useDepartamentos } from '@/lib/consultas'
import { camposTrampaIniciales, enviarAporte } from '@/lib/api'
import type { Urgencia } from '@/lib/tipos'

// ============================================================================
// Agregar un punto de acopio.
//
// Sin cuenta y sin fricción: quien está organizando un acopio en su barrio no
// va a registrarse para publicarlo. A cambio, todo entra a una cola de
// moderación, porque un punto falso en una emergencia manda gente y camiones al
// vacío.
//
// El formulario pide lo mínimo que hace útil un punto: dónde queda, cómo
// contactarlo y qué necesita. Todo lo demás es opcional.
// ============================================================================

interface FilaNecesidad {
  id: number
  categoria: string
  cantidad: string
  unidad: string
  urgencia: Urgencia
}

const URGENCIAS: Urgencia[] = ['baja', 'media', 'alta', 'critica']

let contador = 0
const nuevaFila = (): FilaNecesidad => ({
  id: ++contador,
  categoria: '',
  cantidad: '',
  unidad: '',
  urgencia: 'media',
})

export default function AgregarPunto() {
  const entrada = useEntrada()
  const { data: departamentos } = useDepartamentos()
  const { data: categorias } = useCategorias()

  const [trampas] = useState(camposTrampaIniciales)
  const [honeypot, setHoneypot] = useState('')
  const [token, setToken] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exito, setExito] = useState<string | null>(null)

  const [form, setForm] = useState({
    nombre: '',
    department_code: '',
    ciudad: '',
    direccion: '',
    organizacion: '',
    horario: '',
    telefono: '',
    whatsapp: '',
    email: '',
    descripcion: '',
    acepta_transporte_grande: false,
    submitter_nombre: '',
    submitter_contacto: '',
  })

  const [necesidades, setNecesidades] = useState<FilaNecesidad[]>([nuevaFila()])

  useEffect(() => {
    document.title = 'Agregar un punto de acopio — Ayuda Terremoto Colombia'
  }, [])

  const cambiar = (clave: keyof typeof form) => (valor: string | boolean) =>
    setForm((f) => ({ ...f, [clave]: valor }))

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    const utiles = necesidades.filter((n) => n.categoria !== '')
    if (utiles.length === 0) {
      setError('Indica al menos una cosa que el punto necesite recibir.')
      return
    }
    if (!form.telefono && !form.whatsapp && !form.email) {
      setError('Necesitamos al menos un teléfono, un WhatsApp o un correo para poder verificarlo.')
      return
    }

    setEnviando(true)
    try {
      const r = await enviarAporte(
        'nuevo_punto',
        {
          ...form,
          necesidades: utiles.map((n) => ({
            categoria: n.categoria,
            cantidad: n.cantidad === '' ? null : Number(n.cantidad),
            unidad: n.unidad || undefined,
            urgencia: n.urgencia,
          })),
        },
        { ...trampas, website: honeypot },
        token ?? undefined,
      )
      setExito(r.mensaje ?? 'Punto enviado a revisión')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos enviar el punto')
    } finally {
      setEnviando(false)
    }
  }

  if (exito) {
    return (
      <div className="contenedor max-w-2xl py-16">
        <motion.div initial="oculto" animate="visible" variants={entrada} className="panel p-6 sm:p-8">
          <Check aria-hidden="true" className="text-verificado h-8 w-8" />
          <h1 className="display-ancho mt-4 text-[1.75rem] leading-tight">
            Punto enviado a revisión
          </h1>
          <p className="text-muted mt-3 text-[1.0625rem] leading-relaxed">{exito}</p>
          <p className="text-muted mt-3 text-[0.9375rem] leading-relaxed">
            No se publica de inmediato a propósito: durante una emergencia, un dato sin verificar
            puede mandar gente y camiones a una dirección equivocada.
          </p>
          <div className="mt-6 flex flex-wrap gap-2.5">
            <Link to="/puntos">
              <Boton>Ver los puntos publicados</Boton>
            </Link>
            <Boton
              variante="secundario"
              onClick={() => {
                setExito(null)
                setForm({
                  nombre: '',
                  department_code: form.department_code,
                  ciudad: form.ciudad,
                  direccion: '',
                  organizacion: '',
                  horario: '',
                  telefono: '',
                  whatsapp: '',
                  email: '',
                  descripcion: '',
                  acepta_transporte_grande: false,
                  submitter_nombre: form.submitter_nombre,
                  submitter_contacto: form.submitter_contacto,
                })
                setNecesidades([nuevaFila()])
              }}
            >
              Agregar otro punto
            </Boton>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="contenedor max-w-3xl py-10 lg:py-14">
      <header>
        <Eyebrow>Aportar información</Eyebrow>
        <h1 className="display-ancho mt-3 text-[2rem] leading-tight sm:text-[2.5rem]">
          Agregar un punto de acopio
        </h1>
        <p className="text-muted mt-3 text-[1.0625rem] leading-relaxed">
          Si conoces un punto que no está en la lista, publícalo aquí. No necesitas cuenta. Un
          moderador lo revisa antes de que aparezca.
        </p>
      </header>

      <form onSubmit={enviar} className="relative mt-8 flex flex-col gap-8">
        {/* --- Identificación del punto ----------------------------------- */}
        <fieldset className="panel flex flex-col gap-4 p-4 sm:p-5">
          <legend className="eyebrow px-1">Dónde queda</legend>

          <Campo
            id="nombre"
            etiqueta="Nombre del punto"
            requerido
            ayuda="Como lo conoce la gente. Por ejemplo: Coliseo Miguel Happy Lora."
            value={form.nombre}
            onChange={(e) => cambiar('nombre')(e.target.value)}
            maxLength={160}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <CampoSelect
              id="department_code"
              etiqueta="Departamento"
              requerido
              value={form.department_code}
              onChange={(e) => cambiar('department_code')(e.target.value)}
            >
              <option value="">Selecciona…</option>
              {(departamentos ?? []).map((d) => (
                <option key={d.code} value={d.code}>
                  {d.nombre}
                </option>
              ))}
            </CampoSelect>

            <Campo
              id="ciudad"
              etiqueta="Ciudad o municipio"
              requerido
              value={form.ciudad}
              onChange={(e) => cambiar('ciudad')(e.target.value)}
              maxLength={90}
            />
          </div>

          <Campo
            id="direccion"
            etiqueta="Dirección"
            ayuda="Lo más exacta posible. Sin dirección, el punto solo aparece en la lista y no en el mapa."
            value={form.direccion}
            onChange={(e) => cambiar('direccion')(e.target.value)}
            maxLength={200}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              id="organizacion"
              etiqueta="Quién lo opera"
              ayuda="Alcaldía, Cruz Roja, una parroquia, un colectivo del barrio."
              value={form.organizacion}
              onChange={(e) => cambiar('organizacion')(e.target.value)}
              maxLength={160}
            />
            <Campo
              id="horario"
              etiqueta="Horario"
              value={form.horario}
              onChange={(e) => cambiar('horario')(e.target.value)}
              placeholder="Lunes a sábado, 8 a.m. a 6 p.m."
              maxLength={200}
            />
          </div>

          <label className="flex cursor-pointer items-start gap-2.5 text-[0.9375rem]">
            <input
              type="checkbox"
              checked={form.acepta_transporte_grande}
              onChange={(e) => cambiar('acepta_transporte_grande')(e.target.checked)}
              className="accent-ink mt-0.5 h-4 w-4"
            />
            <span>
              Puede recibir camión o carga grande
              <span className="text-muted mt-0.5 block text-[0.8125rem]">
                Marca esto solo si el sitio tiene bodega o zona de descargue. Cambia a quién le
                proponemos donaciones grandes.
              </span>
            </span>
          </label>
        </fieldset>

        {/* --- Contacto ---------------------------------------------------- */}
        <fieldset className="panel flex flex-col gap-4 p-4 sm:p-5">
          <legend className="eyebrow px-1">Cómo contactarlo</legend>
          <p className="text-muted text-[0.875rem] leading-snug">
            Al menos uno de los tres. Sin contacto no podemos verificar el punto ni la gente puede
            confirmar antes de ir, así que no lo publicaríamos.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              id="telefono"
              etiqueta="Teléfono"
              type="tel"
              value={form.telefono}
              onChange={(e) => cambiar('telefono')(e.target.value)}
              placeholder="604 000 0000"
            />
            <Campo
              id="whatsapp"
              etiqueta="WhatsApp"
              type="tel"
              ayuda="Es el canal que más se usa para coordinar entregas."
              value={form.whatsapp}
              onChange={(e) => cambiar('whatsapp')(e.target.value)}
              placeholder="300 000 0000"
            />
          </div>

          <Campo
            id="email"
            etiqueta="Correo"
            type="email"
            value={form.email}
            onChange={(e) => cambiar('email')(e.target.value)}
            placeholder="contacto@ejemplo.org"
          />
        </fieldset>

        {/* --- Necesidades ------------------------------------------------- */}
        <fieldset className="panel flex flex-col gap-4 p-4 sm:p-5">
          <legend className="eyebrow px-1">Qué necesita</legend>
          <p className="text-muted text-[0.875rem] leading-snug">
            Esto es lo que hace útil el punto. Si sabes la cantidad, escríbela; si no, déjala vacía
            y aparecerá como "cantidad por confirmar" en vez de un número inventado.
          </p>

          <div className="flex flex-col gap-3">
            {necesidades.map((fila, i) => {
              const cat = (categorias ?? []).find((c) => c.slug === fila.categoria)
              return (
                <div key={fila.id} className="border-line flex flex-col gap-3 border-t pt-3 first:border-0 first:pt-0">
                  <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                    <CampoSelect
                      id={`categoria-${fila.id}`}
                      etiqueta={`Necesidad ${i + 1}`}
                      value={fila.categoria}
                      onChange={(e) =>
                        setNecesidades((ns) =>
                          ns.map((n) =>
                            n.id === fila.id
                              ? {
                                  ...n,
                                  categoria: e.target.value,
                                  unidad:
                                    (categorias ?? []).find((c) => c.slug === e.target.value)
                                      ?.unidad_sugerida ?? n.unidad,
                                }
                              : n,
                          ),
                        )
                      }
                    >
                      <option value="">Selecciona…</option>
                      {(categorias ?? []).map((c) => (
                        <option key={c.slug} value={c.slug}>
                          {c.emoji} {c.nombre}
                        </option>
                      ))}
                    </CampoSelect>

                    {necesidades.length > 1 && (
                      <div className="flex items-end">
                        <Boton
                          type="button"
                          variante="fantasma"
                          tamano="pequeno"
                          onClick={() =>
                            setNecesidades((ns) => ns.filter((n) => n.id !== fila.id))
                          }
                          aria-label={`Quitar necesidad ${i + 1}`}
                        >
                          <Trash2 aria-hidden="true" className="h-4 w-4" />
                          Quitar
                        </Boton>
                      </div>
                    )}
                  </div>

                  {fila.categoria && (
                    <div className="grid gap-3 sm:grid-cols-3">
                      <Campo
                        id={`cantidad-${fila.id}`}
                        etiqueta="Cantidad"
                        type="number"
                        min={1}
                        step="any"
                        value={fila.cantidad}
                        onChange={(e) =>
                          setNecesidades((ns) =>
                            ns.map((n) => (n.id === fila.id ? { ...n, cantidad: e.target.value } : n)),
                          )
                        }
                        placeholder="Si no la sabes, déjala vacía"
                      />
                      <Campo
                        id={`unidad-${fila.id}`}
                        etiqueta="Unidad"
                        value={fila.unidad}
                        onChange={(e) =>
                          setNecesidades((ns) =>
                            ns.map((n) => (n.id === fila.id ? { ...n, unidad: e.target.value } : n)),
                          )
                        }
                        placeholder={cat?.unidad_sugerida ?? 'unidades'}
                      />
                      <CampoSelect
                        id={`urgencia-${fila.id}`}
                        etiqueta="Urgencia"
                        value={fila.urgencia}
                        onChange={(e) =>
                          setNecesidades((ns) =>
                            ns.map((n) =>
                              n.id === fila.id ? { ...n, urgencia: e.target.value as Urgencia } : n,
                            ),
                          )
                        }
                      >
                        {URGENCIAS.map((u) => (
                          <option key={u} value={u}>
                            {URGENCIA_ETIQUETA[u]}
                          </option>
                        ))}
                      </CampoSelect>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div>
            <Boton
              type="button"
              variante="secundario"
              tamano="pequeno"
              onClick={() => setNecesidades((ns) => [...ns, nuevaFila()])}
              disabled={necesidades.length >= 12}
            >
              <Plus aria-hidden="true" className="h-4 w-4" />
              Agregar otra necesidad
            </Boton>
          </div>
        </fieldset>

        {/* --- Contexto y quién aporta ------------------------------------ */}
        <fieldset className="panel flex flex-col gap-4 p-4 sm:p-5">
          <legend className="eyebrow px-1">Contexto</legend>

          <CampoTexto
            id="descripcion"
            etiqueta="Algo más que deba saber quien vaya"
            value={form.descripcion}
            onChange={(e) => cambiar('descripcion')(e.target.value)}
            maxLength={800}
            placeholder="Entrada por la puerta lateral, no reciben ropa usada, hay parqueadero para descargar…"
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              id="submitter_nombre"
              etiqueta="Tu nombre"
              ayuda="No se publica. Solo lo ve la moderación."
              value={form.submitter_nombre}
              onChange={(e) => cambiar('submitter_nombre')(e.target.value)}
            />
            <Campo
              id="submitter_contacto"
              etiqueta="Tu contacto"
              ayuda="Por si hay que confirmar algo antes de publicar."
              value={form.submitter_contacto}
              onChange={(e) => cambiar('submitter_contacto')(e.target.value)}
              placeholder="Correo o teléfono"
            />
          </div>
        </fieldset>

        <CampoTrampa valor={honeypot} onChange={setHoneypot} />
        {turnstileActivo && <Turnstile onToken={setToken} />}

        {error && <Aviso tono="error">{error}</Aviso>}

        <div className="flex flex-wrap items-center gap-4">
          <Boton type="submit" tamano="grande" cargando={enviando}>
            Enviar a revisión
          </Boton>
          <p className="text-muted text-[0.875rem]">
            Al enviarlo aceptas que la información se publique de forma abierta bajo licencia MIT.
          </p>
        </div>
      </form>
    </div>
  )
}
