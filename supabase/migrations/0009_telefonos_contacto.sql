-- ============================================================================
-- 0009_telefonos_contacto.sql — Teléfonos y WhatsApp de contacto
--
-- La mayoría de los puntos de acopio del seed no traían teléfono porque las
-- fuentes originales (El Tiempo, Radio Nacional, El Colombiano) publicaban
-- direcciones pero no contactos. Esta migración agrega los que se pudieron
-- confirmar con una búsqueda dedicada, organización por organización.
--
-- Dos categorías, con trato distinto:
--
-- 1. Contactos propios del punto/organización (bancos de alimentos,
--    hemocentros, fundaciones, SCARE): se cargan directo en telefono/whatsapp,
--    con la fuente citada abajo por grupo.
--
-- 2. Líneas generales de una alcaldía o de Cruz Roja que cubren varios puntos
--    a la vez (no hay línea exclusiva por sede): se cargan igual, porque sirven
--    para que alguien llame y confirme, pero se advierte en la descripción que
--    no es una línea exclusiva de ese punto.
--
-- Deliberadamente NO se agregó ningún número que quedó contradictorio o sin
-- confirmar en la búsqueda (p. ej. Banco de Alimentos de Armenia).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Contactos propios, confirmados con una sola fuente confiable
-- ---------------------------------------------------------------------------

-- Banco de Alimentos de Cali — https://www.bancodealimentoscali.org/contactenos/
update public.collection_points
   set telefono = '(602) 881 2066',
       whatsapp = '313 245 7978'
 where slug = 'banco-alimentos-cali';

-- Hospital Universitario del Valle (donación de sangre) — https://www.huv.gov.co/index.php/servicios-especializados/banco-de-sangre/
update public.collection_points
   set telefono = '324 502 7640 / 324 502 7663'
 where slug = 'hospital-universitario-valle';

-- Hemocentro del Café, Manizales — https://hemocentrodelcafe.com/contactanos/
update public.collection_points
   set telefono = '314 777 7266'
 where slug = 'hemocentro-del-cafe';

-- Banco de Alimentos de Manizales — https://bancodealimentosmanizales.org/
update public.collection_points
   set telefono = '310 418 4472',
       whatsapp = '310 418 4472'
 where slug = 'banco-alimentos-manizales';

-- Fundación Banco Arquidiocesano de Alimentos, Medellín — https://infolocal.comfenalcoantioquia.com/index.php/banco-de-alimentos-medellin
update public.collection_points
   set telefono = '604 448 3888',
       whatsapp = '311 361 2527'
 where slug = 'banco-arquidiocesano-medellin';

-- Fundación Saciar, Medellín — https://saciar.org.co/como-ayudar/
update public.collection_points
   set whatsapp = '320 750 3743'
 where slug = 'fundacion-saciar-medellin';

-- Banco de Alimentos — punto alterno La Badea, Dosquebradas (Cáritas Pereira)
-- https://www.caritaspereira.org/banco-de-alimentos/
update public.collection_points
   set telefono = '321 646 7811',
       whatsapp = '321 646 7811'
 where slug = 'banco-alimentos-dosquebradas';

-- Diócesis de Valledupar — https://elpilon.com.co/general/como-ayudar-desde-valledupar-damnificados-terremoto
update public.collection_points
   set whatsapp = '322 730 7199'
 where slug = 'diocesis-valledupar';

-- Centro de Solidaridad, Valledupar — https://elpilon.com.co/general/como-ayudar-desde-valledupar-damnificados-terremoto
update public.collection_points
   set telefono = '311 403 9818'
 where slug = 'centro-solidaridad-valledupar';

-- ---------------------------------------------------------------------------
-- SCARE — Red de Sociedades Científicas, teléfono por sede
-- Fuente para las 16: https://consultorsalud.com/centros-de-acopio-para-medicamentos-e-insumos/
-- ---------------------------------------------------------------------------
update public.collection_points p
   set telefono = v.telefono
  from (values
    ('scare-bogota',        '(601) 744 8100'),
    ('scare-medellin',      '(604) 605 2298'),
    ('scare-barranquilla',  '(605) 386 1950'),
    ('scare-cartagena',     '(605) 693 9844'),
    ('scare-tunja',         '(608) 747 1763'),
    ('scare-popayan',       '(602) 835 3770'),
    ('scare-valledupar',    '(605) 589 3964'),
    ('scare-monteria',      '(604) 789 0650'),
    ('scare-riohacha',      '(605) 727 4999'),
    ('scare-neiva',         '(608) 863 1026'),
    ('scare-santa-marta',   '(605) 436 8361'),
    ('scare-villavicencio', '(608) 683 3520'),
    ('scare-pasto',         '(602) 738 2025'),
    ('scare-cucuta',        '(607) 595 6341'),
    ('scare-bucaramanga',   '(607) 697 3093'),
    ('scare-sincelejo',     '(605) 276 5344')
  ) as v(slug, telefono)
 where p.slug = v.slug;

-- ---------------------------------------------------------------------------
-- Líneas generales que cubren varios puntos a la vez — se advierte en la
-- descripción que no son exclusivas de esa sede.
-- ---------------------------------------------------------------------------

-- Cruz Roja Bogotá y Cundinamarca — https://www.cruzrojabogota.org.co/contacto
update public.collection_points
   set telefono = '(601) 746 0909',
       whatsapp = '317 363 8993',
       descripcion = trim(coalesce(descripcion || ' ', '')
         || 'Línea general de Cruz Roja Bogotá y Cundinamarca: no es exclusiva de esta sede, pero permite confirmar información de este punto.')
 where slug in (
   'cruz-roja-samu-sur', 'cruz-roja-samu-norte', 'cruz-roja-salvamento-acuatico',
   'cruz-roja-sede-administrativa', 'cruz-roja-bodega', 'cruz-roja-palacio-deportes'
 ) and telefono is null;

-- Alcaldía de Medellín — Atención Ciudadana — https://www.medellin.gov.co/es/sala-de-prensa/noticias/en-10-puntos-se-recibiran-las-donaciones-para-enviar-desde-medellin-a-las-comunidades-afectadas-por-el-sismo/
update public.collection_points
   set telefono = '604 44 44 144',
       whatsapp = '301 604 4444',
       descripcion = trim(coalesce(descripcion || ' ', '')
         || 'Línea general de Atención Ciudadana de la Alcaldía de Medellín: no es exclusiva de este punto.')
 where slug in (
   'parque-biblioteca-belen', 'parque-biblioteca-san-javier',
   'parque-biblioteca-garcia-marquez', 'parque-biblioteca-leon-de-greiff',
   'biblioteca-publica-el-poblado', 'terminal-del-norte-medellin',
   'universidad-eafit-medellin', 'hall-alcaldia-medellin'
 ) and telefono is null;

-- Alcaldía de Pereira — línea general — https://www.pereira.gov.co/
update public.collection_points
   set telefono = '(606) 324 8000',
       descripcion = trim(coalesce(descripcion || ' ', '')
         || 'Línea general de la Alcaldía de Pereira: no es exclusiva de este CAFE.')
 where slug in (
   'cafe-consota', 'cafe-perla-del-otun', 'cafe-el-remanso', 'cafe-kennedy',
   'cafe-ormaza', 'cafe-san-nicolas', 'cafe-comuna-del-cafe'
 ) and telefono is null;
