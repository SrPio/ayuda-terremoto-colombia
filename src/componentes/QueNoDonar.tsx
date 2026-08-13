import { Ban } from 'lucide-react'
import { Eyebrow } from './ui'

// ============================================================================
// Qué no donar.
//
// Sale de la guía oficial de la Alcaldía Mayor de Bogotá. Está aquí, y no en
// una página de ayuda que nadie abre, porque es la información que evita que un
// punto de acopio gaste manos y espacio descartando cosas.
//
// Se redacta en positivo cuando se puede ("ropa nueva o en excelente estado")
// en vez de solo prohibir: la persona necesita saber qué hacer, no solo qué no.
// ============================================================================

const FUENTE =
  'https://bogota.gov.co/mi-ciudad/ambiente/que-donar-y-no-donar-en-bogota-para-damnificados-terremoto-colombia'

const NO_SIRVE = [
  {
    que: 'Alimentos perecederos o ya abiertos',
    porque: 'Se dañan en el trayecto y contaminan el resto del lote.',
  },
  {
    que: 'Agua con el empaque abollado, roto o con el color alterado',
    porque: 'No hay forma de garantizar que sea potable, así que se descarta al llegar.',
  },
  {
    que: 'Medicamentos abiertos o próximos a vencer',
    porque: 'No se pueden entregar a nadie y su desecho es un problema adicional.',
  },
  {
    que: 'Ropa usada o desgastada',
    porque: 'Varios puntos ya no la reciben. Solo ropa nueva o en excelente estado.',
  },
  {
    que: 'Ropa interior usada',
    porque: 'Solo se acepta nueva, sin excepción.',
  },
]

export function QueNoDonar({ compacto = false }: { compacto?: boolean }) {
  return (
    <section
      className="panel p-4 sm:p-5"
      style={{ borderLeftWidth: 2, borderLeftColor: 'var(--color-critica)' }}
      aria-labelledby="titulo-no-donar"
    >
      <div className="flex items-center gap-2">
        <Ban aria-hidden="true" className="text-critica h-4 w-4 shrink-0" />
        <h2 id="titulo-no-donar" className="display-estrecho text-[0.9375rem] font-bold uppercase">
          Lo que no llega a nadie
        </h2>
      </div>

      <p className="text-muted mt-2 text-[0.875rem] leading-relaxed">
        Estas cosas se descartan al llegar al punto de acopio. Dejarlas en casa le ahorra trabajo a
        quien está clasificando donaciones.
      </p>

      <ul className="divide-line mt-3 flex flex-col divide-y">
        {NO_SIRVE.map((item) => (
          <li key={item.que} className="py-2.5 first:pt-0 last:pb-0">
            <p className="text-[0.9375rem] font-medium">{item.que}</p>
            {!compacto && (
              <p className="text-muted mt-0.5 text-[0.8125rem] leading-snug">{item.porque}</p>
            )}
          </li>
        ))}
      </ul>

      <p className="mt-3">
        <Eyebrow>
          <a
            href={FUENTE}
            target="_blank"
            rel="noreferrer noopener"
            className="hover:subrayado-signal"
          >
            Guía oficial de la Alcaldía Mayor de Bogotá →
          </a>
        </Eyebrow>
      </p>
    </section>
  )
}
