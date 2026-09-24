/* Tipos del dominio: rutinas (datos) y registros de cada usuario. */

export type DayColor = 'red' | 'blue' | 'yellow' | 'green' | 'black';
export type Unit = 'reps' | 's';
export type Feel = 'ok' | 'muscle' | 'pain';
export type ThemePref = 'auto' | 'light' | 'dark';

export interface Exercise {
  key: string;
  name: string;
  sets: number;
  reps: { min: number; max: number };
  unit: Unit;
  rir: string;
  rest: number;
  pose: string;
  muscle: string;
  cue: string;
  alt: string;
  perSide: boolean;
  warn: string;
  compound: boolean;
  /** Incremento de peso para − / + y para el texto de la sugerencia (kg). */
  weightStep: number;
}

export interface WorkoutDay {
  id: string;
  name: string;
  focus: string;
  color: DayColor;
  optional?: boolean;
  exercises: Exercise[];
}

export interface ProgressionConfig {
  minRirToProgress: number;
  cautious: boolean;
  /** Texto descriptivo del incremento, se muestra en Rutina. */
  step: string;
}

export interface Safety {
  requiresHealthNotice: boolean;
  ackText?: string;
  warnings: string[];
  rules?: string[];
}

export interface Program {
  id: string;
  name: string;
  shortName: string;
  audience: string;
  level: string;
  daysPerWeek: string;
  description: string;
  intensity: string;
  progression: ProgressionConfig;
  safety: Safety;
  weekPlan: [string, string | null][];
  cardio: string;
  tips: string[];
  days: WorkoutDay[];
}

/* ---------- Registros (todos llevan user_id) ---------- */

export interface Profile {
  id: string;
  user_id: string;
  name: string;
  age: number | null;
  sex: string;
  goal: string;
  level: string;
  routine_id: string;
  start_date: string; // YYYY-MM-DD
  health_notice_ack_at: string | null;
  theme: ThemePref;
  show_body_weight: boolean;
  created_at: string;
  updated_at: string;
}

export type ProfileInput = Omit<Profile, 'id' | 'user_id' | 'created_at' | 'updated_at'> & { created_at?: string };

export interface Workout {
  id: string;
  user_id: string;
  program_id: string;
  day_id: string;
  status: 'in_progress' | 'completed';
  started_at: string;
  completed_at: string | null;
  feel: Record<string, Feel>;
  notes: string;
}

/** `id` opcional: la cola sin conexión crea el registro en el dispositivo y lo envía con el mismo id. */
export type WorkoutInput = Pick<Workout, 'program_id' | 'day_id'> & Partial<Pick<Workout, 'id' | 'status' | 'started_at' | 'feel'>>;
export type WorkoutPatch = Partial<Pick<Workout, 'status' | 'completed_at' | 'feel' | 'notes'>>;

export interface WorkoutSet {
  id: string;
  user_id: string;
  workout_id: string;
  exercise_key: string;
  set_index: number;
  weight: number | null;
  reps: number;
  rir: number | null;
  created_at: string;
  updated_at: string;
}

export type SetInput = Pick<WorkoutSet, 'workout_id' | 'exercise_key' | 'set_index' | 'weight' | 'reps' | 'rir'> & { id?: string };

export interface ExerciseNote {
  user_id: string;
  exercise_key: string;
  note: string;
  updated_at: string;
}

export interface BodyWeight {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  weight_kg: number;
  note: string;
  created_at: string;
}

export type BodyWeightInput = Pick<BodyWeight, 'date' | 'weight_kg'> & { note?: string; id?: string };

export interface UserData {
  profile: Profile | null;
  workouts: Workout[];
  sets: WorkoutSet[];
  notes: Record<string, ExerciseNote>;
  bodyWeights: BodyWeight[];
}

export interface AuthUser {
  id: string;
  email: string;
}
