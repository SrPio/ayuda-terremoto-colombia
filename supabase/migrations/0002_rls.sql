-- ============================================================================
-- 0002_rls.sql — Seguridad a nivel de fila
--
-- Modelo de seguridad de esta versión, en una frase: la llave que viaja al
-- navegador (anon key) SOLO PUEDE LEER, y solo lo que ya fue aprobado.
--
-- Como no hay cuentas de usuario, no se puede confiar en auth.uid() para
-- limitar escrituras. La alternativa habitual —dejar que el rol anónimo haga
-- INSERT— significa que cualquiera con la anon key (que es pública por
-- diseño, está en el bundle) puede escribir en la base con un script. En una
-- emergencia eso es una invitación al vandalismo de datos.
--
-- Por eso: cero políticas de escritura. Los aportes entran por la Edge
-- Function `submit`, que valida, aplica captcha y límite por IP, y escribe con
-- service_role (el service_role omite RLS por definición y nunca sale del
-- servidor). La moderación entra por la Edge Function `moderate`, protegida
-- con una clave que solo existe como secreto de la función.
-- ============================================================================

alter table public.departments           enable row level security;
alter table public.need_categories       enable row level security;
alter table public.collection_points     enable row level security;
alter table public.point_needs           enable row level security;
alter table public.donation_offers       enable row level security;
alter table public.point_change_requests enable row level security;
alter table public.point_reports         enable row level security;
alter table public.rate_limits           enable row level security;

-- ---------------------------------------------------------------------------
-- Catálogos: lectura libre. Son datos de referencia públicos.
-- ---------------------------------------------------------------------------
create policy "Departamentos visibles para todos"
  on public.departments
  for select
  to anon, authenticated
  using (true);

create policy "Categorías visibles para todos"
  on public.need_categories
  for select
  to anon, authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- Puntos de acopio: solo los aprobados salen al público.
-- Un punto pending, rejected o inactive es invisible para la anon key, así que
-- ni el propio autor puede consultarlo antes de que un moderador lo apruebe.
-- ---------------------------------------------------------------------------
create policy "Puntos aprobados visibles para todos"
  on public.collection_points
  for select
  to anon, authenticated
  using (status = 'approved');

-- ---------------------------------------------------------------------------
-- Necesidades: visibles solo si su punto está aprobado.
-- ---------------------------------------------------------------------------
create policy "Necesidades de puntos aprobados visibles para todos"
  on public.point_needs
  for select
  to anon, authenticated
  using (
    exists (
      select 1
        from public.collection_points p
       where p.id = point_needs.point_id
         and p.status = 'approved'
    )
  );

-- ---------------------------------------------------------------------------
-- Tablas sin ninguna política = sin ningún acceso público.
--
-- donation_offers, point_change_requests, point_reports y rate_limits no
-- llevan políticas a propósito. Con RLS activa y cero políticas, el rol
-- anónimo no puede leerlas ni escribirlas. Contienen teléfonos, comentarios y
-- hashes de IP: no son datos abiertos.
--
-- No se declara NINGUNA política de insert, update o delete en todo el
-- esquema. Cualquier escritura viene del service_role vía Edge Functions.
-- ---------------------------------------------------------------------------

-- Cinturón y tirantes: se revocan los permisos de tabla, de modo que aunque
-- alguien agregue una política por error, el rol anónimo sigue sin poder
-- escribir.
revoke insert, update, delete on all tables in schema public from anon, authenticated;

alter default privileges in schema public
  revoke insert, update, delete on tables from anon, authenticated;
