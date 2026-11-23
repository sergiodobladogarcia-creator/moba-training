-- ============ TABLAS ============
create table public.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null default '',
  email text not null default '',
  telefono text not null default '',
  rol text not null default 'cliente' check (rol in ('cliente','admin')),
  estado text not null default 'activa' check (estado in ('activa','baja')),
  fecha_alta timestamptz not null default now(),
  fecha_baja timestamptz,
  motivo_baja text,
  objetivo text,
  notas text,
  acepta_emails boolean not null default false
);

create table public.productos (
  id text primary key,
  nombre text not null,
  tipo text not null check (tipo in ('grupo','personal','videoteca','completo')),
  clases int,                 -- null = ilimitado
  precio numeric(8,2) not null,
  dias_validez int not null default 60,
  mensual boolean not null default false,
  incluye_videoteca boolean not null default false,
  descripcion text,
  activo boolean not null default true,
  orden int not null default 0
);

create table public.clases (
  id bigint generated always as identity primary key,
  titulo text not null,
  disciplina text not null check (disciplina in ('Pilates','Yoga','Funcional','Personal')),
  nivel text not null default 'Todos',
  tipo text not null default 'grupo' check (tipo in ('grupo','personal')),
  inicio timestamptz not null,
  duracion_min int not null default 50,
  plazas int not null default 6 check (plazas between 1 and 6),
  estado text not null default 'programada' check (estado in ('programada','cancelada')),
  descripcion text,
  creada timestamptz not null default now()
);
create index on public.clases (inicio);

create table public.bonos (
  id bigint generated always as identity primary key,
  cliente_id uuid not null references public.perfiles(id) on delete cascade,
  producto_id text references public.productos(id),
  nombre text not null,
  tipo text not null check (tipo in ('grupo','personal','videoteca','completo','prueba')),
  clases_total int,
  clases_usadas int not null default 0,
  precio numeric(8,2) not null default 0,
  metodo_pago text not null default 'bizum' check (metodo_pago in ('bizum','transferencia','efectivo','tarjeta','gratis')),
  estado_pago text not null default 'pendiente' check (estado_pago in ('pendiente','pagado','anulado')),
  fecha_compra timestamptz not null default now(),
  fecha_pago timestamptz,
  inicio date not null default current_date,
  caduca date not null,
  numero_factura int
);
create index on public.bonos (cliente_id);
create sequence public.factura_seq;

create table public.reservas (
  id bigint generated always as identity primary key,
  clase_id bigint not null references public.clases(id) on delete cascade,
  cliente_id uuid not null references public.perfiles(id) on delete cascade,
  bono_id bigint references public.bonos(id) on delete set null,
  estado text not null default 'confirmada' check (estado in ('confirmada','cancelada','asistio','falta')),
  enfoque text,
  creada timestamptz not null default now()
);
create unique index reservas_unica on public.reservas (clase_id, cliente_id) where estado <> 'cancelada';
create index on public.reservas (cliente_id);

create table public.videos (
  id bigint generated always as identity primary key,
  titulo text not null,
  disciplina text not null check (disciplina in ('Pilates','Yoga','Funcional')),
  nivel text not null default 'Todos',
  duracion_min int not null default 20,
  descripcion text,
  url text,
  gratis boolean not null default false,
  publicado boolean not null default false,
  creado timestamptz not null default now()
);

create table public.avisos (
  id bigint generated always as identity primary key,
  cliente_id uuid references public.perfiles(id) on delete cascade,
  bono_id bigint references public.bonos(id) on delete set null,
  tipo text not null,
  creado timestamptz not null default now()
);

create table public.suscriptores (
  id bigint generated always as identity primary key,
  email text not null unique,
  origen text not null default 'guia',
  creado timestamptz not null default now()
);

-- ============ AYUDANTES ============
create or replace function public.es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfiles where id = auth.uid() and rol = 'admin');
$$;

-- Perfil automático al registrarse. La primera cuenta es la de María (admin).
create or replace function public.nuevo_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into perfiles (id, email, nombre, telefono, acepta_emails, rol)
  values (
    new.id, coalesce(new.email,''),
    coalesce(new.raw_user_meta_data->>'nombre',''),
    coalesce(new.raw_user_meta_data->>'telefono',''),
    coalesce((new.raw_user_meta_data->>'acepta_emails')::boolean,false),
    case when exists (select 1 from perfiles where rol='admin') then 'cliente' else 'admin' end
  );
  return new;
end $$;
create trigger al_registrarse after insert on auth.users
  for each row execute function public.nuevo_usuario();

-- ============ SEGURIDAD (RLS) ============
alter table public.perfiles enable row level security;
alter table public.productos enable row level security;
alter table public.clases enable row level security;
alter table public.bonos enable row level security;
alter table public.reservas enable row level security;
alter table public.videos enable row level security;
alter table public.avisos enable row level security;
alter table public.suscriptores enable row level security;

create policy perfiles_ver on public.perfiles for select to authenticated using (id = auth.uid() or es_admin());
create policy perfiles_admin on public.perfiles for all to authenticated using (es_admin()) with check (es_admin());

create policy productos_ver on public.productos for select to anon, authenticated using (true);
create policy productos_admin on public.productos for all to authenticated using (es_admin()) with check (es_admin());

create policy clases_ver on public.clases for select to anon, authenticated using (true);
create policy clases_admin on public.clases for all to authenticated using (es_admin()) with check (es_admin());

create policy bonos_ver on public.bonos for select to authenticated using (cliente_id = auth.uid() or es_admin());
create policy bonos_admin on public.bonos for all to authenticated using (es_admin()) with check (es_admin());

create policy reservas_ver on public.reservas for select to authenticated using (cliente_id = auth.uid() or es_admin());
create policy reservas_admin on public.reservas for all to authenticated using (es_admin()) with check (es_admin());

create policy videos_ver on public.videos for select to anon, authenticated using (publicado or es_admin());
create policy videos_admin on public.videos for all to authenticated using (es_admin()) with check (es_admin());
-- La URL del vídeo solo se entrega por la función ver_video().
revoke select (url) on public.videos from anon, authenticated;

create policy avisos_admin on public.avisos for all to authenticated using (es_admin()) with check (es_admin());

create policy suscriptores_alta on public.suscriptores for insert to anon, authenticated with check (true);
create policy suscriptores_admin on public.suscriptores for select to authenticated using (es_admin());
create policy suscriptores_borrar on public.suscriptores for delete to authenticated using (es_admin());

-- ============ PRECIOS INICIALES ============
insert into public.productos (id,nombre,tipo,clases,precio,dias_validez,mensual,incluye_videoteca,descripcion,orden) values
 ('g1','Clase en grupo suelta','grupo',1,6,30,false,false,'Una clase en directo, grupos de máximo 6 personas',1),
 ('g4','Bono 4 clases en grupo','grupo',4,22,60,false,false,'4 clases en directo · válido 60 días',2),
 ('g8','Bono 8 clases en grupo','grupo',8,40,60,false,false,'8 clases en directo · válido 60 días',3),
 ('gil','Clases en grupo ilimitadas','grupo',null,35,30,true,false,'Todas las clases en grupo del mes',4),
 ('p1','Entrenamiento personal','personal',1,20,60,false,false,'Sesión 1 a 1 de 55 min por videollamada',5),
 ('p4','Bono 4 entrenamientos personales','personal',4,76,60,false,false,'4 sesiones 1 a 1 · válido 60 días',6),
 ('p8','Bono 8 entrenamientos personales','personal',8,144,90,false,false,'8 sesiones 1 a 1 · válido 90 días',7),
 ('duo','Entrenamiento dúo (2 personas)','personal',1,28,60,false,false,'Sesión para 2 personas · 14 € por persona',8),
 ('vid','Videoteca','videoteca',null,12.99,30,true,true,'Acceso a todos los vídeos durante un mes',9),
 ('comp','Moba Completo','completo',null,43,30,true,true,'Clases en grupo ilimitadas + videoteca',10);
;
