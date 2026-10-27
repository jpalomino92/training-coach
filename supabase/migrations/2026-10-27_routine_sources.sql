-- "Ver hoja original": fotos y PDF de las rutinas importadas con IA.
-- Ejecutar una vez en Supabase > SQL Editor (después de 2026-10-24_user_programs.sql).
-- Bucket privado; cada archivo va en "<user_id>/<id de la rutina>/…".
-- Cada persona sube, ve y borra solo los suyos; su entrenador (si comparte datos con él) puede verlos.
-- Las planillas (Excel o CSV) y el texto pegado se guardan dentro de la propia rutina: no usan este bucket.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('routine-sources', 'routine-sources', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "routine sources: own" on storage.objects;
create policy "routine sources: own" on storage.objects for all to authenticated
  using (bucket_id = 'routine-sources' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'routine-sources' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "routine sources: coach reads" on storage.objects;
create policy "routine sources: coach reads" on storage.objects for select to authenticated
  using (bucket_id = 'routine-sources' and exists (
    select 1 from public.coach_links l
    where l.athlete_id::text = (storage.foldername(name))[1] and l.coach_id = (select auth.uid())
  ));
