-- La cuenta de profesora es la que se registra con el móvil de María (682 01 29 56),
-- y solo mientras no exista ya una administradora.
create or replace function public.nuevo_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
declare tel text := regexp_replace(coalesce(new.raw_user_meta_data->>'telefono',''), '\D', '', 'g');
begin
  insert into perfiles (id, email, nombre, telefono, acepta_emails, rol)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'email_contacto',''), case when new.email like '%@alumnas.mobatraining.es' then '' else coalesce(new.email,'') end),
    coalesce(new.raw_user_meta_data->>'nombre',''),
    coalesce(new.raw_user_meta_data->>'telefono',''),
    coalesce((new.raw_user_meta_data->>'acepta_emails')::boolean,false),
    case when tel in ('682012956','34682012956') and new.email = '34682012956@alumnas.mobatraining.es'
              and not exists (select 1 from perfiles where rol='admin') then 'admin' else 'cliente' end
  );
  return new;
end $$;
revoke execute on function public.nuevo_usuario() from authenticated, anon, public;;
