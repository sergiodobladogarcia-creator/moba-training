-- El acceso es con móvil y contraseña. La cuenta usa un email interno
-- (móvil@alumnas.mobatraining.es) que nunca recibe correos; el email real es opcional.
create or replace function public.nuevo_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into perfiles (id, email, nombre, telefono, acepta_emails, rol)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'email_contacto',''), case when new.email like '%@alumnas.mobatraining.es' then '' else coalesce(new.email,'') end),
    coalesce(new.raw_user_meta_data->>'nombre',''),
    coalesce(new.raw_user_meta_data->>'telefono',''),
    coalesce((new.raw_user_meta_data->>'acepta_emails')::boolean,false),
    case when exists (select 1 from perfiles where rol='admin') then 'cliente' else 'admin' end
  );
  return new;
end $$;
revoke execute on function public.nuevo_usuario() from authenticated, anon, public;

-- El teléfono es el usuario de acceso: la alumna no lo cambia desde su perfil.
drop function if exists public.actualizar_perfil(text, text, text, boolean);
create or replace function public.actualizar_perfil(p_nombre text, p_email text, p_objetivo text, p_acepta boolean)
returns void language sql security definer set search_path = public as $$
  update perfiles set nombre = p_nombre, email = coalesce(p_email,''), objetivo = p_objetivo, acepta_emails = p_acepta
  where id = auth.uid();
$$;
revoke execute on function public.actualizar_perfil(text, text, text, boolean) from public, anon;
grant execute on function public.actualizar_perfil(text, text, text, boolean) to authenticated;;
