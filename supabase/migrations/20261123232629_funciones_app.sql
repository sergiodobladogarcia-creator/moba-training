-- Horario público con plazas ocupadas (sin datos de clientes)
create or replace function public.horario(desde timestamptz, hasta timestamptz)
returns table (id bigint, titulo text, disciplina text, nivel text, tipo text, inicio timestamptz,
               duracion_min int, plazas int, ocupadas int, estado text, descripcion text)
language sql stable security definer set search_path = public as $$
  select c.id, c.titulo, c.disciplina, c.nivel, c.tipo, c.inicio, c.duracion_min, c.plazas,
         (select count(*)::int from reservas r where r.clase_id = c.id and r.estado <> 'cancelada'),
         c.estado, c.descripcion
  from clases c
  where c.inicio >= desde and c.inicio < hasta and c.estado = 'programada'
  order by c.inicio;
$$;

-- Reservar una clase (en grupo o un hueco de entrenamiento personal)
create or replace function public.reservar(p_clase bigint, p_enfoque text default null)
returns json language plpgsql security definer set search_path = public as $$
declare
  u uuid := auth.uid();
  c clases;
  ocup int;
  b bonos;
  prueba_usada boolean;
  rid bigint;
begin
  if u is null then raise exception 'Inicia sesión para reservar'; end if;
  if exists (select 1 from perfiles where id = u and estado = 'baja') then
    raise exception 'Tu cuenta está dada de baja. Escribe a María para reactivarla';
  end if;
  select * into c from clases where id = p_clase for update;
  if not found or c.estado <> 'programada' then raise exception 'Esta clase ya no está disponible'; end if;
  if c.inicio <= now() then raise exception 'Esta clase ya ha empezado'; end if;
  if exists (select 1 from reservas where clase_id = p_clase and cliente_id = u and estado <> 'cancelada') then
    raise exception 'Ya tienes esta clase reservada';
  end if;
  select count(*) into ocup from reservas where clase_id = p_clase and estado <> 'cancelada';
  if ocup >= c.plazas then raise exception 'La clase está completa'; end if;

  select * into b from bonos
   where cliente_id = u and estado_pago = 'pagado' and caduca >= (c.inicio at time zone 'Europe/Madrid')::date
     and (clases_total is null or clases_usadas < clases_total)
     and ((c.tipo = 'grupo' and tipo in ('grupo','completo','prueba')) or (c.tipo = 'personal' and tipo = 'personal'))
   order by (clases_total is null), caduca limit 1 for update;

  if not found then
    select exists (select 1 from bonos where cliente_id = u and tipo = 'prueba') into prueba_usada;
    if c.tipo = 'grupo' and not prueba_usada then
      insert into bonos (cliente_id, nombre, tipo, clases_total, precio, metodo_pago, estado_pago, fecha_pago, caduca)
      values (u, 'Primera clase gratis', 'prueba', 1, 0, 'gratis', 'pagado', now(), current_date + 30)
      returning * into b;
    else
      raise exception '%', case when c.tipo = 'personal'
        then 'Necesitas un bono de entrenamiento personal pagado para reservar'
        else 'Necesitas un bono de clases en grupo pagado para reservar' end;
    end if;
  end if;

  if b.clases_total is not null then
    update bonos set clases_usadas = clases_usadas + 1 where id = b.id;
  end if;
  insert into reservas (clase_id, cliente_id, bono_id, enfoque) values (p_clase, u, b.id, p_enfoque) returning id into rid;
  return json_build_object('reserva', rid, 'bono', b.nombre);
end $$;

-- Cancelar: si faltan 8 h o más, la clase vuelve al bono
create or replace function public.cancelar_reserva(p_reserva bigint)
returns json language plpgsql security definer set search_path = public as $$
declare r reservas; c clases; devuelta boolean := false;
begin
  select * into r from reservas where id = p_reserva and (cliente_id = auth.uid() or es_admin()) for update;
  if not found or r.estado <> 'confirmada' then raise exception 'No se puede cancelar esta reserva'; end if;
  select * into c from clases where id = r.clase_id;
  if c.inicio - now() >= interval '8 hours' or es_admin() then
    update bonos set clases_usadas = greatest(clases_usadas - 1, 0) where id = r.bono_id and clases_total is not null;
    devuelta := true;
  end if;
  update reservas set estado = 'cancelada' where id = p_reserva;
  return json_build_object('devuelta', devuelta);
end $$;

-- La alumna pide un bono; María lo confirma cuando recibe el pago
create or replace function public.solicitar_bono(p_producto text, p_metodo text default 'bizum')
returns bigint language plpgsql security definer set search_path = public as $$
declare p productos; bid bigint;
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  if p_metodo not in ('bizum','transferencia','efectivo') then raise exception 'Método de pago no válido'; end if;
  select * into p from productos where id = p_producto and activo;
  if not found then raise exception 'Este producto no está disponible'; end if;
  insert into bonos (cliente_id, producto_id, nombre, tipo, clases_total, precio, metodo_pago, caduca)
  values (auth.uid(), p.id, p.nombre, p.tipo, p.clases, p.precio, p_metodo, current_date + p.dias_validez)
  returning id into bid;
  return bid;
end $$;

-- María confirma el pago: empieza la validez y se numera la factura
create or replace function public.confirmar_pago(p_bono bigint, p_metodo text default null)
returns void language plpgsql security definer set search_path = public as $$
declare b bonos; dias int;
begin
  if not es_admin() then raise exception 'Solo la profesora puede confirmar pagos'; end if;
  select * into b from bonos where id = p_bono for update;
  if not found then raise exception 'Bono no encontrado'; end if;
  select coalesce(dias_validez, b.caduca - b.inicio) into dias from productos where id = b.producto_id;
  dias := coalesce(dias, b.caduca - b.inicio);
  update bonos set estado_pago = 'pagado', fecha_pago = now(),
    metodo_pago = coalesce(p_metodo, metodo_pago),
    inicio = current_date, caduca = current_date + dias,
    numero_factura = coalesce(numero_factura, nextval('factura_seq'))
  where id = p_bono;
end $$;

-- María da de alta un bono ya cobrado (por ejemplo, en efectivo)
create or replace function public.vender_bono(p_cliente uuid, p_producto text, p_metodo text)
returns bigint language plpgsql security definer set search_path = public as $$
declare p productos; bid bigint;
begin
  if not es_admin() then raise exception 'Solo la profesora puede hacer esto'; end if;
  select * into p from productos where id = p_producto;
  insert into bonos (cliente_id, producto_id, nombre, tipo, clases_total, precio, metodo_pago, estado_pago, fecha_pago, caduca, numero_factura)
  values (p_cliente, p.id, p.nombre, p.tipo, p.clases, p.precio, p_metodo, 'pagado', now(), current_date + p.dias_validez, nextval('factura_seq'))
  returning id into bid;
  return bid;
end $$;

create or replace function public.actualizar_perfil(p_nombre text, p_telefono text, p_objetivo text, p_acepta boolean)
returns void language sql security definer set search_path = public as $$
  update perfiles set nombre = p_nombre, telefono = p_telefono, objetivo = p_objetivo, acepta_emails = p_acepta
  where id = auth.uid();
$$;

create or replace function public.darme_de_baja(p_motivo text)
returns void language sql security definer set search_path = public as $$
  update perfiles set estado = 'baja', fecha_baja = now(), motivo_baja = p_motivo where id = auth.uid();
$$;

-- Enlace del vídeo: gratis, o con videoteca / Moba Completo en vigor
create or replace function public.ver_video(p_id bigint)
returns text language plpgsql stable security definer set search_path = public as $$
declare v videos;
begin
  select * into v from videos where id = p_id and (publicado or es_admin());
  if not found then return null; end if;
  if v.gratis or es_admin() or exists (
    select 1 from bonos where cliente_id = auth.uid() and estado_pago = 'pagado'
      and tipo in ('videoteca','completo') and caduca >= current_date) then
    return v.url;
  end if;
  return null;
end $$;

revoke execute on all functions in schema public from public, anon;
grant execute on function public.horario(timestamptz, timestamptz) to anon, authenticated;
grant execute on function public.es_admin() to authenticated;
grant execute on function public.reservar(bigint, text), public.cancelar_reserva(bigint),
  public.solicitar_bono(text, text), public.confirmar_pago(bigint, text),
  public.vender_bono(uuid, text, text), public.actualizar_perfil(text, text, text, boolean),
  public.darme_de_baja(text), public.ver_video(bigint) to authenticated;
;
