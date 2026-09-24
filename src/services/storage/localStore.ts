/* Adaptador local (modo demo): localStorage, una clave por usuario. */
import { STORAGE_PREFIX } from '../../config';
import type {
  BodyWeight, BodyWeightInput, ExerciseNote, Profile, ProfileInput,
  SetInput, UserData, Workout, WorkoutInput, WorkoutPatch, WorkoutSet
} from '../../domain/types';
import { nowIso, uid } from '../uid';
import { emptyData, type Store } from './types';

export const dataKey = (userId: string) => `${STORAGE_PREFIX}:data:${userId}`;

type Owned = { user_id: string };

export class LocalStore implements Store {
  readonly userId: string;
  private readonly key: string;
  private d: UserData | null = null;
  private readonly storage: Storage;

  /** `key` permite usarlo como copia local de otro almacenamiento (cola sin conexión). */
  constructor(userId: string, storage: Storage = localStorage, key: string = dataKey(userId)) {
    if (!userId) throw new Error('Falta el usuario');
    this.userId = userId;
    this.key = key;
    this.storage = storage;
  }

  /** Sustituye todo por los datos recibidos (solo los de este usuario). */
  replaceAll(d: UserData): void {
    this.d = structuredClone({
      profile: this.own(d.profile) ? d.profile : null,
      workouts: d.workouts.filter(this.own),
      sets: d.sets.filter(this.own),
      notes: Object.fromEntries(Object.entries(d.notes).filter(([, n]) => this.own(n))),
      bodyWeights: d.bodyWeights.filter(this.own)
    });
    this.write();
  }

  private read(): UserData {
    if (this.d) return this.d;
    let raw: Partial<UserData> | null;
    try { raw = JSON.parse(this.storage.getItem(this.key) || 'null'); } catch { raw = null; }
    this.d = { ...emptyData(), ...(raw && typeof raw === 'object' ? raw : {}) };
    return this.d;
  }

  private write() {
    try { this.storage.setItem(this.key, JSON.stringify(this.d)); }
    catch { throw new Error('No se pudo guardar en este dispositivo. Libera espacio o revisa la configuración del navegador.'); }
  }

  private own = <T extends Owned>(rec: T | null | undefined): rec is T => !!rec && rec.user_id === this.userId;

  async loadAll(): Promise<UserData> {
    const d = this.read();
    return structuredClone({
      profile: this.own(d.profile) ? { ...d.profile, prefs: d.profile.prefs || {} } : null,
      workouts: d.workouts.filter(this.own),
      sets: d.sets.filter(this.own),
      notes: Object.fromEntries(Object.entries(d.notes).filter(([, n]) => this.own(n))),
      bodyWeights: d.bodyWeights.filter(this.own)
    });
  }

  async saveProfile(p: ProfileInput): Promise<Profile> {
    const d = this.read();
    const now = nowIso();
    d.profile = { ...p, prefs: p.prefs ?? d.profile?.prefs ?? {}, id: this.userId, user_id: this.userId, created_at: d.profile?.created_at || p.created_at || now, updated_at: now };
    this.write();
    return { ...d.profile };
  }

  async createWorkout(w: WorkoutInput): Promise<Workout> {
    const d = this.read();
    const rec: Workout = {
      status: 'in_progress', feel: {}, notes: '', completed_at: null,
      ...w, id: w.id || uid(), started_at: w.started_at || nowIso(), user_id: this.userId
    };
    d.workouts.push(rec); this.write();
    return structuredClone(rec);
  }

  async updateWorkout(id: string, patch: WorkoutPatch): Promise<Workout> {
    const d = this.read();
    const w = d.workouts.find(x => x.id === id && this.own(x));
    if (!w) throw new Error('Entrenamiento no encontrado');
    Object.assign(w, patch, { id: w.id, user_id: this.userId });
    this.write();
    return structuredClone(w);
  }

  async deleteWorkout(id: string): Promise<void> {
    const d = this.read();
    d.workouts = d.workouts.filter(x => !(x.id === id && this.own(x)));
    d.sets = d.sets.filter(s => !(s.workout_id === id && this.own(s)));
    this.write();
  }

  async upsertSet(s: SetInput): Promise<WorkoutSet> {
    const d = this.read();
    if (!d.workouts.some(w => w.id === s.workout_id && this.own(w))) throw new Error('Entrenamiento no encontrado');
    const i = d.sets.findIndex(x => this.own(x) && x.workout_id === s.workout_id && x.exercise_key === s.exercise_key && x.set_index === s.set_index);
    const now = nowIso();
    const base = i >= 0 ? d.sets[i] : { id: s.id || uid(), created_at: now };
    const rec: WorkoutSet = { ...base, ...s, id: base.id, user_id: this.userId, updated_at: now };
    if (i >= 0) d.sets[i] = rec; else d.sets.push(rec);
    this.write();
    return { ...rec };
  }

  async deleteSet(id: string): Promise<void> {
    const d = this.read();
    d.sets = d.sets.filter(x => !(x.id === id && this.own(x)));
    this.write();
  }

  async saveNote(exerciseKey: string, text: string): Promise<ExerciseNote> {
    const d = this.read();
    const rec: ExerciseNote = { user_id: this.userId, exercise_key: exerciseKey, note: text, updated_at: nowIso() };
    d.notes[exerciseKey] = rec;
    this.write();
    return { ...rec };
  }

  async addBodyWeight(b: BodyWeightInput): Promise<BodyWeight> {
    const d = this.read();
    const rec: BodyWeight = { note: '', ...b, id: b.id || uid(), user_id: this.userId, created_at: nowIso() };
    d.bodyWeights.push(rec); this.write();
    return { ...rec };
  }

  async updateBodyWeight(id: string, patch: Partial<BodyWeightInput>): Promise<BodyWeight> {
    const d = this.read();
    const b = d.bodyWeights.find(x => x.id === id && this.own(x));
    if (!b) throw new Error('Registro no encontrado');
    Object.assign(b, patch, { id: b.id, user_id: this.userId });
    this.write();
    return { ...b };
  }

  async deleteBodyWeight(id: string): Promise<void> {
    const d = this.read();
    d.bodyWeights = d.bodyWeights.filter(x => !(x.id === id && this.own(x)));
    this.write();
  }
}
