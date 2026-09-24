/* ==========================================================
   Storage: misma interfaz para los dos adaptadores.
   Todos los registros llevan user_id. El adaptador nunca lee ni
   escribe datos de otro usuario.
   ========================================================== */
import type {
  BodyWeight, BodyWeightInput, ExerciseNote, Profile, ProfileInput,
  SetInput, UserData, Workout, WorkoutInput, WorkoutPatch, WorkoutSet
} from '../../domain/types';

export interface Store {
  readonly userId: string;
  loadAll(): Promise<UserData>;
  saveProfile(p: ProfileInput): Promise<Profile>;
  createWorkout(w: WorkoutInput): Promise<Workout>;
  updateWorkout(id: string, patch: WorkoutPatch): Promise<Workout>;
  deleteWorkout(id: string): Promise<void>;
  /** Crea o sustituye la serie (workout_id, exercise_key, set_index). */
  upsertSet(s: SetInput): Promise<WorkoutSet>;
  deleteSet(id: string): Promise<void>;
  saveNote(exerciseKey: string, text: string): Promise<ExerciseNote>;
  addBodyWeight(b: BodyWeightInput): Promise<BodyWeight>;
  updateBodyWeight(id: string, patch: Partial<BodyWeightInput>): Promise<BodyWeight>;
  deleteBodyWeight(id: string): Promise<void>;
}

/** Error del almacenamiento remoto con el código de PostgREST/PostgreSQL y el estado HTTP (0 = sin red). */
export class StoreError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(message: string, code = '', status = 0) {
    super(message);
    this.name = 'StoreError';
    this.code = code;
    this.status = status;
  }
}

/** Estado de sincronización (solo lo expone el almacenamiento con cola sin conexión). */
export interface SyncState { online: boolean; pending: number; syncing: boolean }

export interface SyncSource {
  getSyncState(): SyncState;
  /** Devuelve la función para dejar de escuchar. */
  onSync(listener: (s: SyncState) => void): () => void;
  /** Avisa cuando el servidor rechaza un cambio de forma definitiva. */
  onRejected(listener: (count: number) => void): () => void;
  flush(): Promise<void>;
}

export const isSyncSource = (s: unknown): s is SyncSource => !!s && typeof (s as SyncSource).onSync === 'function';

export const emptyData = (): UserData => ({ profile: null, workouts: [], sets: [], notes: {}, bodyWeights: [] });
