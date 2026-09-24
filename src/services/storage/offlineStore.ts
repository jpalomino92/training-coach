/* ==========================================================
   Almacenamiento con cola sin conexión (se usa con Supabase).
   - Cada cambio se aplica primero en una copia local (LocalStore con
     su propia clave) y se apunta en una cola persistente.
   - La cola se envía al servidor en orden cuando hay conexión.
   - Los registros se crean con su id en el dispositivo y se envían con
     el mismo id, así la copia local y el servidor coinciden.
   - Errores de red o de sesión caducada: se reintenta más tarde.
     Rechazo definitivo del servidor: se descarta y se avisa.
     Duplicado (el envío llegó pero se perdió la respuesta): cuenta como hecho.
   Todo sigue ligado al user_id: copia y cola tienen una clave por usuario.
   ========================================================== */
import { STORAGE_PREFIX } from '../../config';
import type {
  BodyWeight, BodyWeightInput, ExerciseNote, Profile, ProfileInput,
  SetInput, UserData, Workout, WorkoutInput, WorkoutPatch, WorkoutSet
} from '../../domain/types';
import { LocalStore } from './localStore';
import { StoreError, type Store, type SyncSource, type SyncState } from './types';

export const cacheKey = (userId: string) => `${STORAGE_PREFIX}:cache:${userId}`;
export const outboxKey = (userId: string) => `${STORAGE_PREFIX}:outbox:${userId}`;

export type Op =
  | { t: 'profile'; p: ProfileInput }
  | { t: 'createWorkout'; w: WorkoutInput & { id: string } }
  | { t: 'updateWorkout'; id: string; patch: WorkoutPatch }
  | { t: 'deleteWorkout'; id: string }
  | { t: 'upsertSet'; s: SetInput & { id: string } }
  | { t: 'deleteSet'; id: string }
  | { t: 'note'; key: string; text: string }
  | { t: 'addBodyWeight'; b: BodyWeightInput & { id: string } }
  | { t: 'updateBodyWeight'; id: string; patch: Partial<BodyWeightInput> }
  | { t: 'deleteBodyWeight'; id: string };

type Kind = 'retry' | 'done' | 'reject';

/** Decide qué hacer con un error al enviar un cambio. */
export function classify(e: unknown): Kind {
  if (!(e instanceof StoreError)) return 'retry'; // TypeError de fetch, etc.
  if (e.code === '23505') return 'done';           // ya existe: el envío anterior llegó
  if (e.status === 0 || e.status >= 500 || [401, 403, 408, 429].includes(e.status)) {
    // 403 solo si es de sesión; las violaciones de RLS son definitivas
    if (e.status === 403 && e.code === '42501') return 'reject';
    return 'retry';
  }
  if (/^PGRST30[0-9]$/.test(e.code) || /jwt|token|fetch|network|load failed|timeout/i.test(e.message)) return 'retry';
  return 'reject';
}

const isOnline = () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false);

export class OfflineStore implements Store, SyncSource {
  readonly userId: string;
  private readonly remote: Store;
  private readonly cache: LocalStore;
  private readonly storage: Storage;
  private queue: Op[];
  private flushing: Promise<void> | null = null;
  private reachable = true;
  private listeners = new Set<(s: SyncState) => void>();
  private rejectListeners = new Set<(n: number) => void>();
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly onOnline = () => { this.reachable = true; this.emit(); void this.flush(); };
  private readonly onOffline = () => this.emit();

  constructor(remote: Store, userId: string, storage: Storage = localStorage) {
    this.remote = remote;
    this.userId = userId;
    this.storage = storage;
    this.cache = new LocalStore(userId, storage, cacheKey(userId));
    try { this.queue = JSON.parse(storage.getItem(outboxKey(userId)) || '[]'); } catch { this.queue = []; }
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.onOnline);
      window.addEventListener('offline', this.onOffline);
    }
  }

  /** Deja de escuchar la red (al cerrar sesión). */
  dispose() {
    clearTimeout(this.retryTimer);
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.onOnline);
      window.removeEventListener('offline', this.onOffline);
    }
    this.listeners.clear();
    this.rejectListeners.clear();
  }

  /* ---------- Sincronización ---------- */

  getSyncState(): SyncState {
    return { online: isOnline() && this.reachable, pending: this.queue.length, syncing: !!this.flushing };
  }
  onSync(l: (s: SyncState) => void) { this.listeners.add(l); return () => { this.listeners.delete(l); }; }
  onRejected(l: (n: number) => void) { this.rejectListeners.add(l); return () => { this.rejectListeners.delete(l); }; }
  private emit() { const s = this.getSyncState(); this.listeners.forEach(l => l(s)); }

  private save() {
    this.storage.setItem(outboxKey(this.userId), JSON.stringify(this.queue));
  }

  private enqueue(op: Op) {
    this.queue.push(op);
    this.save();
    this.emit();
    void this.flush();
  }

  private scheduleRetry() {
    clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => void this.flush(), 20_000);
  }

  /** Envía la cola en orden. Si ya se está enviando, devuelve ese mismo envío. */
  flush(): Promise<void> {
    if (this.flushing) return this.flushing;
    if (!this.queue.length || !isOnline()) return Promise.resolve();
    this.flushing = (async () => {
      let rejected = 0;
      try {
        while (this.queue.length) {
          const op = this.queue[0];
          try {
            await this.apply(op);
          } catch (e) {
            const kind = classify(e);
            if (kind === 'retry') { this.reachable = !(e instanceof StoreError && e.status === 0) && !(e instanceof TypeError); this.scheduleRetry(); break; }
            if (kind === 'reject') rejected++;
          }
          this.queue.shift();
          this.save();
          this.reachable = true;
          this.emit();
        }
      } finally {
        this.flushing = null;
        this.emit();
        if (rejected) this.rejectListeners.forEach(l => l(rejected));
      }
    })();
    this.emit();
    return this.flushing;
  }

  private async apply(op: Op): Promise<void> {
    const r = this.remote;
    switch (op.t) {
      case 'profile': await r.saveProfile(op.p); break;
      case 'createWorkout': await r.createWorkout(op.w); break;
      case 'updateWorkout': await r.updateWorkout(op.id, op.patch); break;
      case 'deleteWorkout': await r.deleteWorkout(op.id); break;
      case 'upsertSet': await r.upsertSet(op.s); break;
      case 'deleteSet': await r.deleteSet(op.id); break;
      case 'note': await r.saveNote(op.key, op.text); break;
      case 'addBodyWeight': await r.addBodyWeight(op.b); break;
      case 'updateBodyWeight': await r.updateBodyWeight(op.id, op.patch); break;
      case 'deleteBodyWeight': await r.deleteBodyWeight(op.id); break;
    }
  }

  /* ---------- Store ---------- */

  /** Envía lo pendiente y, si hay conexión y la cola quedó vacía, trae los datos del servidor. */
  async loadAll(): Promise<UserData> {
    await this.flush();
    if (!this.queue.length && isOnline()) {
      try {
        this.cache.replaceAll(await this.remote.loadAll());
        this.reachable = true;
      } catch (e) {
        if (classify(e) !== 'retry') throw e;
        this.reachable = false; // sin red: se usa la copia local
      }
      this.emit();
    }
    return this.cache.loadAll();
  }

  async saveProfile(p: ProfileInput): Promise<Profile> {
    const rec = await this.cache.saveProfile(p);
    this.enqueue({ t: 'profile', p: { ...p, created_at: rec.created_at } });
    return rec;
  }

  async createWorkout(w: WorkoutInput): Promise<Workout> {
    const rec = await this.cache.createWorkout(w);
    this.enqueue({ t: 'createWorkout', w: { id: rec.id, program_id: rec.program_id, day_id: rec.day_id, status: rec.status, started_at: rec.started_at, feel: rec.feel } });
    return rec;
  }

  async updateWorkout(id: string, patch: WorkoutPatch): Promise<Workout> {
    const rec = await this.cache.updateWorkout(id, patch);
    this.enqueue({ t: 'updateWorkout', id, patch });
    return rec;
  }

  async deleteWorkout(id: string): Promise<void> {
    await this.cache.deleteWorkout(id);
    this.enqueue({ t: 'deleteWorkout', id });
  }

  async upsertSet(s: SetInput): Promise<WorkoutSet> {
    const rec = await this.cache.upsertSet(s);
    this.enqueue({ t: 'upsertSet', s: { id: rec.id, workout_id: rec.workout_id, exercise_key: rec.exercise_key, set_index: rec.set_index, weight: rec.weight, reps: rec.reps, rir: rec.rir } });
    return rec;
  }

  async deleteSet(id: string): Promise<void> {
    await this.cache.deleteSet(id);
    this.enqueue({ t: 'deleteSet', id });
  }

  async saveNote(exerciseKey: string, text: string): Promise<ExerciseNote> {
    const rec = await this.cache.saveNote(exerciseKey, text);
    this.enqueue({ t: 'note', key: exerciseKey, text });
    return rec;
  }

  async addBodyWeight(b: BodyWeightInput): Promise<BodyWeight> {
    const rec = await this.cache.addBodyWeight(b);
    this.enqueue({ t: 'addBodyWeight', b: { id: rec.id, date: rec.date, weight_kg: rec.weight_kg, note: rec.note } });
    return rec;
  }

  async updateBodyWeight(id: string, patch: Partial<BodyWeightInput>): Promise<BodyWeight> {
    const rec = await this.cache.updateBodyWeight(id, patch);
    this.enqueue({ t: 'updateBodyWeight', id, patch });
    return rec;
  }

  async deleteBodyWeight(id: string): Promise<void> {
    await this.cache.deleteBodyWeight(id);
    this.enqueue({ t: 'deleteBodyWeight', id });
  }
}
