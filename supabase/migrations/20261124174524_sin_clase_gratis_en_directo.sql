-- Ya no hay clase en directo gratis: para reservar hace falta un bono pagado.
-- La prueba gratuita es un vídeo grabado (videos.gratis = clase de prueba, solo con cuenta).
create or replace function public.reservar(p_clase bigint, p_enfoque text default null)
returns json language plpgsql security definer set search_path = public as $$
declare
  u uuid := auth.uid();
  c clases;
  ocup int;
  b bonos;
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
     and ((c.tipo = 'grupo' and tipo in ('grupo','completo')) or (c.tipo = 'personal' and tipo = 'personal'))
   order by (clases_total is null), caduca limit 1 for update;
  if not found then
    raise exception '%', case when c.tipo = 'personal'
      then 'Activa tu cuenta con un bono de entrenamiento personal para reservar'
      else 'Activa tu cuenta con un bono de clases en grupo para reservar' end;
  end if;

  if b.clases_total is not null then
    update bonos set clases_usadas = clases_usadas + 1 where id = b.id;
  end if;
  insert into reservas (clase_id, cliente_id, bono_id, enfoque) values (p_clase, u, b.id, p_enfoque) returning id into rid;
  return json_build_object('reserva', rid, 'bono', b.nombre);
end $$;
revoke execute on function public.reservar(bigint, text) from public, anon;
grant execute on function public.reservar(bigint, text) to authenticated;

-- Una solicitud pendiente por producto: si la alumna pulsa varias veces, no se duplica.
create or replace function public.solicitar_bono(p_producto text, p_metodo text default 'bizum')
returns bigint language plpgsql security definer set search_path = public as $$
declare p productos; bid bigint;
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  if p_metodo not in ('bizum','transferencia','efectivo') then raise exception 'Método de pago no válido'; end if;
  select * into p from productos where id = p_producto and activo;
  if not found then raise exception 'Este producto no está disponible'; end if;
  select id into bid from bonos where cliente_id = auth.uid() and producto_id = p.id and estado_pago = 'pendiente' limit 1;
  if bid is not null then
    update bonos set metodo_pago = p_metodo, fecha_compra = now() where id = bid;
    return bid;
  end if;
  insert into bonos (cliente_id, producto_id, nombre, tipo, clases_total, precio, metodo_pago, caduca)
  values (auth.uid(), p.id, p.nombre, p.tipo, p.clases, p.precio, p_metodo, current_date + p.dias_validez)
  returning id into bid;
  return bid;
end $$;
revoke execute on function public.solicitar_bono(text, text) from public, anon;
grant execute on function public.solicitar_bono(text, text) to authenticated;;
