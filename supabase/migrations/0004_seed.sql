-- ============================================================================
-- 0004_seed.sql — Datos iniciales
--
-- Fuente de los puntos de acopio:
--   El Tiempo — "Este es el mapa completo de los centros de acopio habilitados
--   en Colombia para ayudar a los damnificados del terremoto de magnitud 7,4"
--   https://www.eltiempo.com/datos/este-es-el-mapa-completo-de-los-centros-de-acopio-habilitados-en-colombia-para-ayudar-a-los-damnificados-del-terremoto-de-magnitud-7-3577654
--
-- HONESTIDAD DE LOS DATOS — leer antes de tocar este archivo:
--
-- 1. El artículo publica nombres, direcciones y qué recibe cada punto, pero NO
--    publica cantidades. Por eso todas las necesidades entran con
--    cantidad_solicitada = NULL, que significa "aquí reciben esto, sin cifra
--    confirmada". Inventar un "faltan 80 cajas" sería fabricar información que
--    la gente usaría para tomar decisiones de logística real. Las cifras se
--    cargan desde el panel de moderación cuando alguien las confirma con el
--    punto.
--
-- 2. La urgencia sí es un valor editorial de arranque, y se asigna con una
--    regla explícita y única: 'alta' en los departamentos con daño directo por
--    el sismo, 'critica' donde el artículo reporta un llamado específico
--    (donación de sangre O+ y O−), 'media' en el resto del país, que opera
--    como retaguardia logística. Cualquier moderador puede corregirla.
--
-- 3. Las coordenadas de los puntos con dirección publicada se refinan con
--    scripts/geocode-seed.mjs (Nominatim). Los puntos sin dirección exacta
--    quedan en el centro de su ciudad, y la app lo advierte en la interfaz.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Departamentos
-- afectado = true en las zonas con daño directo reportado: Chocó (epicentro en
-- San José del Palmar), Valle del Cauca, Risaralda, Caldas y Quindío.
-- ---------------------------------------------------------------------------
insert into public.departments (code, nombre, region, dane, lat, lng, afectado) values
  ('amazonas',           'Amazonas',                     'Amazonía',  '91', -2.20,  -71.94, false),
  ('antioquia',          'Antioquia',                    'Andina',    '05',  6.55,  -75.82, false),
  ('arauca',             'Arauca',                       'Orinoquía', '81',  6.55,  -71.00, false),
  ('atlantico',          'Atlántico',                    'Caribe',    '08', 10.67,  -74.96, false),
  ('bogota',             'Bogotá D.C.',                  'Andina',    '11',  4.65,  -74.10, false),
  ('bolivar',            'Bolívar',                      'Caribe',    '13',  8.75,  -74.20, false),
  ('boyaca',             'Boyacá',                       'Andina',    '15',  5.75,  -73.20, false),
  ('caldas',             'Caldas',                       'Andina',    '17',  5.30,  -75.30, true),
  ('caqueta',            'Caquetá',                      'Amazonía',  '18',  0.87,  -74.00, false),
  ('casanare',           'Casanare',                     'Orinoquía', '85',  5.40,  -71.60, false),
  ('cauca',              'Cauca',                        'Pacífica',  '19',  2.40,  -76.80, false),
  ('cesar',              'Cesar',                        'Caribe',    '20',  9.50,  -73.60, false),
  ('choco',              'Chocó',                        'Pacífica',  '27',  5.70,  -76.90, true),
  ('cordoba',            'Córdoba',                      'Caribe',    '23',  8.35,  -75.80, false),
  ('cundinamarca',       'Cundinamarca',                 'Andina',    '25',  4.90,  -74.35, false),
  ('guainia',            'Guainía',                      'Amazonía',  '94',  2.60,  -69.00, false),
  ('guaviare',           'Guaviare',                     'Amazonía',  '95',  1.90,  -72.30, false),
  ('huila',              'Huila',                        'Andina',    '41',  2.55,  -75.55, false),
  ('la-guajira',         'La Guajira',                   'Caribe',    '44', 11.35,  -72.50, false),
  ('magdalena',          'Magdalena',                    'Caribe',    '47', 10.20,  -74.30, false),
  ('meta',               'Meta',                         'Orinoquía', '50',  3.50,  -73.10, false),
  ('narino',             'Nariño',                       'Pacífica',  '52',  1.35,  -77.60, false),
  ('norte-de-santander', 'Norte de Santander',           'Andina',    '54',  7.95,  -72.90, false),
  ('putumayo',           'Putumayo',                     'Amazonía',  '86',  0.55,  -76.20, false),
  ('quindio',            'Quindío',                      'Andina',    '63',  4.46,  -75.68, true),
  ('risaralda',          'Risaralda',                    'Andina',    '66',  5.10,  -75.85, true),
  ('san-andres',         'San Andrés y Providencia',     'Insular',   '88', 12.55,  -81.72, false),
  ('santander',          'Santander',                    'Andina',    '68',  6.80,  -73.40, false),
  ('sucre',              'Sucre',                        'Caribe',    '70',  9.10,  -75.10, false),
  ('tolima',             'Tolima',                       'Andina',    '73',  4.10,  -75.20, false),
  ('valle',              'Valle del Cauca',              'Pacífica',  '76',  3.80,  -76.30, true),
  ('vaupes',             'Vaupés',                       'Amazonía',  '97',  0.60,  -70.60, false),
  ('vichada',            'Vichada',                      'Orinoquía', '99',  4.70,  -69.50, false);

-- ---------------------------------------------------------------------------
-- Categorías de necesidad
-- Catálogo cerrado. El orden es el de la interfaz: primero lo que salva vidas.
-- ---------------------------------------------------------------------------
insert into public.need_categories (slug, nombre, emoji, unidad_sugerida, descripcion, orden) values
  ('agua',                    'Agua',                     '💧', 'cajas',    'Agua embotellada, bolsas o botellones sellados.', 10),
  ('alimentos-no-perecederos','Alimentos no perecederos', '🥫', 'cajas',    'Enlatados, granos, arroz, aceite, panela. Revisar siempre la fecha de vencimiento.', 20),
  ('medicamentos-insumos',    'Medicamentos e insumos',   '💊', 'cajas',    'Insumos médicos, primeros auxilios y medicamentos sin abrir y vigentes.', 30),
  ('sangre',                  'Donación de sangre',       '🩸', 'donantes', 'No es un objeto: es presentarse a donar. Los tipos O+ y O− son los más solicitados.', 40),
  ('aseo-personal',           'Aseo personal',            '🧼', 'kits',     'Jabón, cepillos, crema dental, papel higiénico, toallas higiénicas.', 50),
  ('cobijas-colchonetas',     'Cobijas y colchonetas',    '🛏️', 'unidades', 'Cobijas, mantas, colchonetas y toldillos para alojamientos temporales.', 60),
  ('herramientas-epp',        'Herramientas y protección','🦺', 'unidades', 'Guantes de construcción, gafas de seguridad, cascos, palas, linternas.', 70),
  ('panales-bebe',            'Pañales y bebé',           '🍼', 'paquetes', 'Pañales, leche de formula, teteros, ropa de bebé.', 80),
  ('agua-tanques',            'Agua en tanques',          '🚰', 'tanques',  'Tanques, canecas y contenedores para almacenar agua.', 90),
  ('mascotas',                'Alimento para mascotas',   '🐾', 'bultos',   'Concentrado, guacales, correas. Las mascotas también quedaron damnificadas.', 100),
  ('ropa',                    'Ropa',                     '👕', 'bolsas',   'Ropa en buen estado y limpia. Varios puntos ya no la reciben: confirmar antes.', 110);

-- ---------------------------------------------------------------------------
-- Puntos de acopio
-- ---------------------------------------------------------------------------
insert into public.collection_points (
  slug, nombre, department_code, ciudad, direccion, organizacion, horario,
  descripcion, lat, lng, acepta_transporte_grande, status, verificado, fuente_url
)
select
  v.slug, v.nombre, v.department_code, v.ciudad, v.direccion, v.organizacion,
  v.horario, v.descripcion, v.lat, v.lng, v.transporte_grande, 'approved',
  true,
  'https://www.eltiempo.com/datos/este-es-el-mapa-completo-de-los-centros-de-acopio-habilitados-en-colombia-para-ayudar-a-los-damnificados-del-terremoto-de-magnitud-7-3577654'
from (values
  -- ===================== BOGOTÁ — Cruz Roja (6 sedes) =====================
  ('cruz-roja-samu-sur', 'Cruz Roja — SAMU Sur', 'bogota', 'Bogotá',
   'Avenida carrera 68 #31-41 sur', 'Cruz Roja Seccional Cundinamarca y Bogotá',
   null::text, null::text, 4.7110, -74.0721, true),
  ('cruz-roja-samu-norte', 'Cruz Roja — SAMU Norte', 'bogota', 'Bogotá',
   'Calle 134 – carrera 7B bis #132-31', 'Cruz Roja Seccional Cundinamarca y Bogotá',
   null, null, 4.7110, -74.0721, true),
  ('cruz-roja-salvamento-acuatico', 'Cruz Roja — Centro de Salvamento Acuático', 'bogota', 'Bogotá',
   'Avenida La Esmeralda #63-81', 'Cruz Roja Seccional Cundinamarca y Bogotá',
   null, null, 4.7110, -74.0721, true),
  ('cruz-roja-sede-administrativa', 'Cruz Roja — Sede administrativa', 'bogota', 'Bogotá',
   'Carrera 24 #73-38', 'Cruz Roja Seccional Cundinamarca y Bogotá',
   '24 horas', 'Sede habilitada de forma permanente durante la emergencia.',
   4.7110, -74.0721, true),
  ('cruz-roja-bodega', 'Cruz Roja — Bodega', 'bogota', 'Bogotá',
   'Diagonal 79B #62-53', 'Cruz Roja Seccional Cundinamarca y Bogotá',
   null, 'Bodega de consolidación: es el punto indicado para donaciones grandes.',
   4.7110, -74.0721, true),
  ('cruz-roja-palacio-deportes', 'Cruz Roja — Palacio de los Deportes', 'bogota', 'Bogotá',
   'Calle 63 #59A-06', 'Cruz Roja Seccional Cundinamarca y Bogotá',
   null, null, 4.7110, -74.0721, true),

  -- ===================== BOGOTÁ — Alcaldía (4 puntos) =====================
  ('utadeo-bogota', 'Universidad Jorge Tadeo Lozano', 'bogota', 'Bogotá',
   'Carrera 4 #22-61', 'Alcaldía de Bogotá',
   null, 'Habilitado desde el 11 de agosto de 2026.', 4.7110, -74.0721, false),
  ('punto-usaquen', 'Punto Usaquén', 'bogota', 'Bogotá',
   'Calle 161A #7F-55', 'Alcaldía de Bogotá',
   null, 'Habilitado desde el 11 de agosto de 2026.', 4.7110, -74.0721, false),
  ('unicentro-bogota', 'Centro comercial Unicentro', 'bogota', 'Bogotá',
   'Carrera 15 #124-30', 'Alcaldía de Bogotá',
   null, 'Habilitado desde el 11 de agosto de 2026.', 4.7110, -74.0721, false),
  ('el-campin-bogota', 'Estadio Nemesio Camacho El Campín', 'bogota', 'Bogotá',
   null, 'Sencia', null, null, 4.7110, -74.0721, true),

  -- ===================== CUNDINAMARCA =====================
  ('plaza-de-la-paz-cundinamarca', 'Plaza de la Paz', 'cundinamarca', 'Bogotá',
   null, 'Gobernación de Cundinamarca', null,
   'Recibe también artículos para mascotas.', 4.7110, -74.0721, false),
  ('licores-cundinamarca', 'Empresa de Licores de Cundinamarca', 'cundinamarca', 'Cota',
   'Autopista Medellín, km 3,8, vía Siberia-Cota', 'Gobernación de Cundinamarca', null,
   'Bodega con acceso para vehículos de carga. Recibe también artículos para mascotas.',
   4.8094, -74.1017, true),

  -- ===================== VALLE DEL CAUCA =====================
  ('plazoleta-jairo-varela', 'Plazoleta Jairo Varela', 'valle', 'Cali',
   null, 'Alcaldía de Cali — campaña Todos Somos Valle', null,
   'Punto central de Cali. Piden con prioridad agua y elementos de protección para las labores de rescate.',
   3.4516, -76.5320, true),
  ('banco-alimentos-cali', 'Banco de Alimentos de Cali', 'valle', 'Cali',
   'Calle 24 #6-103', 'Banco de Alimentos', null, null, 3.4516, -76.5320, true),
  ('hospital-universitario-valle', 'Hospital Universitario del Valle', 'valle', 'Cali',
   null, 'Hospital Universitario del Valle', null,
   'Donación de sangre. Los tipos más urgentes son O+ y O−.', 3.4516, -76.5320, false),
  ('banco-alimentos-buenaventura', 'Banco de Alimentos de Buenaventura', 'valle', 'Buenaventura',
   'Avenida Simón Bolívar #47C-70, interior Colegio Seminario', 'Banco de Alimentos',
   null, null, 3.8801, -77.0313, true),

  -- ===================== RISARALDA — Pereira (CAFE) =====================
  ('cafe-consota', 'Centro de Atención CAFE — Consota', 'risaralda', 'Pereira',
   null, 'Alcaldía de Pereira', null, null, 4.8133, -75.6961, false),
  ('cafe-perla-del-otun', 'Centro de Atención CAFE — Perla del Otún', 'risaralda', 'Pereira',
   null, 'Alcaldía de Pereira', null, null, 4.8133, -75.6961, false),
  ('cafe-el-remanso', 'Centro de Atención CAFE — El Remanso', 'risaralda', 'Pereira',
   null, 'Alcaldía de Pereira', null, null, 4.8133, -75.6961, false),
  ('cafe-kennedy', 'Centro de Atención CAFE — Kennedy', 'risaralda', 'Pereira',
   null, 'Alcaldía de Pereira', null, null, 4.8133, -75.6961, false),
  ('cafe-ormaza', 'Centro de Atención CAFE — Ormaza', 'risaralda', 'Pereira',
   'Calle 3 bis #5-38', 'Alcaldía de Pereira', null, null, 4.8133, -75.6961, false),
  ('cafe-san-nicolas', 'Centro de Atención CAFE — San Nicolás', 'risaralda', 'Pereira',
   'Carrera 14 bis #28-38', 'Alcaldía de Pereira', null, null, 4.8133, -75.6961, false),
  ('cafe-comuna-del-cafe', 'Centro de Atención CAFE — Comuna del Café', 'risaralda', 'Pereira',
   'Carrera 3 con calle 59A', 'Alcaldía de Pereira', null, null, 4.8133, -75.6961, false),
  ('banco-alimentos-dosquebradas', 'Banco de Alimentos — punto alterno La Badea', 'risaralda', 'Dosquebradas',
   'Transversal 5 #6-30, La Badea', 'Banco de Alimentos', null, null, 4.8342, -75.6746, true),

  -- ===================== CALDAS — Manizales =====================
  ('bomberos-palogrande', 'Canchas auxiliares — Estación de Bomberos Palogrande', 'caldas', 'Manizales',
   null, 'Bomberos de Manizales', null,
   'Donación de sangre. Los tipos más urgentes son O+ y O−.', 5.0703, -75.5138, false),
  ('hemocentro-del-cafe', 'Hemocentro del Café', 'caldas', 'Manizales',
   'Carrera 21 #70-06', 'Hemocentro del Café', null,
   'Donación de sangre. Los tipos más urgentes son O+ y O−.', 5.0703, -75.5138, false),
  ('banco-alimentos-manizales', 'Banco de Alimentos de Manizales', 'caldas', 'Manizales',
   'Calle 49 #27A-85', 'Banco de Alimentos', null,
   'Reciben específicamente alimentos no perecederos.', 5.0703, -75.5138, true),

  -- ===================== QUINDÍO — Armenia =====================
  ('banco-alimentos-armenia', 'Banco de Alimentos Monseñor Roberto López Londoño', 'quindio', 'Armenia',
   null, 'Banco de Alimentos', null, null, 4.5339, -75.6811, true),

  -- ===================== ANTIOQUIA =====================
  ('banco-arquidiocesano-medellin', 'Fundación Banco Arquidiocesano de Alimentos', 'antioquia', 'Medellín',
   'Carrera 52 #30A-97', 'Fundación Banco Arquidiocesano de Alimentos', null,
   'Campaña Colombia se levanta.', 6.2442, -75.5812, true),
  ('fundacion-saciar-medellin', 'Fundación Saciar', 'antioquia', 'Medellín',
   'Carrera 50 #25-261', 'Fundación Saciar', null,
   'Campaña Colombia se levanta.', 6.2442, -75.5812, true),
  ('parque-principal-itagui', 'Parque Principal de Itagüí', 'antioquia', 'Itagüí',
   null, 'Alcaldía de Itagüí', null, null, 6.1719, -75.5990, false),

  -- ===================== ATLÁNTICO =====================
  ('alcaldia-barranquilla', 'Alcaldía de Barranquilla', 'atlantico', 'Barranquilla',
   'Carrera 43 #6-120', 'Alcaldía de Barranquilla', null, null, 10.9685, -74.7813, false),
  ('gobernacion-atlantico-plaza-paz', 'Gobernación del Atlántico — Galería Plaza de la Paz', 'atlantico', 'Barranquilla',
   null, 'Gobernación del Atlántico', null, null, 10.9685, -74.7813, true),

  -- ===================== BOLÍVAR =====================
  ('coliseo-bernardo-caraballo', 'Coliseo Bernardo Caraballo', 'bolivar', 'Cartagena',
   null, 'Alcaldía de Cartagena', null, null, 10.3910, -75.4794, true),

  -- ===================== MAGDALENA =====================
  ('gestion-riesgo-santa-marta', 'Oficina de Gestión del Riesgo', 'magdalena', 'Santa Marta',
   'Calle 16 #14A-08', 'Alcaldía de Santa Marta', null, null, 11.2408, -74.1990, false),

  -- ===================== CÓRDOBA =====================
  ('coliseo-happy-lora', 'Coliseo Miguel Happy Lora', 'cordoba', 'Montería',
   null, 'Gobernación de Córdoba', null, null, 8.7479, -75.8814, true),
  ('punto-el-recreo-monteria', 'Punto ciudadano — Barrio El Recreo', 'cordoba', 'Montería',
   null, 'Iniciativa ciudadana', null, null, 8.7479, -75.8814, false),

  -- ===================== CESAR =====================
  ('diocesis-valledupar', 'Diócesis de Valledupar', 'cesar', 'Valledupar',
   null, 'Diócesis de Valledupar', null, null, 10.4631, -73.2532, false),
  ('centro-solidaridad-valledupar', 'Centro de Solidaridad', 'cesar', 'Valledupar',
   null, 'Alcaldía de Valledupar', null,
   'Recibe también donaciones para mascotas.', 10.4631, -73.2532, false),

  -- ===================== SANTANDER =====================
  ('alcaldia-bucaramanga', 'Alcaldía de Bucaramanga — primer piso', 'santander', 'Bucaramanga',
   null, 'Alcaldía de Bucaramanga', null, null, 7.1193, -73.1227, false),
  ('centroabastos-bucaramanga', 'Centroabastos', 'santander', 'Bucaramanga',
   null, 'Centroabastos', null,
   'Central de abastos con acceso para vehículos de carga.', 7.1193, -73.1227, true),

  -- ===================== SCARE — 16 sedes (medicamentos e insumos) =========
  ('scare-bogota', 'SCARE — sede Bogotá', 'bogota', 'Bogotá', null,
   'SCARE — Red de Sociedades Científicas', null,
   'Recibe medicamentos, insumos médicos y kits de alimento. Confirmar la dirección de la sede antes de ir.',
   4.7110, -74.0721, false),
  ('scare-medellin', 'SCARE — sede Medellín', 'antioquia', 'Medellín', null,
   'SCARE — Red de Sociedades Científicas', null,
   'Recibe medicamentos, insumos médicos y kits de alimento. Confirmar la dirección de la sede antes de ir.',
   6.2442, -75.5812, false),
  ('scare-barranquilla', 'SCARE — sede Barranquilla', 'atlantico', 'Barranquilla', null,
   'SCARE — Red de Sociedades Científicas', null,
   'Recibe medicamentos, insumos médicos y kits de alimento. Confirmar la dirección de la sede antes de ir.',
   10.9685, -74.7813, false),
  ('scare-cartagena', 'SCARE — sede Cartagena', 'bolivar', 'Cartagena', null,
   'SCARE — Red de Sociedades Científicas', null,
   'Recibe medicamentos, insumos médicos y kits de alimento. Confirmar la dirección de la sede antes de ir.',
   10.3910, -75.4794, false),
  ('scare-tunja', 'SCARE — sede Tunja', 'boyaca', 'Tunja', null,
   'SCARE — Red de Sociedades Científicas', null,
   'Recibe medicamentos, insumos médicos y kits de alimento. Confirmar la dirección de la sede antes de ir.',
   5.5353, -73.3678, false),
  ('scare-popayan', 'SCARE — sede Popayán', 'cauca', 'Popayán', null,
   'SCARE — Red de Sociedades Científicas', null,
   'Recibe medicamentos, insumos médicos y kits de alimento. Confirmar la dirección de la sede antes de ir.',
   2.4448, -76.6147, false),
  ('scare-valledupar', 'SCARE — sede Valledupar', 'cesar', 'Valledupar', null,
   'SCARE — Red de Sociedades Científicas', null,
   'Recibe medicamentos, insumos médicos y kits de alimento. Confirmar la dirección de la sede antes de ir.',
   10.4631, -73.2532, false),
  ('scare-monteria', 'SCARE — sede Montería', 'cordoba', 'Montería', null,
   'SCARE — Red de Sociedades Científicas', null,
   'Recibe medicamentos, insumos médicos y kits de alimento. Confirmar la dirección de la sede antes de ir.',
   8.7479, -75.8814, false),
  ('scare-riohacha', 'SCARE — sede Riohacha', 'la-guajira', 'Riohacha', null,
   'SCARE — Red de Sociedades Científicas', null,
   'Recibe medicamentos, insumos médicos y kits de alimento. Confirmar la dirección de la sede antes de ir.',
   11.5444, -72.9072, false),
  ('scare-neiva', 'SCARE — sede Neiva', 'huila', 'Neiva', null,
   'SCARE — Red de Sociedades Científicas', null,
   'Recibe medicamentos, insumos médicos y kits de alimento. Confirmar la dirección de la sede antes de ir.',
   2.9273, -75.2819, false),
  ('scare-santa-marta', 'SCARE — sede Santa Marta', 'magdalena', 'Santa Marta', null,
   'SCARE — Red de Sociedades Científicas', null,
   'Recibe medicamentos, insumos médicos y kits de alimento. Confirmar la dirección de la sede antes de ir.',
   11.2408, -74.1990, false),
  ('scare-villavicencio', 'SCARE — sede Villavicencio', 'meta', 'Villavicencio', null,
   'SCARE — Red de Sociedades Científicas', null,
   'Recibe medicamentos, insumos médicos y kits de alimento. Confirmar la dirección de la sede antes de ir.',
   4.1420, -73.6266, false),
  ('scare-pasto', 'SCARE — sede Pasto', 'narino', 'Pasto', null,
   'SCARE — Red de Sociedades Científicas', null,
   'Recibe medicamentos, insumos médicos y kits de alimento. Confirmar la dirección de la sede antes de ir.',
   1.2136, -77.2811, false),
  ('scare-cucuta', 'SCARE — sede Cúcuta', 'norte-de-santander', 'Cúcuta', null,
   'SCARE — Red de Sociedades Científicas', null,
   'Recibe medicamentos, insumos médicos y kits de alimento. Confirmar la dirección de la sede antes de ir.',
   7.8891, -72.4967, false),
  ('scare-bucaramanga', 'SCARE — sede Bucaramanga', 'santander', 'Bucaramanga', null,
   'SCARE — Red de Sociedades Científicas', null,
   'Recibe medicamentos, insumos médicos y kits de alimento. Confirmar la dirección de la sede antes de ir.',
   7.1193, -73.1227, false),
  ('scare-sincelejo', 'SCARE — sede Sincelejo', 'sucre', 'Sincelejo', null,
   'SCARE — Red de Sociedades Científicas', null,
   'Recibe medicamentos, insumos médicos y kits de alimento. Confirmar la dirección de la sede antes de ir.',
   9.3047, -75.3978, false)
) as v(
  slug, nombre, department_code, ciudad, direccion, organizacion, horario,
  descripcion, lat, lng, transporte_grande
);

-- ---------------------------------------------------------------------------
-- Necesidades por punto
--
-- cantidad_solicitada queda en NULL en todo el seed: el artículo publica QUÉ
-- recibe cada punto, no CUÁNTO. Las cifras las carga la moderación cuando se
-- confirman con el punto.
--
-- Regla de urgencia inicial:
--   critica → llamado explícito de donación de sangre (O+ y O−)
--   alta    → puntos en departamentos con daño directo (Chocó, Valle,
--             Risaralda, Caldas, Quindío)
--   media   → resto del país (retaguardia logística)
-- ---------------------------------------------------------------------------
insert into public.point_needs (point_id, category_slug, urgencia, unidad, notas)
select
  p.id,
  v.categoria,
  v.urgencia::public.nivel_urgencia,
  c.unidad_sugerida,
  v.notas
from (values
  -- Bogotá — Cruz Roja: agua embotellada, cobijas, mantas, colchonetas,
  -- toldillos, alimentos no perecederos, primeros auxilios y aseo personal.
  ('cruz-roja-samu-sur', 'agua', 'media', null::text),
  ('cruz-roja-samu-sur', 'alimentos-no-perecederos', 'media', null),
  ('cruz-roja-samu-sur', 'cobijas-colchonetas', 'media', 'Incluye mantas y toldillos.'),
  ('cruz-roja-samu-sur', 'aseo-personal', 'media', null),
  ('cruz-roja-samu-sur', 'medicamentos-insumos', 'media', 'Elementos de primeros auxilios.'),
  ('cruz-roja-samu-norte', 'agua', 'media', null),
  ('cruz-roja-samu-norte', 'alimentos-no-perecederos', 'media', null),
  ('cruz-roja-samu-norte', 'cobijas-colchonetas', 'media', 'Incluye mantas y toldillos.'),
  ('cruz-roja-samu-norte', 'aseo-personal', 'media', null),
  ('cruz-roja-samu-norte', 'medicamentos-insumos', 'media', 'Elementos de primeros auxilios.'),
  ('cruz-roja-salvamento-acuatico', 'agua', 'media', null),
  ('cruz-roja-salvamento-acuatico', 'alimentos-no-perecederos', 'media', null),
  ('cruz-roja-salvamento-acuatico', 'cobijas-colchonetas', 'media', null),
  ('cruz-roja-salvamento-acuatico', 'aseo-personal', 'media', null),
  ('cruz-roja-sede-administrativa', 'agua', 'media', null),
  ('cruz-roja-sede-administrativa', 'alimentos-no-perecederos', 'media', null),
  ('cruz-roja-sede-administrativa', 'cobijas-colchonetas', 'media', null),
  ('cruz-roja-sede-administrativa', 'aseo-personal', 'media', null),
  ('cruz-roja-sede-administrativa', 'medicamentos-insumos', 'media', 'Elementos de primeros auxilios.'),
  ('cruz-roja-bodega', 'agua', 'media', null),
  ('cruz-roja-bodega', 'alimentos-no-perecederos', 'media', null),
  ('cruz-roja-bodega', 'cobijas-colchonetas', 'media', null),
  ('cruz-roja-bodega', 'aseo-personal', 'media', null),
  ('cruz-roja-palacio-deportes', 'agua', 'media', null),
  ('cruz-roja-palacio-deportes', 'alimentos-no-perecederos', 'media', null),
  ('cruz-roja-palacio-deportes', 'cobijas-colchonetas', 'media', null),
  ('cruz-roja-palacio-deportes', 'aseo-personal', 'media', null),

  -- Bogotá — Alcaldía
  ('utadeo-bogota', 'agua', 'media', null),
  ('utadeo-bogota', 'alimentos-no-perecederos', 'media', null),
  ('utadeo-bogota', 'aseo-personal', 'media', null),
  ('utadeo-bogota', 'cobijas-colchonetas', 'media', null),
  ('punto-usaquen', 'agua', 'media', null),
  ('punto-usaquen', 'alimentos-no-perecederos', 'media', null),
  ('punto-usaquen', 'aseo-personal', 'media', null),
  ('punto-usaquen', 'cobijas-colchonetas', 'media', null),
  ('unicentro-bogota', 'agua', 'media', null),
  ('unicentro-bogota', 'alimentos-no-perecederos', 'media', null),
  ('unicentro-bogota', 'aseo-personal', 'media', null),
  ('unicentro-bogota', 'cobijas-colchonetas', 'media', null),
  ('el-campin-bogota', 'agua', 'media', null),
  ('el-campin-bogota', 'alimentos-no-perecederos', 'media', null),
  ('el-campin-bogota', 'aseo-personal', 'media', null),
  ('el-campin-bogota', 'cobijas-colchonetas', 'media', null),

  -- Cundinamarca
  ('plaza-de-la-paz-cundinamarca', 'alimentos-no-perecederos', 'media', null),
  ('plaza-de-la-paz-cundinamarca', 'mascotas', 'media', null),
  ('licores-cundinamarca', 'alimentos-no-perecederos', 'media', null),
  ('licores-cundinamarca', 'mascotas', 'media', null),
  ('licores-cundinamarca', 'agua', 'media', null),

  -- Valle del Cauca — zona afectada
  ('plazoleta-jairo-varela', 'agua', 'alta', null),
  ('plazoleta-jairo-varela', 'herramientas-epp', 'alta', 'Piden expresamente guantes de construcción, gafas de seguridad y cascos.'),
  ('plazoleta-jairo-varela', 'cobijas-colchonetas', 'alta', 'Colchonetas para alojamientos temporales.'),
  ('banco-alimentos-cali', 'alimentos-no-perecederos', 'alta', 'Víveres.'),
  ('hospital-universitario-valle', 'sangre', 'critica', 'Prioridad O+ y O−.'),
  ('banco-alimentos-buenaventura', 'alimentos-no-perecederos', 'alta', null),

  -- Risaralda — zona afectada
  ('cafe-consota', 'agua', 'alta', null),
  ('cafe-consota', 'alimentos-no-perecederos', 'alta', null),
  ('cafe-consota', 'aseo-personal', 'alta', null),
  ('cafe-consota', 'cobijas-colchonetas', 'alta', null),
  ('cafe-perla-del-otun', 'agua', 'alta', null),
  ('cafe-perla-del-otun', 'alimentos-no-perecederos', 'alta', null),
  ('cafe-perla-del-otun', 'aseo-personal', 'alta', null),
  ('cafe-perla-del-otun', 'cobijas-colchonetas', 'alta', null),
  ('cafe-el-remanso', 'agua', 'alta', null),
  ('cafe-el-remanso', 'alimentos-no-perecederos', 'alta', null),
  ('cafe-el-remanso', 'aseo-personal', 'alta', null),
  ('cafe-el-remanso', 'cobijas-colchonetas', 'alta', null),
  ('cafe-kennedy', 'agua', 'alta', null),
  ('cafe-kennedy', 'alimentos-no-perecederos', 'alta', null),
  ('cafe-kennedy', 'aseo-personal', 'alta', null),
  ('cafe-kennedy', 'cobijas-colchonetas', 'alta', null),
  ('cafe-ormaza', 'agua', 'alta', null),
  ('cafe-ormaza', 'alimentos-no-perecederos', 'alta', null),
  ('cafe-ormaza', 'aseo-personal', 'alta', null),
  ('cafe-ormaza', 'cobijas-colchonetas', 'alta', null),
  ('cafe-san-nicolas', 'agua', 'alta', null),
  ('cafe-san-nicolas', 'alimentos-no-perecederos', 'alta', null),
  ('cafe-san-nicolas', 'aseo-personal', 'alta', null),
  ('cafe-san-nicolas', 'cobijas-colchonetas', 'alta', null),
  ('cafe-comuna-del-cafe', 'agua', 'alta', null),
  ('cafe-comuna-del-cafe', 'alimentos-no-perecederos', 'alta', null),
  ('cafe-comuna-del-cafe', 'aseo-personal', 'alta', null),
  ('cafe-comuna-del-cafe', 'cobijas-colchonetas', 'alta', null),
  ('banco-alimentos-dosquebradas', 'alimentos-no-perecederos', 'alta', null),

  -- Caldas — zona afectada
  ('bomberos-palogrande', 'sangre', 'critica', 'Prioridad O+ y O−.'),
  ('hemocentro-del-cafe', 'sangre', 'critica', 'Prioridad O+ y O−.'),
  ('banco-alimentos-manizales', 'alimentos-no-perecederos', 'alta', 'Reciben específicamente alimentos no perecederos.'),

  -- Quindío — zona afectada
  ('banco-alimentos-armenia', 'alimentos-no-perecederos', 'alta', null),

  -- Antioquia
  ('banco-arquidiocesano-medellin', 'alimentos-no-perecederos', 'media', null),
  ('fundacion-saciar-medellin', 'alimentos-no-perecederos', 'media', null),
  ('parque-principal-itagui', 'alimentos-no-perecederos', 'media', null),
  ('parque-principal-itagui', 'agua', 'media', null),
  ('parque-principal-itagui', 'aseo-personal', 'media', null),

  -- Atlántico
  ('alcaldia-barranquilla', 'alimentos-no-perecederos', 'media', null),
  ('alcaldia-barranquilla', 'aseo-personal', 'media', null),
  ('alcaldia-barranquilla', 'agua', 'media', null),
  ('gobernacion-atlantico-plaza-paz', 'alimentos-no-perecederos', 'media', null),
  ('gobernacion-atlantico-plaza-paz', 'aseo-personal', 'media', null),
  ('gobernacion-atlantico-plaza-paz', 'agua', 'media', null),

  -- Bolívar
  ('coliseo-bernardo-caraballo', 'alimentos-no-perecederos', 'media', null),
  ('coliseo-bernardo-caraballo', 'aseo-personal', 'media', null),
  ('coliseo-bernardo-caraballo', 'agua', 'media', null),

  -- Magdalena
  ('gestion-riesgo-santa-marta', 'alimentos-no-perecederos', 'media', null),
  ('gestion-riesgo-santa-marta', 'aseo-personal', 'media', null),

  -- Córdoba
  ('coliseo-happy-lora', 'alimentos-no-perecederos', 'media', null),
  ('coliseo-happy-lora', 'aseo-personal', 'media', null),
  ('punto-el-recreo-monteria', 'alimentos-no-perecederos', 'media', null),

  -- Cesar
  ('diocesis-valledupar', 'alimentos-no-perecederos', 'media', null),
  ('centro-solidaridad-valledupar', 'alimentos-no-perecederos', 'media', null),
  ('centro-solidaridad-valledupar', 'mascotas', 'media', null),

  -- Santander
  ('alcaldia-bucaramanga', 'alimentos-no-perecederos', 'media', null),
  ('alcaldia-bucaramanga', 'aseo-personal', 'media', null),
  ('centroabastos-bucaramanga', 'alimentos-no-perecederos', 'media', null),
  ('centroabastos-bucaramanga', 'agua', 'media', null),

  -- SCARE — medicamentos, insumos médicos y kits de alimento
  ('scare-bogota', 'medicamentos-insumos', 'media', null),
  ('scare-bogota', 'alimentos-no-perecederos', 'media', 'Kits de alimento.'),
  ('scare-medellin', 'medicamentos-insumos', 'media', null),
  ('scare-barranquilla', 'medicamentos-insumos', 'media', null),
  ('scare-cartagena', 'medicamentos-insumos', 'media', null),
  ('scare-tunja', 'medicamentos-insumos', 'media', null),
  ('scare-popayan', 'medicamentos-insumos', 'media', null),
  ('scare-valledupar', 'medicamentos-insumos', 'media', null),
  ('scare-monteria', 'medicamentos-insumos', 'media', null),
  ('scare-riohacha', 'medicamentos-insumos', 'media', null),
  ('scare-neiva', 'medicamentos-insumos', 'media', null),
  ('scare-santa-marta', 'medicamentos-insumos', 'media', null),
  ('scare-villavicencio', 'medicamentos-insumos', 'media', null),
  ('scare-pasto', 'medicamentos-insumos', 'media', null),
  ('scare-cucuta', 'medicamentos-insumos', 'media', null),
  ('scare-bucaramanga', 'medicamentos-insumos', 'media', null),
  ('scare-sincelejo', 'medicamentos-insumos', 'media', null)
) as v(punto_slug, categoria, urgencia, notas)
join public.collection_points p on p.slug = v.punto_slug
join public.need_categories c   on c.slug = v.categoria;
