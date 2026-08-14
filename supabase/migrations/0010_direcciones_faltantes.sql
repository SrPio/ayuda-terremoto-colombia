-- ============================================================================
-- 0010_direcciones_faltantes.sql — Direcciones que faltaban y corrección de
-- coordenadas
--
-- Por qué existe esta migración:
--
-- Varios puntos del seed original no tenían dirección publicada, y los que sí
-- la tenían quedaron con la coordenada del CENTRO DEL DEPARTAMENTO (no siquiera
-- de la ciudad) porque scripts/geocode-seed.mjs nunca se corrió contra una
-- migración real: escribía el SQL a stdout pero nadie lo aplicó. Resultado: en
-- el mapa, todos los puntos de Bogotá caían literalmente en el mismo pixel.
--
-- Esta migración hace dos cosas, con la misma regla de honestidad que ya usa
-- el resto del repo (ver 0006_precision_ubicacion.sql):
--
-- 1. Agrega direcciones nuevas, investigadas una por una y citadas abajo por
--    fuente. Cuando ninguna fuente confiable publicaba una dirección con
--    nomenclatura (carrera/calle), se dejó el campo tal como estaba en vez de
--    inventar un número — ver la lista de "NO ENCONTRADAS" al final.
--
-- 2. Refina coordenadas con Nominatim (OpenStreetMap), pero NO se aplicó cada
--    resultado a ciegas: se cruzó cada match contra la localidad/comuna/barrio
--    que la propia fuente de la dirección menciona. Esto importó porque varios
--    resultados de Nominatim fueron simplemente incorrectos — el caso más
--    grave: "Calle 26 #51-53, Bogotá" (Plaza de la Paz, Cundinamarca) devolvió
--    una coordenada en Cúcuta, a 500 km de distancia. Esa y otras coincidencias
--    dudosas se descartaron por completo; solo se aplican las que se pudieron
--    verificar por coherencia geográfica o, en un par de casos, contra Google
--    Maps directamente.
--
--    precision_ubicacion se marca 'exacta' únicamente en los 6 puntos donde
--    Nominatim resolvió el lugar exacto (nodo/POI con el nombre propio del
--    sitio, o número de casa exacto) y se verificó por coherencia o contra
--    Google Maps. En el resto de coordenadas corregidas, el pin mejora de
--    "centro del departamento" a "barrio/comuna correcto", pero se deja
--    precision_ubicacion = 'ciudad' porque no es la puerta confirmada.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Direcciones nuevas — SCARE (16 sedes)
-- Fuente única con las 16 direcciones, la misma tabla ya usada en 0009 para
-- los teléfonos (los teléfonos de esa tabla ya coinciden con los que carga la
-- app, así que la sede es la misma):
-- https://consultorsalud.com/centros-de-acopio-para-medicamentos-e-insumos/
-- ---------------------------------------------------------------------------
update public.collection_points p
   set direccion = v.direccion
  from (values
    ('scare-bogota',        'Carrera 15A #120-74'),
    ('scare-medellin',      'Carrera 43A #1 Sur-100, Edificio Torre Sudameris, oficina 1004'),
    ('scare-barranquilla',  'Carrera 54 #68-196, piso 2, oficinas 216-222, Prado Office Center'),
    ('scare-cartagena',     'Manga, Calle 28 #26-53, Edificio Portus, oficina 1202'),
    ('scare-tunja',         'Calle 20 #12-84, local 117, Centro Cívico y Comercial Plaza Real'),
    ('scare-popayan',       'Carrera 9 #18N-231, oficina 205, Edificio Terrazas del Norte'),
    ('scare-valledupar',    'Calle 11 #8-79, oficinas 202-203, Edificio SOA'),
    ('scare-monteria',      'Calle 62 #7-53, barrio La Castellana'),
    ('scare-riohacha',      'Calle 7 #11-114, oficina 8, segundo piso, Edificio Doña Cándida'),
    ('scare-neiva',         'Carrera 5 #10-49, local 201, Centro Comercial Plaza Real'),
    ('scare-santa-marta',   'Calle 24 #3-99, Edificio 424, oficina 1007'),
    ('scare-villavicencio', 'Avenida 40 #16B-159, Centro Comercial Villacentro, locales 83 y 84'),
    ('scare-pasto',         'Carrera 25 #15-62, oficina 201, Edificio Zaguán del Lago'),
    ('scare-cucuta',        'Calle 8A #5E-25, barrio La Rivera'),
    ('scare-bucaramanga',   'Calle 45 #28-36, Edificio Verona Plaza'),
    ('scare-sincelejo',     'Calle 28 con carrera 25 #365, Parque Comercial Guacarí, Torre Médica, oficinas 3327-3328')
  ) as v(slug, direccion)
 where p.slug = v.slug and p.direccion is null;

-- ---------------------------------------------------------------------------
-- 2. Direcciones nuevas — resto de puntos, una fuente por grupo
-- ---------------------------------------------------------------------------

-- Hospital Universitario del Valle (Cali) — verificada directamente contra la
-- ficha del lugar en Google Maps (coincide con huv.gov.co y El País):
-- "Hospital Universitario del Valle Evaristo García" → Cl. 5 #36-08, El Sindicato, Cali.
update public.collection_points
   set direccion = 'Calle 5 #36-08, barrio El Sindicato'
 where slug = 'hospital-universitario-valle' and direccion is null;

-- Escuela Nacional del Deporte (Cali) — El País:
-- https://www.elpais.com.co/cali/asi-funciona-el-centro-de-ayudas-en-la-escuela-nacional-del-deporte-voluntarios-organizan-donaciones-para-los-afectados-1103.html
update public.collection_points
   set direccion = 'Calle 9 #34-01, barrio San Fernando'
 where slug = 'escuela-nacional-deporte-cali' and direccion is null;

-- Parques biblioteca de Medellín — direcciones permanentes de la Red de
-- Bibliotecas de Medellín (bibliotecasmedellin.gov.co), confirmadas como
-- puntos de acopio del terremoto por El Tiempo:
-- https://www.eltiempo.com/colombia/medellin/medellin-se-une-por-las-victimas-del-terremoto-en-colombia-conozca-los-10-puntos-para-entregar-sus-donaciones-3577553
update public.collection_points p
   set direccion = v.direccion
  from (values
    ('parque-biblioteca-belen',            'Carrera 76 #18A-19'),
    ('parque-biblioteca-san-javier',        'Calle 42C #95-50'),
    ('parque-biblioteca-garcia-marquez',    'Carrera 80 #104-04'),
    ('parque-biblioteca-leon-de-greiff',    'Calle 59A #36-30'),
    ('biblioteca-publica-el-poblado',       'Calle 3B Sur #29B-56, UVA Ilusión Verde')
  ) as v(slug, direccion)
 where p.slug = v.slug and p.direccion is null;

-- Valledupar — El Pilón y Conferencia Episcopal de Colombia:
-- https://elpilon.com.co/general/como-ayudar-desde-valledupar-damnificados-terremoto
-- https://www.cec.org.co/jurisdicciones/di%C3%B3cesis/di%C3%B3cesis-de-valledupar
update public.collection_points
   set direccion = 'Carrera 7 #15-26'
 where slug = 'diocesis-valledupar' and direccion is null;

update public.collection_points
   set direccion = 'Carrera 23 #4-116, manzana A casa 14, Conjunto Residencial Callejas'
 where slug = 'centro-solidaridad-valledupar' and direccion is null;

-- Bucaramanga — sitios oficiales:
-- https://www.bucaramanga.gov.co/directorio-institucional/ (Alcaldía, Palacio Municipal)
-- https://centroabastos.com/ (Centroabastos)
update public.collection_points
   set direccion = 'Calle 35 #10-43, Palacio Municipal'
 where slug = 'alcaldia-bucaramanga' and direccion is null;

update public.collection_points
   set direccion = 'Vía Palenque, Café Madrid #44-96'
 where slug = 'centroabastos-bucaramanga' and direccion is null;

-- Montería, punto ciudadano barrio El Recreo — un solo medio local, sin
-- corroborar con una segunda fuente (igual que el criterio de 0007 con el
-- Palacio de los Deportes: se advierte la confianza media en vez de callarla):
-- https://www.chicanoticias.com/2026/08/10/monteria-habilita-puntos-acopio/
update public.collection_points
   set direccion = 'Calle 69 #3-89',
       descripcion = trim(coalesce(descripcion || ' ', '')
         || 'Dirección confirmada por un solo medio local (Chica Noticias); no hay una segunda fuente que la corrobore.')
 where slug = 'punto-el-recreo-monteria' and direccion is null;

-- Pereira, CAFE sin nomenclatura numérica publicada — descripción de ubicación
-- de la Alcaldía de Pereira (no hay número de calle/carrera en la fuente, así
-- que no se inventa uno):
-- https://www.pereira.gov.co/publicaciones/9848/los-siete-cafes-de-la-alcaldia-de-pereira-se-alistan-para-iniciar-su-proceso-de-escuelas-publicas-de-formacion/
update public.collection_points
   set direccion = 'Manzanas 7 y 8, Villa Consota, sector Cuba'
 where slug = 'cafe-consota' and direccion is null;

update public.collection_points
   set direccion = 'Diagonal a la iglesia de los 2.500 Lotes, sector Cuba'
 where slug = 'cafe-perla-del-otun' and direccion is null;

update public.collection_points
   set direccion = 'Avenida principal, barrio El Remanso, junto al centro de salud'
 where slug = 'cafe-el-remanso' and direccion is null;

update public.collection_points
   set direccion = 'Parque principal del barrio Kennedy, junto a la cancha'
 where slug = 'cafe-kennedy' and direccion is null;

-- Manizales, Bomberos Palogrande — ninguna fuente publica nomenclatura exacta,
-- solo referencias de sector (LaFM, La Patria, El Tiempo):
update public.collection_points
   set direccion = 'Cancha auxiliar junto a la Estación de Bomberos, sector Estadio Palogrande, calle 62'
 where slug = 'bomberos-palogrande' and direccion is null;

-- Itagüí — sin consenso en una dirección numerada entre las fuentes (unas
-- dicen Cra 51 x Cll 51, otras Cra 52 x Cll 60): se deja solo el nombre del
-- lugar, que es suficiente para ubicarlo por ser un sitio público conocido.
update public.collection_points
   set direccion = 'Parque Principal de Itagüí'
 where slug = 'parque-principal-itagui' and direccion is null;

-- Cali, Plazoleta Jairo Varela — ninguna nota de prensa sobre el punto de
-- acopio da un número; se agrega la referencia descriptiva de la plaza:
update public.collection_points
   set direccion = 'Avenida 2 Norte, entre calles 10 y 11, frente al CAM, barrio Centenario'
 where slug = 'plazoleta-jairo-varela' and direccion is null;

-- Cartagena, Coliseo Bernardo Caraballo — verificado directamente en la ficha
-- del lugar en Google Maps: "Coliseo Cubierto Bernardo Caraballo" →
-- Cra. 17 #35-119, Cartagena de Indias.
update public.collection_points
   set direccion = 'Carrera 17 #35-119'
 where slug = 'coliseo-bernardo-caraballo' and direccion is null;

-- Montería, Coliseo Miguel "Happy" Lora — la fuente solo da una referencia
-- relativa, sin nomenclatura:
-- https://gsnoticias.com/happy-lora-habilitado-como-centro-de-acopio-para-apoyar-a-afectados-por-el-terremoto/
update public.collection_points
   set direccion = 'Diagonal al Hospital San Jerónimo de Montería'
 where slug = 'coliseo-happy-lora' and direccion is null;

-- ---------------------------------------------------------------------------
-- 3. Coordenadas verificadas — se corrigen solo cuando el resultado de
-- Nominatim coincide con la localidad/barrio que la propia fuente de la
-- dirección menciona (o, en dos casos, se verificó directamente en Google
-- Maps). precision_ubicacion sube a 'exacta' solo en los 6 casos con match de
-- POI/casa exacto y verificación cruzada.
-- ---------------------------------------------------------------------------

-- Exacta: Nominatim resuelve el nodo puntual del sitio con nombre propio, y
-- se verificó por coherencia geográfica o contra Google Maps.
update public.collection_points
   set lat = 4.6070836, lng = -74.0675481, precision_ubicacion = 'exacta'
 where slug = 'utadeo-bogota'; -- Nominatim resuelve "Museo del Mar Utadeo, 22-61, Carrera 4" — coincide con el número exacto de la dirección.

update public.collection_points
   set lat = 6.2030255, lng = -75.5716144, precision_ubicacion = 'exacta'
 where slug = 'scare-medellin'; -- match de tipo "house" con el número exacto; verificado en Google Maps: cae en El Poblado, como corresponde.

update public.collection_points
   set lat = 3.4550187, lng = -76.5348007, precision_ubicacion = 'exacta'
 where slug = 'plazoleta-jairo-varela'; -- Nominatim resuelve la plaza por su nombre propio, en el barrio Centenario (el CAM de Cali), coherente con la fuente.

update public.collection_points
   set lat = 6.1723858, lng = -75.6094160, precision_ubicacion = 'exacta'
 where slug = 'parque-principal-itagui'; -- es el parque mismo, resuelto por nombre propio.

update public.collection_points
   set lat = 10.4252358, lng = -75.5366822, precision_ubicacion = 'exacta'
 where slug = 'coliseo-bernardo-caraballo'; -- verificado contra Google Maps: coincide con Cra. 17 #35-119.

update public.collection_points
   set lat = 8.7472479, lng = -75.8816517, precision_ubicacion = 'exacta'
 where slug = 'coliseo-happy-lora'; -- resuelto por nombre propio del coliseo.

-- Mejora de "centro del departamento" a "barrio/comuna correcto" — se deja
-- precision_ubicacion = 'ciudad' porque el match de Nominatim es a nivel de
-- vía, no de puerta, aunque la localidad/barrio coincide con lo que dice la
-- fuente de la dirección.
update public.collection_points set lat = 4.6215689,  lng = -74.1253126 where slug = 'cruz-roja-samu-sur';          -- Avenida Carrera 68 Sur cae en Kennedy, coherente con "sur" en la nomenclatura de Bogotá.
update public.collection_points set lat = 6.2381149,  lng = -75.5966455 where slug = 'parque-biblioteca-belen';     -- cae en Comuna 16 - Belén, la comuna correcta para ese parque biblioteca.
update public.collection_points set lat = 4.6992899,  lng = -74.0438339 where slug = 'scare-bogota';                -- Carrera 15A cae en Usaquén, coherente con la altura de calle 120 en la nomenclatura de Bogotá.
update public.collection_points set lat = 10.4114874, lng = -75.5339305 where slug = 'scare-cartagena';             -- cae en el barrio Manga, que la propia dirección menciona.
update public.collection_points set lat = 8.7718675,  lng = -75.8653902 where slug = 'scare-monteria';              -- cae en La Castellana, el barrio que la propia dirección menciona.
update public.collection_points set lat = 8.7814947,  lng = -75.8674210 where slug = 'punto-el-recreo-monteria';    -- cae en El Recreo, el barrio que la propia dirección menciona.
update public.collection_points set lat = 7.1199250,  lng = -73.1229464 where slug = 'alcaldia-bucaramanga';        -- cae en el centro de Bucaramanga, coherente con un Palacio Municipal.
update public.collection_points set lat = 4.8089486,  lng = -75.6725749 where slug = 'cafe-kennedy';                -- cae en el barrio Kennedy, que la propia dirección menciona.
update public.collection_points set lat = 5.0570052,  lng = -75.4906886 where slug = 'bomberos-palogrande';         -- ancla en el Estadio Palogrande, el punto de referencia que dan las fuentes de prensa; no es la puerta exacta de la estación.

-- ---------------------------------------------------------------------------
-- 4. Lo que se investigó y NO se agregó, para que quede constancia:
--
-- - plaza-de-la-paz-cundinamarca: la única dirección disponible (Calle 26
--   #51-53) es la sede general de la Gobernación de Cundinamarca, no una nota
--   específica del punto de acopio, y al geocodificarla Nominatim devolvió una
--   coordenada en Cúcuta (a 500 km) — un resultado claramente incorrecto. Se
--   descarta por completo en vez de aplicar una dirección de confianza dudosa
--   o una coordenada mala.
-- - banco-alimentos-armenia: ninguna fuente confiable (ni balarmenia.org, que
--   no cargó, ni notas de prensa) publica una dirección verificable.
-- - gobernacion-atlantico-plaza-paz: los artículos de El Heraldo y
--   regioncaribe.org solo dan el nombre del lugar. Un resumen automático de
--   búsqueda sugirió "Cra. 45 #48-31", pero esa cifra no aparece en ningún
--   artículo real — se descartó por ser, con toda probabilidad, una
--   alucinación del resumidor.
-- ============================================================================
