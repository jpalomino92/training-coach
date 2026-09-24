/* ==========================================================
   Entrenador y alumnos (solo modo Supabase).
   La seguridad la pone Row Level Security (migrations/2026-09-26_coach.sql):
   aquí solo se hacen las consultas. La rutina asignada se guarda también
   en el dispositivo para poder entrenar sin conexión.
   ========================================================== */
import type { SupabaseClient } from '@supabase/supabase-js';
import { STORAGE_PREFIX } from '../config';
import { CUSTOM_PREFIX, customUuid } from '../domain/customProgram';
import type { BodyWeight, Profile, Program, UserData, Workout, WorkoutSet } from '../domain/types';
import { StoreError } from './storage/types';

export interface CoachInfo { displayName: string }
export interface CoachLink { coachId: string; coachName: string; since: string }
export interface Invite { code: string; expiresAt: string; usedAt: string | null }
export interface AthleteRow { id: string; name: string; since: string; programId: string | null }

/** Lo que el alumno necesita al arrancar: su entrenador y la rutina asignada. */
export interface AthleteState { link: CoachLink | null; program: Program | null }

const cacheKey = (userId: string) => `${STORAGE_PREFIX}:coach:${userId}`;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin 0/O ni 1/I

export function newInviteCode(): string {
  const b = globalThis.crypto.getRandomValues(new Uint8Array(8));
  return [...b].map(x => CODE_CHARS[x % CODE_CHARS.length]).join('');
}

const programFromRow = (r: { id: string; data: Program }): Program => ({ ...r.data, id: CUSTOM_PREFIX + r.id, custom: true });

export class CoachService {
  private readonly c: SupabaseClient;
  readonly userId: string;

  constructor(client: SupabaseClient, userId: string) { this.c = client; this.userId = userId; }

  private chk<T>(res: { data: T | null; error: { message: string; code?: string } | null; status?: number }): T {
    if (res.error) throw new StoreError(res.error.message, res.error.code || '', res.status ?? 0);
    return res.data as T;
  }

  /* ---------- Alumno ---------- */

  /** Entrenador y rutina asignada. Sin conexión devuelve lo último guardado en el dispositivo. */
  async athleteState(): Promise<AthleteState> {
    try {
      const [l, a] = await Promise.all([
        this.c.from('coach_links').select('coach_id, coach_name, consent_at').eq('athlete_id', this.userId).maybeSingle(),
        this.c.from('assignments').select('program_id').eq('athlete_id', this.userId).maybeSingle()
      ]);
      const link = this.chk(l) as { coach_id: string; coach_name: string; consent_at: string } | null;
      const asg = this.chk(a) as { program_id: string } | null;
      let program: Program | null = null;
      if (asg) {
        const p = this.chk(await this.c.from('custom_programs').select('id, data').eq('id', asg.program_id).maybeSingle()) as { id: string; data: Program } | null;
        program = p ? programFromRow(p) : null;
      }
      const state: AthleteState = { link: link ? { coachId: link.coach_id, coachName: link.coach_name, since: link.consent_at } : null, program };
      try { localStorage.setItem(cacheKey(this.userId), JSON.stringify(state)); } catch { /* sin espacio */ }
      return state;
    } catch {
      // Sin conexión (o sin la migración aplicada): lo último guardado, o nada
      try {
        const cached = localStorage.getItem(cacheKey(this.userId));
        if (cached) return JSON.parse(cached) as AthleteState;
      } catch { /* caché dañada */ }
      return { link: null, program: null };
    }
  }

  async joinWithCode(code: string): Promise<CoachLink> {
    const clean = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (clean.length !== 8) throw new Error('El código tiene 8 letras o números.');
    const { data, error } = await this.c.rpc('redeem_invite', { p_code: clean });
    if (error) throw new Error(/válido|caducado|propio|sesión/.test(error.message) ? error.message : 'No se pudo usar el código. Inténtalo de nuevo.');
    const row = (data as { joined_coach_id: string; joined_coach_name: string }[])[0];
    return { coachId: row.joined_coach_id, coachName: row.joined_coach_name, since: new Date().toISOString() };
  }

  async leaveCoach(): Promise<void> {
    const { error } = await this.c.rpc('leave_coach');
    if (error) throw new Error('No se pudo dejar de compartir. Inténtalo de nuevo.');
    try { localStorage.removeItem(cacheKey(this.userId)); } catch { /* nada */ }
  }

  /* ---------- Entrenador ---------- */

  async coachInfo(): Promise<CoachInfo | null> {
    try {
      const r = this.chk(await this.c.from('coaches').select('display_name').eq('user_id', this.userId).maybeSingle()) as { display_name: string } | null;
      return r ? { displayName: r.display_name } : null;
    } catch {
      return null; // sin conexión o sin la migración: no es entrenador
    }
  }

  async listPrograms(): Promise<Program[]> {
    const rows = this.chk(await this.c.from('custom_programs').select('id, data, updated_at').eq('coach_id', this.userId).order('updated_at', { ascending: false })) as { id: string; data: Program }[];
    return rows.map(programFromRow);
  }

  async saveProgram(p: Program): Promise<Program> {
    const id = customUuid(p.id);
    const row = { id, coach_id: this.userId, data: { ...p, id: p.id }, updated_at: new Date().toISOString() };
    const saved = this.chk(await this.c.from('custom_programs').upsert(row).select('id, data').single()) as { id: string; data: Program };
    return programFromRow(saved);
  }

  async deleteProgram(id: string): Promise<void> {
    this.chk(await this.c.from('custom_programs').delete().eq('id', customUuid(id)).eq('coach_id', this.userId));
  }

  async createInvite(coachName: string): Promise<Invite> {
    const code = newInviteCode();
    const r = this.chk(await this.c.from('coach_invites').insert({ code, coach_id: this.userId, coach_name: coachName }).select('code, expires_at, used_at').single()) as { code: string; expires_at: string; used_at: string | null };
    return { code: r.code, expiresAt: r.expires_at, usedAt: r.used_at };
  }

  async listInvites(): Promise<Invite[]> {
    const rows = this.chk(await this.c.from('coach_invites').select('code, expires_at, used_at').eq('coach_id', this.userId).order('created_at', { ascending: false }).limit(20)) as { code: string; expires_at: string; used_at: string | null }[];
    return rows.map(r => ({ code: r.code, expiresAt: r.expires_at, usedAt: r.used_at }));
  }

  async deleteInvite(code: string): Promise<void> {
    this.chk(await this.c.from('coach_invites').delete().eq('code', code).eq('coach_id', this.userId));
  }

  async listAthletes(): Promise<AthleteRow[]> {
    const links = this.chk(await this.c.from('coach_links').select('athlete_id, consent_at').eq('coach_id', this.userId)) as { athlete_id: string; consent_at: string }[];
    if (!links.length) return [];
    const ids = links.map(l => l.athlete_id);
    const [p, a] = await Promise.all([
      this.c.from('profiles').select('user_id, name').in('user_id', ids),
      this.c.from('assignments').select('athlete_id, program_id').eq('coach_id', this.userId)
    ]);
    const names = new Map((this.chk(p) as { user_id: string; name: string }[]).map(r => [r.user_id, r.name]));
    const asg = new Map((this.chk(a) as { athlete_id: string; program_id: string }[]).map(r => [r.athlete_id, CUSTOM_PREFIX + r.program_id]));
    return links.map(l => ({ id: l.athlete_id, name: names.get(l.athlete_id) || 'Sin nombre', since: l.consent_at, programId: asg.get(l.athlete_id) || null }));
  }

  /** Datos del alumno en solo lectura (sin notas: son privadas). */
  async athleteData(athleteId: string): Promise<UserData> {
    const [p, w, s, b] = await Promise.all([
      this.c.from('profiles').select('*').eq('user_id', athleteId).maybeSingle(),
      this.c.from('workouts').select('*').eq('user_id', athleteId),
      this.c.from('workout_sets').select('*').eq('user_id', athleteId),
      this.c.from('body_weights').select('*').eq('user_id', athleteId)
    ]);
    const num = (v: unknown) => (v == null ? null : Number(v));
    return {
      profile: this.chk(p) as Profile | null,
      workouts: (this.chk(w) as Workout[]).map(x => ({ ...x, feel: x.feel || {}, notes: x.notes || '' })),
      sets: (this.chk(s) as WorkoutSet[]).map(x => ({ ...x, weight: num(x.weight), rir: num(x.rir), reps: Number(x.reps) })),
      notes: {},
      bodyWeights: (this.chk(b) as BodyWeight[]).map(x => ({ ...x, weight_kg: Number(x.weight_kg) }))
    };
  }

  async assign(athleteId: string, programId: string | null): Promise<void> {
    if (!programId) {
      this.chk(await this.c.from('assignments').delete().eq('athlete_id', athleteId).eq('coach_id', this.userId));
      return;
    }
    this.chk(await this.c.from('assignments').upsert({ athlete_id: athleteId, coach_id: this.userId, program_id: customUuid(programId), assigned_at: new Date().toISOString() }));
  }

  async removeAthlete(athleteId: string): Promise<void> {
    this.chk(await this.c.from('assignments').delete().eq('athlete_id', athleteId).eq('coach_id', this.userId));
    this.chk(await this.c.from('coach_links').delete().eq('athlete_id', athleteId).eq('coach_id', this.userId));
  }
}
