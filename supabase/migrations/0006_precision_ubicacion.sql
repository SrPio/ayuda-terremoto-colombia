-- ============================================================================
-- 0006_precision_ubicacion.sql — Decir la verdad sobre las coordenadas
--
-- Por qué existe esta migración:
--
-- Las fuentes publican direcciones en formato colombiano ("Carrera 50 #25-261").
-- Nominatim resuelve muy pocas y, cuando lo hace, devuelve el centroide de la
-- vía, no el número: en Medellín la carrera 50 mide varios kilómetros. Así que
-- los puntos del seed quedan con la coordenada del centro de su ciudad.
--
-- El problema no es la imprecisión, es fingir precisión. Un marcador redondo y
-- sólido sobre el mapa le dice a quien lo mira "es acá", y si en realidad está a
-- dos kilómetros, esa persona da vueltas con el carro cargado.
--
-- Esta columna permite que la interfaz distinga un punto ubicado de verdad de
-- uno ubicado al centro de la ciudad, y lo diga.
-- ============================================================================

alter table public.collection_points
  add column precision_ubicacion text not null default 'ciudad'
    check (precision_ubicacion in ('exacta', 'ciudad'));

comment on column public.collection_points.precision_ubicacion is
  'exacta = la coordenada corresponde a la puerta del punto. ciudad = es el centro del municipio y solo sirve para ubicarlo en el mapa a escala regional.';

-- Todo el seed entra como 'ciudad', que es el valor por defecto. Cuando un
-- moderador corrija las coordenadas a mano desde el panel, la Edge Function
-- moderate las marca como 'exacta'.
