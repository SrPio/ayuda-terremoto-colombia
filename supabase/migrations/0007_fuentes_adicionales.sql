-- ============================================================================
-- 0007_fuentes_adicionales.sql — Segunda ronda de fuentes
--
-- Fuentes de esta migración:
--
--   [RN]  Radio Nacional — "Estos son los puntos de acopio y recepción de
--         ayudas en ciudades de Colombia"
--         https://www.radionacional.co/actualidad/estos-son-los-puntos-de-acopio-y-recepcion-de-ayudas-en-ciudades-de-colombia
--
--   [EC]  El Colombiano — "Medellín habilita puntos para donar ayudas a
--         afectados por el terremoto"
--         https://www.elcolombiano.com/medellin/medellin-habilita-puntos-para-donar-ayudas-afectados-terremoto-FH39857561
--
--   [PZ]  Pulzo — "Donaciones para Chocó: punto de acopio en Bogotá y lista de
--         artículos necesarios"
--         https://www.pulzo.com/nacion/bogota/donaciones-para-choco-punto-de-acopio-en-bogota-y-lista-de-articulos-necesarios-PP5272708A
--
--   [BOG] Alcaldía Mayor de Bogotá — "Qué donar y no donar en Bogotá para
--         damnificados del terremoto"
--         https://bogota.gov.co/mi-ciudad/ambiente/que-donar-y-no-donar-en-bogota-para-damnificados-terremoto-colombia
--
-- Igual que en el seed original: se agregan horarios y artículos donde la
-- fuente los publica, y NO se inventan cantidades. Las coordenadas de los
-- puntos nuevos son el centro del municipio (precision_ubicacion = 'ciudad'),
-- porque ninguna de estas fuentes publica la dirección exacta de los sitios
-- nuevos.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Dos categorías nuevas.
--
-- Aparecen por primera vez en las listas oficiales de Bogotá [PZ][BOG]: la
-- emergencia pasó de la fase de auxilio inmediato a la de rehabilitación, y con
-- ella cambió lo que se pide. Menaje de cocina para las familias que perdieron
-- todo, y materiales para reconstruir.
-- ---------------------------------------------------------------------------
insert into public.need_categories (slug, nombre, emoji, unidad_sugerida, descripcion, orden) values
  ('menaje-cocina', 'Menaje de cocina', '🍲', 'unidades',
   'Ollas, chocolateras, platos hondos, pocillos y cucharas grandes en aluminio, acero inoxidable o plástico resistente.', 85),
  ('materiales-construccion', 'Materiales de construcción', '🧱', 'unidades',
   'Cemento, varilla, alambre, malla, zinc, clavos, tubería sanitaria e hidráulica, sanitarios, ladrillos y baldosas.', 95)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Puntos nuevos
-- ---------------------------------------------------------------------------
insert into public.collection_points (
  slug, nombre, department_code, ciudad, direccion, organizacion, horario,
  descripcion, lat, lng, acepta_transporte_grande, status, verificado, fuente_url
)
select
  v.slug, v.nombre, v.department_code, v.ciudad, v.direccion, v.organizacion,
  v.horario, v.descripcion, v.lat, v.lng, v.transporte_grande, 'approved', true, v.fuente
from (values
  -- ===================== VALLE DEL CAUCA — Cali [RN] =====================
  ('escuela-nacional-deporte-cali', 'Escuela Nacional del Deporte', 'valle', 'Cali',
   null::text, 'Alcaldía de Cali — campaña Todos Somos Valle',
   'Todos los días, 8:00 a.m. a 6:00 p.m.',
   'Segundo punto central de Cali. Confirmar la dirección exacta antes de ir: la fuente no la publica.',
   3.4516, -76.5320, true,
   'https://www.radionacional.co/actualidad/estos-son-los-puntos-de-acopio-y-recepcion-de-ayudas-en-ciudades-de-colombia'),

  -- ===================== ANTIOQUIA — Medellín [EC][RN] ====================
  -- La Alcaldía habilitó diez puntos. Tres ya estaban en el seed (Banco
  -- Arquidiocesano, Saciar y el parque principal de Itagüí); estos son los que
  -- faltaban. Ninguna de las dos fuentes publica direcciones ni horarios por
  -- sede, así que van con la coordenada de la ciudad y el aviso correspondiente.
  ('parque-biblioteca-belen', 'Parque Biblioteca Belén', 'antioquia', 'Medellín',
   null, 'Alcaldía de Medellín', null,
   'Punto habilitado por la Alcaldía. No reciben medicamentos, ropa, alimentos vencidos ni perecederos. Confirmar horario antes de ir.',
   6.2442, -75.5812, false,
   'https://www.elcolombiano.com/medellin/medellin-habilita-puntos-para-donar-ayudas-afectados-terremoto-FH39857561'),
  ('parque-biblioteca-san-javier', 'Parque Biblioteca San Javier', 'antioquia', 'Medellín',
   null, 'Alcaldía de Medellín', null,
   'Punto habilitado por la Alcaldía. No reciben medicamentos, ropa, alimentos vencidos ni perecederos. Confirmar horario antes de ir.',
   6.2442, -75.5812, false,
   'https://www.elcolombiano.com/medellin/medellin-habilita-puntos-para-donar-ayudas-afectados-terremoto-FH39857561'),
  ('parque-biblioteca-garcia-marquez', 'Parque Biblioteca Gabriel García Márquez', 'antioquia', 'Medellín',
   null, 'Alcaldía de Medellín', null,
   'Punto habilitado por la Alcaldía. No reciben medicamentos, ropa, alimentos vencidos ni perecederos. Confirmar horario antes de ir.',
   6.2442, -75.5812, false,
   'https://www.elcolombiano.com/medellin/medellin-habilita-puntos-para-donar-ayudas-afectados-terremoto-FH39857561'),
  ('parque-biblioteca-leon-de-greiff', 'Parque Biblioteca León de Greiff', 'antioquia', 'Medellín',
   null, 'Alcaldía de Medellín', null,
   'Punto habilitado por la Alcaldía. No reciben medicamentos, ropa, alimentos vencidos ni perecederos. Confirmar horario antes de ir.',
   6.2442, -75.5812, false,
   'https://www.elcolombiano.com/medellin/medellin-habilita-puntos-para-donar-ayudas-afectados-terremoto-FH39857561'),
  ('biblioteca-publica-el-poblado', 'Biblioteca Pública El Poblado', 'antioquia', 'Medellín',
   null, 'Alcaldía de Medellín', null,
   'Punto habilitado por la Alcaldía. No reciben medicamentos, ropa, alimentos vencidos ni perecederos. Confirmar horario antes de ir.',
   6.2442, -75.5812, false,
   'https://www.elcolombiano.com/medellin/medellin-habilita-puntos-para-donar-ayudas-afectados-terremoto-FH39857561'),
  ('terminal-del-norte-medellin', 'Terminal del Norte — local 9840', 'antioquia', 'Medellín',
   'Terminal de Transporte del Norte, local 9840', 'Alcaldía de Medellín', null,
   'Punto habilitado por la Alcaldía. No reciben medicamentos, ropa, alimentos vencidos ni perecederos.',
   6.2442, -75.5812, true,
   'https://www.elcolombiano.com/medellin/medellin-habilita-puntos-para-donar-ayudas-afectados-terremoto-FH39857561'),
  ('universidad-eafit-medellin', 'Universidad EAFIT — placa cubierta', 'antioquia', 'Medellín',
   'Universidad EAFIT, placa cubierta', 'Universidad EAFIT', null,
   'Punto habilitado por la Alcaldía. No reciben medicamentos, ropa, alimentos vencidos ni perecederos.',
   6.2442, -75.5812, false,
   'https://www.elcolombiano.com/medellin/medellin-habilita-puntos-para-donar-ayudas-afectados-terremoto-FH39857561'),
  ('hall-alcaldia-medellin', 'Hall de la Alcaldía de Medellín', 'antioquia', 'Medellín',
   'Centro Administrativo La Alpujarra', 'Alcaldía de Medellín', null,
   'Punto habilitado por la Alcaldía. No reciben medicamentos, ropa, alimentos vencidos ni perecederos.',
   6.2442, -75.5812, false,
   'https://www.elcolombiano.com/medellin/medellin-habilita-puntos-para-donar-ayudas-afectados-terremoto-FH39857561')
) as v(
  slug, nombre, department_code, ciudad, direccion, organizacion, horario,
  descripcion, lat, lng, transporte_grande, fuente
)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Horarios que publican las fuentes nuevas y que el seed no tenía [BOG][PZ][RN]
-- ---------------------------------------------------------------------------
update public.collection_points set horario = '8:00 a.m. a 9:00 p.m.'
  where slug in ('utadeo-bogota', 'punto-usaquen') and horario is null;

update public.collection_points set horario = '9:00 a.m. a 5:00 p.m.'
  where slug = 'unicentro-bogota' and horario is null;

update public.collection_points set horario = 'Todos los días, 8:00 a.m. a 6:00 p.m.'
  where slug = 'plazoleta-jairo-varela' and horario is null;

update public.collection_points set horario = '24 horas'
  where slug = 'alcaldia-barranquilla' and horario is null;

update public.collection_points
   set direccion = 'Carrera 43 #6-120, sector Barranquillita'
 where slug = 'alcaldia-barranquilla';

update public.collection_points
   set direccion = 'Avenida NQS con carrera 30, entre calles 53B y 57'
 where slug = 'el-campin-bogota' and direccion is null;

-- El Palacio de los Deportes aparece en dos fuentes con direcciones distintas:
-- El Tiempo lo lista como punto de la Cruz Roja en "Calle 63 #59A-06" y
-- Pulzo/Bogotá como punto de la Alcaldía Mayor en "Calle 63 #54A-06". Es el
-- mismo recinto. No elegimos una en silencio: se deja la del seed y se advierte
-- la discrepancia, para que la moderación la resuelva con una llamada.
update public.collection_points
   set horario = '8:00 a.m. a 8:00 p.m.',
       descripcion = 'Opera también como punto de la Alcaldía Mayor con destino específico al Chocó. '
                     || 'Atención: dos fuentes publican direcciones distintas para este recinto '
                     || '(Calle 63 #59A-06 y Calle 63 #54A-06). Confirmar por teléfono antes de ir.'
 where slug = 'cruz-roja-palacio-deportes';

update public.collection_points
   set descripcion = 'La jornada de donación de sangre inicia el lunes desde las 12:30 p.m.'
 where slug = 'bomberos-palogrande';

-- ---------------------------------------------------------------------------
-- Necesidades de los puntos nuevos
--
-- Urgencia según la misma regla del seed: 'alta' en departamentos con daño
-- directo, 'media' en el resto.
-- ---------------------------------------------------------------------------
insert into public.point_needs (point_id, category_slug, urgencia, unidad, notas)
select p.id, v.categoria, v.urgencia::public.nivel_urgencia, c.unidad_sugerida, v.notas
from (values
  -- Cali: la fuente detalla una lista larga [RN]
  ('escuela-nacional-deporte-cali', 'agua', 'alta', 'Incluye bebidas hidratantes.'),
  ('escuela-nacional-deporte-cali', 'alimentos-no-perecederos', 'alta', null::text),
  ('escuela-nacional-deporte-cali', 'medicamentos-insumos', 'alta', 'Alcohol, vendajes, gasas y tapabocas.'),
  ('escuela-nacional-deporte-cali', 'cobijas-colchonetas', 'alta', 'Colchonetas, sábanas y cobijas.'),
  ('escuela-nacional-deporte-cali', 'herramientas-epp', 'alta', 'Picas, guantes, linternas, cascos y gafas.'),
  ('escuela-nacional-deporte-cali', 'ropa', 'alta', null),

  -- Medellín: los diez puntos reciben la misma lista [EC]
  ('parque-biblioteca-belen', 'alimentos-no-perecederos', 'media', null),
  ('parque-biblioteca-belen', 'aseo-personal', 'media', null),
  ('parque-biblioteca-belen', 'panales-bebe', 'media', null),
  ('parque-biblioteca-belen', 'cobijas-colchonetas', 'media', null),
  ('parque-biblioteca-san-javier', 'alimentos-no-perecederos', 'media', null),
  ('parque-biblioteca-san-javier', 'aseo-personal', 'media', null),
  ('parque-biblioteca-san-javier', 'panales-bebe', 'media', null),
  ('parque-biblioteca-san-javier', 'cobijas-colchonetas', 'media', null),
  ('parque-biblioteca-garcia-marquez', 'alimentos-no-perecederos', 'media', null),
  ('parque-biblioteca-garcia-marquez', 'aseo-personal', 'media', null),
  ('parque-biblioteca-garcia-marquez', 'panales-bebe', 'media', null),
  ('parque-biblioteca-garcia-marquez', 'cobijas-colchonetas', 'media', null),
  ('parque-biblioteca-leon-de-greiff', 'alimentos-no-perecederos', 'media', null),
  ('parque-biblioteca-leon-de-greiff', 'aseo-personal', 'media', null),
  ('parque-biblioteca-leon-de-greiff', 'panales-bebe', 'media', null),
  ('parque-biblioteca-leon-de-greiff', 'cobijas-colchonetas', 'media', null),
  ('biblioteca-publica-el-poblado', 'alimentos-no-perecederos', 'media', null),
  ('biblioteca-publica-el-poblado', 'aseo-personal', 'media', null),
  ('biblioteca-publica-el-poblado', 'panales-bebe', 'media', null),
  ('biblioteca-publica-el-poblado', 'cobijas-colchonetas', 'media', null),
  ('terminal-del-norte-medellin', 'alimentos-no-perecederos', 'media', null),
  ('terminal-del-norte-medellin', 'aseo-personal', 'media', null),
  ('terminal-del-norte-medellin', 'panales-bebe', 'media', null),
  ('terminal-del-norte-medellin', 'cobijas-colchonetas', 'media', null),
  ('universidad-eafit-medellin', 'alimentos-no-perecederos', 'media', null),
  ('universidad-eafit-medellin', 'aseo-personal', 'media', null),
  ('universidad-eafit-medellin', 'panales-bebe', 'media', null),
  ('universidad-eafit-medellin', 'cobijas-colchonetas', 'media', null),
  ('hall-alcaldia-medellin', 'alimentos-no-perecederos', 'media', null),
  ('hall-alcaldia-medellin', 'aseo-personal', 'media', null),
  ('hall-alcaldia-medellin', 'panales-bebe', 'media', null),
  ('hall-alcaldia-medellin', 'cobijas-colchonetas', 'media', null)
) as v(punto_slug, categoria, urgencia, notas)
join public.collection_points p on p.slug = v.punto_slug
join public.need_categories c   on c.slug = v.categoria
on conflict (point_id, category_slug) do nothing;

-- ---------------------------------------------------------------------------
-- Necesidades adicionales de puntos que ya estaban, según las fuentes nuevas
-- ---------------------------------------------------------------------------
insert into public.point_needs (point_id, category_slug, urgencia, unidad, notas)
select p.id, v.categoria, v.urgencia::public.nivel_urgencia, c.unidad_sugerida, v.notas
from (values
  -- Cali, Plazoleta Jairo Varela: la lista completa de [RN] amplía la de El Tiempo
  ('plazoleta-jairo-varela', 'alimentos-no-perecederos', 'alta', null::text),
  ('plazoleta-jairo-varela', 'medicamentos-insumos', 'alta', 'Alcohol, vendajes, gasas y tapabocas.'),
  ('plazoleta-jairo-varela', 'ropa', 'alta', null),

  -- Barranquilla [RN]
  ('alcaldia-barranquilla', 'medicamentos-insumos', 'media', 'Insumos médicos.'),
  ('alcaldia-barranquilla', 'panales-bebe', 'media', 'Artículos para bebés.'),
  ('alcaldia-barranquilla', 'cobijas-colchonetas', 'media', null),
  ('alcaldia-barranquilla', 'ropa', 'media', null),

  -- Bogotá, Palacio de los Deportes: la lista de la Alcaldía Mayor incluye
  -- menaje y materiales de construcción, que son la fase de rehabilitación [PZ]
  ('cruz-roja-palacio-deportes', 'menaje-cocina', 'media', 'Ollas, chocolateras, platos hondos, pocillos y cucharas grandes.'),
  ('cruz-roja-palacio-deportes', 'materiales-construccion', 'media', 'Cemento, varilla, zinc, tubería, sanitarios, ladrillos y baldosas.'),
  ('cruz-roja-palacio-deportes', 'agua-tanques', 'media', 'Tanques de agua.'),
  ('cruz-roja-palacio-deportes', 'ropa', 'media', 'Ropa en buen estado. La ropa interior debe ser nueva.'),
  ('cruz-roja-palacio-deportes', 'panales-bebe', 'media', 'Pañales de niño y de adulto.')
) as v(punto_slug, categoria, urgencia, notas)
join public.collection_points p on p.slug = v.punto_slug
join public.need_categories c   on c.slug = v.categoria
on conflict (point_id, category_slug) do nothing;
