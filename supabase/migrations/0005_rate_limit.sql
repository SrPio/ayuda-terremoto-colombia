-- ============================================================================
-- 0005_rate_limit.sql — Control de abuso sin cuentas de usuario
--
-- Sin login no hay identidad a la que atarle un límite, así que el límite se
-- ata a una ventana de tiempo por (hash de IP, tipo de acción). El hash se
-- calcula en la Edge Function con una sal secreta: la base nunca ve una IP.
--
-- Esta función SÍ escribe, y por eso está revocada para anon y authenticated.
-- Solo el service_role, que vive dentro de las Edge Functions, puede llamarla.
-- ============================================================================

create or replace function public.registrar_intento(
  p_ip_hash  text,
  p_kind     text,
  p_limite   integer,
  p_ventana  interval default '1 hour'
)
returns table (permitido boolean, intentos integer, limite integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ventana_inicio timestamptz;
  v_conteo         integer;
begin
  -- Ventanas alineadas: todas las peticiones de la misma hora caen en el mismo
  -- balde, así el contador es determinista y la tabla no crece sin control.
  v_ventana_inicio := to_timestamp(
    floor(extract(epoch from now()) / extract(epoch from p_ventana))
    * extract(epoch from p_ventana)
  );

  insert into public.rate_limits (ip_hash, kind, window_start, count)
  values (p_ip_hash, p_kind, v_ventana_inicio, 1)
  on conflict (ip_hash, kind, window_start)
    do update set count = rate_limits.count + 1
  returning rate_limits.count into v_conteo;

  -- Limpieza oportunista: se barren las ventanas viejas de vez en cuando para
  -- no necesitar un cron solo por esto.
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '2 days';
  end if;

  return query select v_conteo <= p_limite, v_conteo, p_limite;
end;
$$;

revoke all on function public.registrar_intento(text, text, integer, interval) from public, anon, authenticated;
grant execute on function public.registrar_intento(text, text, integer, interval) to service_role;

-- ---------------------------------------------------------------------------
-- aplicar_solicitud_edicion — aplica el payload aprobado sobre el punto.
--
-- Vive en la base y no en TypeScript por una razón concreta: así la lista de
-- campos editables por la comunidad es una sola, declarada en un lugar, y no
-- se puede ampliar por accidente desde el código de la función. Nadie puede
-- colar un cambio de status, de verificado ni de slug por esta vía.
-- ---------------------------------------------------------------------------
create or replace function public.aplicar_solicitud_edicion(p_solicitud_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_solicitud public.point_change_requests;
begin
  select * into v_solicitud
    from public.point_change_requests
   where id = p_solicitud_id
     and status = 'pending';

  if not found then
    raise exception 'La solicitud no existe o ya fue resuelta';
  end if;

  if v_solicitud.tipo = 'eliminacion' then
    -- Nunca se borra: se marca inactive. Un punto que cerró es información
    -- útil, y borrarlo hace que alguien lo vuelva a agregar mañana.
    update public.collection_points
       set status = 'inactive'
     where id = v_solicitud.point_id;
  else
    update public.collection_points p
       set nombre       = coalesce(v_solicitud.payload ->> 'nombre', p.nombre),
           ciudad       = coalesce(v_solicitud.payload ->> 'ciudad', p.ciudad),
           direccion    = coalesce(v_solicitud.payload ->> 'direccion', p.direccion),
           descripcion  = coalesce(v_solicitud.payload ->> 'descripcion', p.descripcion),
           organizacion = coalesce(v_solicitud.payload ->> 'organizacion', p.organizacion),
           horario      = coalesce(v_solicitud.payload ->> 'horario', p.horario),
           telefono     = coalesce(v_solicitud.payload ->> 'telefono', p.telefono),
           whatsapp     = coalesce(v_solicitud.payload ->> 'whatsapp', p.whatsapp),
           email        = coalesce(v_solicitud.payload ->> 'email', p.email),
           acepta_transporte_grande = coalesce(
             (v_solicitud.payload ->> 'acepta_transporte_grande')::boolean,
             p.acepta_transporte_grande
           ),
           department_code = coalesce(
             (select d.code from public.departments d
               where d.code = v_solicitud.payload ->> 'department_code'),
             p.department_code
           )
     where p.id = v_solicitud.point_id;
  end if;

  update public.point_change_requests
     set status = 'aplicada', resolved_at = now()
   where id = p_solicitud_id;

  return v_solicitud.point_id;
end;
$$;

revoke all on function public.aplicar_solicitud_edicion(uuid) from public, anon, authenticated;
grant execute on function public.aplicar_solicitud_edicion(uuid) to service_role;
