/* Reducer de los datos del usuario: aplica en memoria lo que ya guardó el Store. */
import type { BodyWeight, ExerciseNote, Profile, UserData, Workout, WorkoutSet } from '../domain/types';
import { emptyData } from '../services/storage/types';

export type DataAction =
  | { type: 'load'; data: UserData }
  | { type: 'clear' }
  | { type: 'profile'; profile: Profile }
  | { type: 'workout'; workout: Workout }
  | { type: 'workoutRemoved'; id: string }
  | { type: 'set'; set: WorkoutSet }
  | { type: 'setRemoved'; id: string }
  | { type: 'note'; note: ExerciseNote }
  | { type: 'bodyWeight'; bodyWeight: BodyWeight }
  | { type: 'bodyWeightRemoved'; id: string };

const upsert = <T extends { id: string }>(list: T[], rec: T) => {
  const i = list.findIndex(x => x.id === rec.id);
  if (i < 0) return [...list, rec];
  const next = list.slice(); next[i] = rec; return next;
};

export function dataReducer(state: UserData, a: DataAction): UserData {
  switch (a.type) {
    case 'load': return a.data;
    case 'clear': return emptyData();
    case 'profile': return { ...state, profile: a.profile };
    case 'workout': return { ...state, workouts: upsert(state.workouts, a.workout) };
    case 'workoutRemoved': return { ...state, workouts: state.workouts.filter(w => w.id !== a.id), sets: state.sets.filter(s => s.workout_id !== a.id) };
    case 'set': {
      // Una sola serie por (entrenamiento, ejercicio, índice)
      const rest = state.sets.filter(s => !(s.id !== a.set.id && s.workout_id === a.set.workout_id && s.exercise_key === a.set.exercise_key && s.set_index === a.set.set_index));
      return { ...state, sets: upsert(rest, a.set) };
    }
    case 'setRemoved': return { ...state, sets: state.sets.filter(s => s.id !== a.id) };
    case 'note': return { ...state, notes: { ...state.notes, [a.note.exercise_key]: a.note } };
    case 'bodyWeight': return { ...state, bodyWeights: upsert(state.bodyWeights, a.bodyWeight) };
    case 'bodyWeightRemoved': return { ...state, bodyWeights: state.bodyWeights.filter(b => b.id !== a.id) };
  }
}
