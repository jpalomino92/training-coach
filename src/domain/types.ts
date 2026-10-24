/* Tipos del dominio: rutinas (datos) y registros de cada usuario. */

export type DayColor = 'red' | 'blue' | 'yellow' | 'green' | 'black';
/** reps, segundos o minutos (cardio). */
export type Unit = 'reps' | 's' | 'min';
export type Feel = 'ok' | 'muscle' | 'pain';
/** Técnica de la serie 2 en el sistema de 2 series (serie 1 al fallo, serie 2 más allá del fallo). */
export type SetTechnique = 'drop' | 'myo' | 'restpause';
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
  /** Incremento de peso para − / + y para el texto de la sugerencia (kg o bloques). */
  weightStep: number;
  /** Unidad de la carga: kg (por defecto) o bloques de la máquina. */
  load?: 'kg' | 'bloques';
  /** Sin carga (movilidad, estiramientos, cardio): no se pide el peso. */
  noWeight?: boolean;
  /** Ejercicios seguidos con el mismo `group` forman una biserie o un circuito. */
  group?: string;
  /** Vídeo propio del ejercicio (p. ej. el del especialista). */
  videoUrl?: string;
  /** Sistema de 2 series: la serie 1 es pesada al fallo y la 2 baja el peso y usa esta técnica. */
  setTechnique?: SetTechnique;
  /** Bloque de cardio final: se registran tramos de máquinas (ver domain/cardio.ts). */
  cardioSlot?: boolean;
  /** Ejercicios de ExerciseDB (rutinas propias del entrenador). */
  exercisedbId?: string;
  gifUrl?: string;
  /** Instrucciones originales de ExerciseDB (en inglés). */
  instructions?: string[];
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
  /** false: sin el cardio final que se añade al final de cada día. */
  cardioFinisher?: boolean;
  /** Rutina creada por un entrenador (custom_programs) o por la propia persona (`own`). */
  custom?: boolean;
  coachName?: string;
  /** Rutina propia de la persona (user_programs): creada, copiada o importada por ella. */
  own?: boolean;
}

/** Busca una rutina (incluida o propia) por su id. */
export type ProgramLookup = (id: string) => Program | undefined;

/* ---------- Preferencias del usuario (profiles.prefs, jsonb) ---------- */

export interface Prefs {
  /** 'routine': descansos de la rutina. 'custom': los dos valores de abajo. */
  rest_mode: 'routine' | 'custom';
  /** Segundos de descanso en ejercicios básicos (compound). */
  rest_compound: number;
  /** Segundos de descanso en accesorios. */
  rest_accessory: number;
  /** Sonido al terminar el descanso. */
  sound: boolean;
  /** Mantener la pantalla encendida con un entrenamiento en curso. */
  keep_awake: boolean;
  /** Peso de la barra para la calculadora de discos (kg). */
  bar_kg: number;
  /** Comparar cada serie con el fantasma (tu sesión de hace un mes). */
  ghost: boolean;
  /** Mostrar las series de calentamiento en los básicos. */
  warmup: boolean;
  /** Plan elegido para un ejercicio estancado: { clave: plan }. */
  stall_plans?: Record<string, StallPlan>;
  /** Semanas de descarga (lunes, YYYY-MM-DD). No cuentan para el fantasma ni el estancamiento. */
  deload_weeks?: string[];
  /** Semana (lunes) en la que se descartó la propuesta de descarga. */
  deload_dismissed?: string;
  /** Fecha en que se aceptó el aviso de salud de cada rutina asignada: { programId: iso } */
  acks?: Record<string, string>;
  /** Semana tipo elegida por la persona para cada rutina: { programId: weekPlan }. Sin valor, la de la rutina. */
  week_plans?: Record<string, [string, string | null][]>;
  /**
   * Rutina asignada por el entrenador que la persona dejó de lado para usar la suya (routine_id).
   * Si el entrenador asigna otra rutina distinta, vuelve a mandar la asignada.
   */
  own_routine_over?: string;
  /** Biseries elegidas por la persona, por `${programId}:${dayId}`. */
  supersets?: Record<string, SupersetPrefs>;
}

/** Plan para un ejercicio estancado: reinicio (−10 %), alternativa unas semanas, o "ahora no". */
export interface StallPlan {
  plan: 'reset' | 'alt' | 'dismiss';
  at: string;
  /** Peso con el que reinicia (plan reset). */
  weight?: number;
}

export interface SupersetPrefs {
  /** Parejas de ejercicios seguidos que se hacen en biserie: [clave A, clave B]. */
  pairs?: [string, string][];
  /** Grupos de la rutina que se hacen como ejercicios normales. */
  split?: string[];
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
  /** Ajustes; los que falten toman el valor por defecto (ver domain/prefs.ts). */
  prefs: Partial<Prefs>;
  created_at: string;
  updated_at: string;
}

export type ProfileInput = Omit<Profile, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'prefs'> & { created_at?: string; prefs?: Partial<Prefs> };

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
