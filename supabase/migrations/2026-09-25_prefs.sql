-- Preferencias del usuario (descansos personalizados, sonido, pantalla encendida).
-- Ejecutar una vez en Supabase > SQL Editor si el proyecto se creó con una versión anterior de schema.sql.
alter table public.profiles add column if not exists prefs jsonb not null default '{}'::jsonb;
