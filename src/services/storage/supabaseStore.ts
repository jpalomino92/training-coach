/* Adaptador Supabase (producción).
   Requiere supabase/schema.sql aplicado. RLS garantiza en el servidor
   que cada usuario solo ve sus filas; aquí además filtramos por user_id. */
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  BodyWeight, BodyWeightInput, ExerciseNote, Profile, ProfileInput,
  SetInput, UserData, Workout, WorkoutInput, WorkoutPatch, WorkoutSet
} from '../../domain/types';
import { nowIso, uid } from '../uid';
import { StoreError, type Store } from './types';

interface Res<T> { data: T | null; error: { message: string; code?: string } | null; status?: number }

const numOrNull = (v: unknown) => (v == null ? null : Number(v));
const toSet = (r: WorkoutSet): WorkoutSet => ({ ...r, weight: numOrNull(r.weight), rir: numOrNull(r.rir), reps: Number(r.reps) });
const toBw = (r: BodyWeight): BodyWeight => ({ ...r, weight_kg: Number(r.weight_kg), note: r.note || '' });

export class SupabaseStore implements Store {
  readonly userId: string;
  private readonly c: SupabaseClient;

  constructor(client: SupabaseClient, userId: string) {
    if (!userId) throw new Error('Falta el usuario');
    this.c = client; this.userId = userId;
  }

  private chk<T>(res: Res<T>): T {
    if (res.error) throw new StoreError(res.error.message, res.error.code || '', res.status ?? 0);
    return res.data as T;
  }

  async loadAll(): Promise<UserData> {
    const u = this.userId;
    const [p, w, s, n, b] = await Promise.all([
      this.c.from('profiles').select('*').eq('user_id', u).maybeSingle(),
      this.c.from('workouts').select('*').eq('user_id', u),
      this.c.from('workout_sets').select('*').eq('user_id', u),
      this.c.from('exercise_notes').select('*').eq('user_id', u),
      this.c.from('body_weights').select('*').eq('user_id', u)
    ]);
    const notes: Record<string, ExerciseNote> = {};
    (this.chk<ExerciseNote[]>(n) || []).forEach(r => { notes[r.exercise_key] = r; });
    const profile = this.chk<Profile | null>(p);
    return {
      profile: profile ? { ...profile, age: numOrNull(profile.age) } : null,
      workouts: (this.chk<Workout[]>(w) || []).map(x => ({ ...x, feel: x.feel || {}, notes: x.notes || '' })),
      sets: (this.chk<WorkoutSet[]>(s) || []).map(toSet),
      notes,
      bodyWeights: (this.chk<BodyWeight[]>(b) || []).map(toBw)
    };
  }

  async saveProfile(p: ProfileInput): Promise<Profile> {
    const row = { ...p, id: this.userId, user_id: this.userId, updated_at: nowIso() };
    return this.chk<Profile>(await this.c.from('profiles').upsert(row).select().single());
  }

  async createWorkout(w: WorkoutInput): Promise<Workout> {
    const row = { status: 'in_progress', feel: {}, notes: '', completed_at: null, ...w, id: w.id || uid(), started_at: w.started_at || nowIso(), user_id: this.userId };
    return this.chk<Workout>(await this.c.from('workouts').insert(row).select().single());
  }

  async updateWorkout(id: string, patch: WorkoutPatch): Promise<Workout> {
    const clean: Record<string, unknown> = { ...patch };
    delete clean.id; delete clean.user_id;
    return this.chk<Workout>(await this.c.from('workouts').update(clean).eq('id', id).eq('user_id', this.userId).select().single());
  }

  async deleteWorkout(id: string): Promise<void> {
    this.chk(await this.c.from('workout_sets').delete().eq('workout_id', id).eq('user_id', this.userId));
    this.chk(await this.c.from('workouts').delete().eq('id', id).eq('user_id', this.userId));
  }

  async upsertSet(s: SetInput): Promise<WorkoutSet> {
    const row = { ...s, user_id: this.userId, updated_at: nowIso() };
    return toSet(this.chk<WorkoutSet>(await this.c.from('workout_sets').upsert(row, { onConflict: 'workout_id,exercise_key,set_index' }).select().single()));
  }

  async deleteSet(id: string): Promise<void> {
    this.chk(await this.c.from('workout_sets').delete().eq('id', id).eq('user_id', this.userId));
  }

  async saveNote(exerciseKey: string, text: string): Promise<ExerciseNote> {
    const row = { user_id: this.userId, exercise_key: exerciseKey, note: text, updated_at: nowIso() };
    return this.chk<ExerciseNote>(await this.c.from('exercise_notes').upsert(row, { onConflict: 'user_id,exercise_key' }).select().single());
  }

  async addBodyWeight(b: BodyWeightInput): Promise<BodyWeight> {
    const row = { note: '', ...b, id: b.id || uid(), user_id: this.userId };
    return toBw(this.chk<BodyWeight>(await this.c.from('body_weights').insert(row).select().single()));
  }

  async updateBodyWeight(id: string, patch: Partial<BodyWeightInput>): Promise<BodyWeight> {
    return toBw(this.chk<BodyWeight>(await this.c.from('body_weights').update(patch).eq('id', id).eq('user_id', this.userId).select().single()));
  }

  async deleteBodyWeight(id: string): Promise<void> {
    this.chk(await this.c.from('body_weights').delete().eq('id', id).eq('user_id', this.userId));
  }
}
