-- ============================================================================
-- 0001_schema.sql — Estructura base
--
-- Contexto: terremoto de magnitud 7,4 del 10 de agosto de 2026, epicentro en
-- San José del Palmar (Chocó). Esta base centraliza los puntos de acopio y,
-- sobre todo, QUÉ necesita cada punto, para poder emparejar donantes con
-- necesidades reales en vez de saturar unos pocos sitios.
--
-- Decisión de diseño: esta versión NO tiene cuentas de usuario. No hay
-- referencias a auth.users en ninguna tabla. Toda la escritura entra por
-- Edge Functions con service_role (ver supabase/functions/) y el rol anónimo
-- queda de solo lectura (ver 0002_rls.sql).
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
create type public.estado_punto as enum ('pending', 'approved', 'rejected', 'inactive');
create type public.nivel_urgencia as enum ('baja', 'media', 'alta', 'critica');
create type public.tipo_solicitud as enum ('edicion', 'eliminacion');
create type public.estado_solicitud as enum ('pending', 'aplicada', 'rechazada');
create type public.motivo_reporte as enum (
  'cerrado', 'info_incorrecta', 'duplicado', 'ya_no_necesita', 'saturado', 'otro'
);
create type public.estado_oferta as enum ('abierta', 'coordinada', 'entregada', 'cancelada');

-- ---------------------------------------------------------------------------
-- Utilidad: updated_at automático
-- ---------------------------------------------------------------------------
create or replace function public.tocar_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Departamentos
-- La clave primaria es el slug: hace el seed legible y las URLs limpias
-- (/puntos?departamento=risaralda). Se guarda además el código DANE para que
-- cualquiera pueda cruzar estos datos con fuentes oficiales.
-- ---------------------------------------------------------------------------
create table public.departments (
  code        text primary key,
  nombre      text not null,
  region      text not null check (
                region in ('Andina', 'Caribe', 'Pacífica', 'Orinoquía', 'Amazonía', 'Insular')
              ),
  dane        text,
  lat         double precision not null,
  lng         double precision not null,
  -- Marca los departamentos con daños directos del sismo. Sirve para ordenar
  -- el mapa y para explicar por qué una necesidad es prioritaria.
  afectado    boolean not null default false
);

comment on table public.departments is
  'Departamentos de Colombia con centroide aproximado. La bandera "afectado" marca las zonas con daño directo por el sismo del 10-ago-2026.';

-- ---------------------------------------------------------------------------
-- Categorías de necesidad
-- Lista cerrada y curada: si cada punto escribiera texto libre, el
-- emparejamiento sería imposible. El campo unidad_sugerida es lo que la app
-- propone por defecto ("cajas", "unidades", "bultos").
-- ---------------------------------------------------------------------------
create table public.need_categories (
  slug             text primary key,
  nombre           text not null,
  emoji            text not null,
  unidad_sugerida  text not null default 'unidades',
  descripcion      text,
  orden            smallint not null default 100
);

comment on table public.need_categories is
  'Catálogo cerrado de tipos de donación. Mantenerlo cerrado es lo que permite emparejar oferta con necesidad.';

-- ---------------------------------------------------------------------------
-- Puntos de acopio
-- ---------------------------------------------------------------------------
create table public.collection_points (
  id                        uuid primary key default gen_random_uuid(),
  slug                      text not null unique,
  nombre                    text not null,
  department_code           text not null references public.departments (code) on update cascade,
  ciudad                    text not null,
  direccion                 text,
  descripcion               text,
  organizacion              text,
  horario                   text,
  telefono                  text,
  whatsapp                  text,
  email                     text,
  lat                       double precision,
  lng                       double precision,
  -- Si el punto puede recibir camión o solo paquetes de mano. Cambia por
  -- completo a quién tiene sentido enviarle una donación grande.
  acepta_transporte_grande  boolean not null default false,
  fuente_url                text,
  status                    public.estado_punto not null default 'pending',
  -- verificado = confirmado contra una fuente oficial o por teléfono.
  verificado                boolean not null default false,
  -- Datos opcionales de quien aportó el punto. Sin cuentas: nadie está
  -- obligado a identificarse para ayudar.
  submitter_nombre          text,
  submitter_contacto        text,
  -- HMAC de la IP con sal secreta, nunca la IP en claro. Solo control de abuso.
  submitter_ip_hash         text,
  nota_moderacion           text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  constraint coordenadas_completas check (
    (lat is null and lng is null) or (lat is not null and lng is not null)
  ),
  constraint lat_valida check (lat is null or (lat between -5 and 14)),
  constraint lng_valida check (lng is null or (lng between -82 and -66))
);

create index collection_points_status_idx on public.collection_points (status);
create index collection_points_departamento_idx on public.collection_points (department_code)
  where status = 'approved';
create index collection_points_ciudad_idx on public.collection_points (lower(ciudad));
create index collection_points_actualizado_idx on public.collection_points (updated_at desc);

create trigger collection_points_updated_at
  before update on public.collection_points
  for each row execute function public.tocar_updated_at();

comment on column public.collection_points.status is
  'Todo aporte de la comunidad entra como pending. Solo la Edge Function moderate puede aprobarlo.';

-- ---------------------------------------------------------------------------
-- Necesidades por punto
-- El corazón del producto: "este punto pide 80 cajas de agua y lleva 12".
-- cantidad_solicitada puede ser NULL porque muchos puntos oficiales dicen
-- "recibimos agua" sin dar cifra, y ese dato igual es útil.
-- ---------------------------------------------------------------------------
create table public.point_needs (
  id                   uuid primary key default gen_random_uuid(),
  point_id             uuid not null references public.collection_points (id) on delete cascade,
  category_slug        text not null references public.need_categories (slug) on update cascade,
  cantidad_solicitada  numeric(12, 2) check (cantidad_solicitada is null or cantidad_solicitada > 0),
  cantidad_cubierta    numeric(12, 2) not null default 0 check (cantidad_cubierta >= 0),
  unidad               text not null default 'unidades',
  urgencia             public.nivel_urgencia not null default 'media',
  notas                text,
  activa               boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (point_id, category_slug)
);

create index point_needs_point_idx on public.point_needs (point_id);
create index point_needs_categoria_idx on public.point_needs (category_slug) where activa;
create index point_needs_urgencia_idx on public.point_needs (urgencia) where activa;

create trigger point_needs_updated_at
  before update on public.point_needs
  for each row execute function public.tocar_updated_at();

-- Cuando cambia una necesidad, el punto también "se actualizó": así el sello
-- de frescura que ve la gente refleja la última noticia real del sitio.
create or replace function public.tocar_punto_por_necesidad()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.collection_points
     set updated_at = now()
   where id = coalesce(new.point_id, old.point_id);
  return coalesce(new, old);
end;
$$;

create trigger point_needs_tocar_punto
  after insert or update or delete on public.point_needs
  for each row execute function public.tocar_punto_por_necesidad();

-- ---------------------------------------------------------------------------
-- Ofertas de donación
-- "Tengo 100 cajas de agua en Medellín." Se guardan para medir la demanda
-- real y para que la moderación vea qué se está ofreciendo y no llega.
-- ---------------------------------------------------------------------------
create table public.donation_offers (
  id                     uuid primary key default gen_random_uuid(),
  category_slug          text not null references public.need_categories (slug) on update cascade,
  cantidad               numeric(12, 2) not null check (cantidad > 0),
  unidad                 text not null default 'unidades',
  department_code        text references public.departments (code) on update cascade,
  ciudad                 text,
  transporte_disponible  boolean not null default false,
  nombre_contacto        text,
  telefono               text,
  mensaje               text,
  matched_point_id       uuid references public.collection_points (id) on delete set null,
  status                 public.estado_oferta not null default 'abierta',
  submitter_ip_hash      text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index donation_offers_status_idx on public.donation_offers (status, created_at desc);
create index donation_offers_categoria_idx on public.donation_offers (category_slug);

create trigger donation_offers_updated_at
  before update on public.donation_offers
  for each row execute function public.tocar_updated_at();

-- ---------------------------------------------------------------------------
-- Solicitudes de edición o eliminación
-- El payload guarda solo los campos propuestos, para poder mostrar un diff
-- claro en el panel de moderación antes de aplicar nada.
-- ---------------------------------------------------------------------------
create table public.point_change_requests (
  id                  uuid primary key default gen_random_uuid(),
  point_id            uuid not null references public.collection_points (id) on delete cascade,
  tipo                public.tipo_solicitud not null,
  payload             jsonb not null default '{}'::jsonb,
  motivo              text not null,
  submitter_nombre    text,
  submitter_contacto  text,
  submitter_ip_hash   text,
  status              public.estado_solicitud not null default 'pending',
  nota_moderacion     text,
  resolved_at         timestamptz,
  created_at          timestamptz not null default now()
);

create index point_change_requests_status_idx on public.point_change_requests (status, created_at desc);
create index point_change_requests_point_idx on public.point_change_requests (point_id);

-- ---------------------------------------------------------------------------
-- Reportes
-- Más livianos que una solicitud de edición: "esto ya cerró", "aquí ya no
-- reciben ropa". Es la señal más valiosa para mantener los datos frescos.
-- ---------------------------------------------------------------------------
create table public.point_reports (
  id                 uuid primary key default gen_random_uuid(),
  point_id           uuid not null references public.collection_points (id) on delete cascade,
  motivo             public.motivo_reporte not null,
  comentario         text,
  submitter_contacto text,
  submitter_ip_hash  text,
  status             public.estado_solicitud not null default 'pending',
  nota_moderacion    text,
  resolved_at        timestamptz,
  created_at         timestamptz not null default now()
);

create index point_reports_status_idx on public.point_reports (status, created_at desc);
create index point_reports_point_idx on public.point_reports (point_id);

-- ---------------------------------------------------------------------------
-- Límite por IP
-- Sin cuentas, el control de abuso vive aquí. Se guarda un HMAC de la IP, no
-- la IP: alcanza para frenar spam y no construye un registro de quién visitó.
-- ---------------------------------------------------------------------------
create table public.rate_limits (
  ip_hash       text not null,
  kind          text not null,
  window_start  timestamptz not null,
  count         integer not null default 1,
  primary key (ip_hash, kind, window_start)
);

create index rate_limits_ventana_idx on public.rate_limits (window_start);

comment on table public.rate_limits is
  'Contador por ventana de tiempo. Se puede purgar sin consecuencias: delete from rate_limits where window_start < now() - interval ''1 day''.';
