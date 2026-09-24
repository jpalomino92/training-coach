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

export const emptyData = (): UserData => ({ profile: null, workouts: [], sets: [], notes: {}, bodyWeights: [] });
