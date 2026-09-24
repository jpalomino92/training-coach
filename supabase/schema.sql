-- ==========================================================
-- Esquema para Supabase (PostgreSQL + Auth + Row Level Security)
-- Ejecutar en: Supabase > SQL Editor (proyecto nuevo, sin datos previos).
-- Los usuarios los gestiona Supabase Auth en auth.users.
-- Las rutinas viven en el código (src/domain/routines.ts): aquí solo
-- se guardan los datos de cada usuario, siempre con user_id.
-- ==========================================================

-- ---------- Perfil (1 fila por usuario) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  age int check (age is null or age between 14 and 100),
  sex text not null default '',
  goal text not null default '',
  level text not null default '',
  routine_id text not null,
  start_date date not null default current_date,
  health_notice_ack_at timestamptz,
  theme text not null default 'auto' check (theme in ('auto', 'light', 'dark')),
  show_body_weight boolean not null default true,
  prefs jsonb not null default '{}'::jsonb,   -- descansos personalizados, sonido, pantalla encendida...
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_id_is_user check (id = user_id)
);

-- Proyectos creados con una versión anterior de este archivo (migrations/2026-09-25_prefs.sql)
alter table public.profiles add column if not exists prefs jsonb not null default '{}'::jsonb;

-- ---------- Entrenamientos ----------
create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  program_id text not null,
  day_id text not null,
  status text not null check (status in ('in_progress', 'completed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  feel jsonb not null default '{}'::jsonb,   -- { exercise_key: 'ok' | 'muscle' | 'pain' }
  notes text not null default '',
  unique (id, user_id)
);
create index if not exists workouts_user_idx on public.workouts(user_id, started_at desc);

-- ---------- Series ----------
create table if not exists public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_id uuid not null,
  exercise_key text not null,
  set_index int not null check (set_index >= 0),
  weight numeric(6,2) check (weight is null or (weight >= 0 and weight <= 500)),
  reps int not null check (reps between 1 and 600),
  rir numeric(3,1) check (rir is null or (rir >= 0 and rir <= 10)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workout_id, exercise_key, set_index),
  -- La serie pertenece a un entrenamiento del MISMO usuario
  foreign key (workout_id, user_id) references public.workouts(id, user_id) on delete cascade
);
create index if not exists workout_sets_user_idx on public.workout_sets(user_id, exercise_key);

-- ---------- Notas por ejercicio ----------
create table if not exists public.exercise_notes (
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_key text not null,
  note text not null default '' check (char_length(note) <= 2000),
  updated_at timestamptz not null default now(),
  primary key (user_id, exercise_key)
);

-- ---------- Peso corporal ----------
create table if not exists public.body_weights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  weight_kg numeric(5,1) not null check (weight_kg > 0 and weight_kg < 500),
  note text not null default '' check (char_length(note) <= 500),
  created_at timestamptz not null default now()
);
create index if not exists body_weights_user_idx on public.body_weights(user_id, date desc);

-- ---------- Row Level Security ----------
alter table public.profiles       enable row level security;
alter table public.workouts       enable row level security;
alter table public.workout_sets   enable row level security;
alter table public.exercise_notes enable row level security;
alter table public.body_weights   enable row level security;

-- Cada usuario solo puede leer y escribir sus propias filas.
-- (select auth.uid()) se evalúa una vez por consulta (recomendación de Supabase).
drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and id = (select auth.uid()));

drop policy if exists "own workouts" on public.workouts;
create policy "own workouts" on public.workouts for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "own sets" on public.workout_sets;
create policy "own sets" on public.workout_sets for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "own notes" on public.exercise_notes;
create policy "own notes" on public.exercise_notes for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "own body weights" on public.body_weights;
create policy "own body weights" on public.body_weights for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Los usuarios anónimos no tienen acceso a ninguna tabla.
revoke all on public.profiles, public.workouts, public.workout_sets, public.exercise_notes, public.body_weights from anon;
