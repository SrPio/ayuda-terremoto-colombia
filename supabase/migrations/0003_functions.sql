-- ============================================================================
-- 0003_functions.sql — Emparejamiento y estadísticas
--
-- Estas funciones son de SOLO LECTURA y se pueden ejecutar con la anon key.
-- Son security definer únicamente para poder leer con un search_path fijo y
-- devolver resultados consistentes; ninguna escribe nada.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Distancia entre dos coordenadas, en kilómetros.
-- Sin PostGIS a propósito: el volumen es de cientos de filas, no de millones,
-- y evitar la extensión mantiene el proyecto fácil de levantar para cualquiera
-- que quiera contribuir o replicarlo.
-- ---------------------------------------------------------------------------
create or replace function public.haversine_km(
  lat1 double precision,
  lng1 double precision,
  lat2 double precision,
  lng2 double precision
)
returns double precision
language sql
immutable
parallel safe
as $$
  select case
    when lat1 is null or lng1 is null or lat2 is null or lng2 is null then null
    else 6371 * 2 * asin(
      sqrt(
        power(sin(radians(lat2 - lat1) / 2), 2)
        + cos(radians(lat1)) * cos(radians(lat2))
        * power(sin(radians(lng2 - lng1) / 2), 2)
      )
    )
  end;
$$;

-- ---------------------------------------------------------------------------
-- Peso numérico de la urgencia, para poder ordenar.
-- ---------------------------------------------------------------------------
create or replace function public.peso_urgencia(u public.nivel_urgencia)
returns integer
language sql
immutable
parallel safe
as $$
  select case u
    when 'critica' then 4
    when 'alta'    then 3
    when 'media'   then 2
    else 1
  end;
$$;

-- ---------------------------------------------------------------------------
-- match_needs — el motor del flujo "¿dónde llevo lo que tengo?"
--
-- Entrada: qué tiene la persona, cuánto, desde dónde y si tiene transporte.
-- Salida: necesidades abiertas que esa donación puede atender, ordenadas por
-- lo que realmente importa en una emergencia:
--
--   1. urgencia declarada por el punto (crítica primero),
--   2. si el departamento sufrió daño directo por el sismo,
--   3. si la donación alcanza a cubrir la necesidad completa,
--   4. cercanía (menos logística = la ayuda llega antes),
--   5. tamaño del faltante.
--
-- Sobre el transporte: quien NO tiene transporte solo recibe opciones que
-- puede alcanzar por su cuenta (su departamento o hasta ~100 km). Quien SÍ
-- tiene transporte recibe además opciones interdepartamentales, que es lo que
-- permite el caso real de "tengo 100 cajas en Medellín" → "faltan 80 en
-- Quibdó". Sin ese filtro, la app le propondría a un peatón cruzar el país.
-- ---------------------------------------------------------------------------
create or replace function public.match_needs(
  p_category        text,
  p_cantidad        numeric default null,
  p_department_code text default null,
  p_lat             double precision default null,
  p_lng             double precision default null,
  p_transporte      boolean default false,
  p_limite          integer default 8
)
returns table (
  need_id                  uuid,
  point_id                 uuid,
  point_slug               text,
  punto                    text,
  organizacion             text,
  ciudad                   text,
  departamento             text,
  department_code          text,
  direccion                text,
  horario                  text,
  telefono                 text,
  whatsapp                 text,
  email                    text,
  lat                      double precision,
  lng                      double precision,
  categoria                text,
  categoria_nombre         text,
  emoji                    text,
  cantidad_solicitada      numeric,
  cantidad_cubierta        numeric,
  faltante                 numeric,
  unidad                   text,
  urgencia                 public.nivel_urgencia,
  zona_afectada            boolean,
  acepta_transporte_grande boolean,
  distancia_km             numeric,
  cubre_completo           boolean,
  actualizado              timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with candidatas as (
    select
      n.id                                                as need_id,
      p.id                                                as point_id,
      p.slug                                              as point_slug,
      p.nombre                                            as punto,
      p.organizacion,
      p.ciudad,
      d.nombre                                            as departamento,
      p.department_code,
      p.direccion,
      p.horario,
      p.telefono,
      p.whatsapp,
      p.email,
      p.lat,
      p.lng,
      c.slug                                              as categoria,
      c.nombre                                            as categoria_nombre,
      c.emoji,
      n.cantidad_solicitada,
      n.cantidad_cubierta,
      case
        when n.cantidad_solicitada is null then null
        else greatest(n.cantidad_solicitada - n.cantidad_cubierta, 0)
      end                                                 as faltante,
      n.unidad,
      n.urgencia,
      d.afectado                                          as zona_afectada,
      p.acepta_transporte_grande,
      round(
        public.haversine_km(p_lat, p_lng, p.lat, p.lng)::numeric, 1
      )                                                   as distancia_km,
      p.updated_at                                        as actualizado
    from public.point_needs n
    join public.collection_points p on p.id = n.point_id
    join public.departments d       on d.code = p.department_code
    join public.need_categories c   on c.slug = n.category_slug
    where n.activa
      and p.status = 'approved'
      and n.category_slug = p_category
      -- Se descartan las necesidades ya cubiertas: mandar más ahí es saturar.
      and (n.cantidad_solicitada is null or n.cantidad_cubierta < n.cantidad_solicitada)
  )
  select
    need_id, point_id, point_slug, punto, organizacion, ciudad, departamento,
    department_code, direccion, horario, telefono, whatsapp, email, lat, lng,
    categoria, categoria_nombre, emoji, cantidad_solicitada, cantidad_cubierta,
    faltante, unidad, urgencia, zona_afectada, acepta_transporte_grande,
    distancia_km,
    case
      when p_cantidad is null or faltante is null then null
      else p_cantidad >= faltante
    end as cubre_completo,
    actualizado
  from candidatas
  where
    -- Sin transporte: solo lo que la persona puede alcanzar por su cuenta.
    p_transporte
    or p_department_code is null
    or department_code = p_department_code
    or (distancia_km is not null and distancia_km <= 100)
  order by
    public.peso_urgencia(urgencia) desc,
    zona_afectada desc,
    (case when p_cantidad is not null and faltante is not null and p_cantidad >= faltante
          then 0 else 1 end),
    distancia_km asc nulls last,
    faltante desc nulls last
  limit greatest(coalesce(p_limite, 8), 1);
$$;

comment on function public.match_needs is
  'Empareja una donación concreta (qué, cuánto, desde dónde, con o sin transporte) con necesidades abiertas en puntos aprobados. Solo lectura.';

-- ---------------------------------------------------------------------------
-- critical_needs — el renglón de manifiesto que se ve en la portada.
-- Las necesidades más urgentes del país, sin importar la categoría.
-- ---------------------------------------------------------------------------
create or replace function public.critical_needs(p_limite integer default 6)
returns table (
  need_id             uuid,
  point_slug          text,
  punto               text,
  ciudad              text,
  departamento        text,
  categoria           text,
  categoria_nombre    text,
  emoji               text,
  cantidad_solicitada numeric,
  cantidad_cubierta   numeric,
  faltante            numeric,
  unidad              text,
  urgencia            public.nivel_urgencia,
  zona_afectada       boolean,
  actualizado         timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    n.id,
    p.slug,
    p.nombre,
    p.ciudad,
    d.nombre,
    c.slug,
    c.nombre,
    c.emoji,
    n.cantidad_solicitada,
    n.cantidad_cubierta,
    case
      when n.cantidad_solicitada is null then null
      else greatest(n.cantidad_solicitada - n.cantidad_cubierta, 0)
    end,
    n.unidad,
    n.urgencia,
    d.afectado,
    p.updated_at
  from public.point_needs n
  join public.collection_points p on p.id = n.point_id
  join public.departments d       on d.code = p.department_code
  join public.need_categories c   on c.slug = n.category_slug
  where n.activa
    and p.status = 'approved'
    and (n.cantidad_solicitada is null or n.cantidad_cubierta < n.cantidad_solicitada)
  order by
    public.peso_urgencia(n.urgencia) desc,
    d.afectado desc,
    (case when n.cantidad_solicitada is null then 1 else 0 end),
    (n.cantidad_solicitada - n.cantidad_cubierta) desc nulls last
  limit greatest(coalesce(p_limite, 6), 1);
$$;

-- ---------------------------------------------------------------------------
-- public_stats — cifras de la portada, en una sola consulta.
-- ---------------------------------------------------------------------------
create or replace function public.public_stats()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'puntos_activos', (
      select count(*) from public.collection_points where status = 'approved'
    ),
    'departamentos_cubiertos', (
      select count(distinct department_code)
        from public.collection_points where status = 'approved'
    ),
    'necesidades_abiertas', (
      select count(*)
        from public.point_needs n
        join public.collection_points p on p.id = n.point_id
       where n.activa
         and p.status = 'approved'
         and (n.cantidad_solicitada is null or n.cantidad_cubierta < n.cantidad_solicitada)
    ),
    'necesidades_criticas', (
      select count(*)
        from public.point_needs n
        join public.collection_points p on p.id = n.point_id
       where n.activa
         and p.status = 'approved'
         and n.urgencia = 'critica'
         and (n.cantidad_solicitada is null or n.cantidad_cubierta < n.cantidad_solicitada)
    ),
    'ultima_actualizacion', (
      select max(updated_at) from public.collection_points where status = 'approved'
    )
  );
$$;

-- ---------------------------------------------------------------------------
-- Permisos: el rol anónimo puede ejecutar las tres funciones de lectura.
-- Ninguna otra función queda expuesta.
-- ---------------------------------------------------------------------------
revoke all on function public.match_needs(text, numeric, text, double precision, double precision, boolean, integer) from public;
revoke all on function public.critical_needs(integer) from public;
revoke all on function public.public_stats() from public;

grant execute on function public.match_needs(text, numeric, text, double precision, double precision, boolean, integer) to anon, authenticated;
grant execute on function public.critical_needs(integer) to anon, authenticated;
grant execute on function public.public_stats() to anon, authenticated;
