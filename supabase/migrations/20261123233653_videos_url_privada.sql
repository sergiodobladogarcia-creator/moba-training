grant execute on function public.es_admin() to anon;
revoke select on public.videos from anon, authenticated;
grant select (id, titulo, disciplina, nivel, duracion_min, descripcion, gratis, publicado, creado) on public.videos to anon, authenticated;;
