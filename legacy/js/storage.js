/* ==========================================================
   Storage
   Misma interfaz para los dos adaptadores:
     loadAll()                      → { profile, workouts, sets, notes }
     saveProfile(profile)
     createWorkout(w) / updateWorkout(id, patch) / deleteWorkout(id)
     upsertSet(set) / deleteSet(id)
     saveNote(exerciseKey, text)
   Todos los registros llevan user_id. El adaptador nunca lee ni
   escribe datos de otro usuario.
   ========================================================== */
(function () {
  'use strict';

  function uid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    const b = new Uint8Array(16);
    (window.crypto || {}).getRandomValues ? crypto.getRandomValues(b) : b.forEach((_, i) => { b[i] = Math.random() * 256 | 0; });
    b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
    const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }
  const nowIso = () => new Date().toISOString();

  /* ---------------- Adaptador local (modo demo) ---------------- */
  class LocalStore {
    constructor(userId) {
      if (!userId) throw new Error('Falta el usuario');
      this.userId = userId;
      this.key = 'rtp2:data:' + userId;
      this.d = null;
    }
    _read() {
      if (this.d) return this.d;
      let d = null;
      try { d = JSON.parse(localStorage.getItem(this.key)); } catch (e) { d = null; }
      this.d = d && typeof d === 'object' ? d : { profile: null, workouts: [], sets: [], notes: {} };
      this.d.workouts = this.d.workouts || []; this.d.sets = this.d.sets || []; this.d.notes = this.d.notes || {};
      return this.d;
    }
    _write() {
      try { localStorage.setItem(this.key, JSON.stringify(this.d)); }
      catch (e) { throw new Error('No se pudo guardar en este dispositivo. Libera espacio o revisa la configuración del navegador.'); }
    }
    _own(rec) { return rec && rec.user_id === this.userId; }

    async loadAll() {
      const d = this._read();
      return {
        profile: d.profile && this._own(d.profile) ? { ...d.profile } : null,
        workouts: d.workouts.filter(w => this._own(w)).map(w => ({ ...w })),
        sets: d.sets.filter(s => this._own(s)).map(s => ({ ...s })),
        notes: Object.fromEntries(Object.entries(d.notes).filter(([, n]) => this._own(n)).map(([k, n]) => [k, { ...n }]))
      };
    }
    async saveProfile(p) {
      const d = this._read();
      d.profile = { ...p, id: this.userId, user_id: this.userId, updated_at: nowIso() };
      this._write();
      return { ...d.profile };
    }
    async createWorkout(w) {
      const d = this._read();
      const rec = { id: uid(), feel: {}, notes: '', completed_at: null, ...w, user_id: this.userId, started_at: w.started_at || nowIso() };
      d.workouts.push(rec); this._write();
      return { ...rec };
    }
    async updateWorkout(id, patch) {
      const d = this._read();
      const w = d.workouts.find(x => x.id === id && this._own(x));
      if (!w) throw new Error('Entrenamiento no encontrado');
      Object.assign(w, patch, { id: w.id, user_id: this.userId });
      this._write();
      return { ...w };
    }
    async deleteWorkout(id) {
      const d = this._read();
      d.workouts = d.workouts.filter(x => !(x.id === id && this._own(x)));
      d.sets = d.sets.filter(s => !(s.workout_id === id && this._own(s)));
      this._write();
    }
    async upsertSet(s) {
      const d = this._read();
      const i = d.sets.findIndex(x => this._own(x) && x.workout_id === s.workout_id && x.exercise_key === s.exercise_key && x.set_index === s.set_index);
      const rec = { ...(i >= 0 ? d.sets[i] : { id: uid(), created_at: nowIso() }), ...s, user_id: this.userId, updated_at: nowIso() };
      if (i >= 0) d.sets[i] = rec; else d.sets.push(rec);
      this._write();
      return { ...rec };
    }
    async deleteSet(id) {
      const d = this._read();
      d.sets = d.sets.filter(x => !(x.id === id && this._own(x)));
      this._write();
    }
    async saveNote(exerciseKey, text) {
      const d = this._read();
      d.notes[exerciseKey] = { user_id: this.userId, exercise_key: exerciseKey, note: text, updated_at: nowIso() };
      this._write();
      return { ...d.notes[exerciseKey] };
    }
  }

  /* ---------------- Adaptador Supabase (producción) ----------------
     Requiere supabase/schema.sql aplicado. RLS garantiza en el servidor
     que cada usuario solo ve sus filas; aquí además filtramos por user_id. */
  class SupabaseStore {
    constructor(client, userId) { this.c = client; this.userId = userId; }
    _chk(res) { if (res.error) throw new Error(res.error.message); return res.data; }

    async loadAll() {
      const u = this.userId;
      const [p, w, s, n] = await Promise.all([
        this.c.from('profiles').select('*').eq('user_id', u).maybeSingle(),
        this.c.from('user_workouts').select('*').eq('user_id', u),
        this.c.from('workout_sets').select('*').eq('user_id', u),
        this.c.from('exercise_notes').select('*').eq('user_id', u)
      ]);
      const notes = {};
      (this._chk(n) || []).forEach(r => { notes[r.exercise_key] = r; });
      return { profile: this._chk(p), workouts: this._chk(w) || [], sets: (this._chk(s) || []).map(r => ({ ...r, weight: r.weight == null ? null : Number(r.weight), rir: r.rir == null ? null : Number(r.rir) })), notes };
    }
    async saveProfile(p) {
      const row = { ...p, id: this.userId, user_id: this.userId, updated_at: nowIso() };
      return this._chk(await this.c.from('profiles').upsert(row).select().single());
    }
    async createWorkout(w) {
      const row = { id: uid(), feel: {}, notes: '', completed_at: null, ...w, user_id: this.userId, started_at: w.started_at || nowIso() };
      return this._chk(await this.c.from('user_workouts').insert(row).select().single());
    }
    async updateWorkout(id, patch) {
      const clean = { ...patch }; delete clean.id; delete clean.user_id;
      return this._chk(await this.c.from('user_workouts').update(clean).eq('id', id).eq('user_id', this.userId).select().single());
    }
    async deleteWorkout(id) {
      this._chk(await this.c.from('workout_sets').delete().eq('workout_id', id).eq('user_id', this.userId));
      this._chk(await this.c.from('user_workouts').delete().eq('id', id).eq('user_id', this.userId));
    }
    async upsertSet(s) {
      const row = { id: s.id || uid(), ...s, user_id: this.userId, updated_at: nowIso() };
      return this._chk(await this.c.from('workout_sets').upsert(row, { onConflict: 'workout_id,exercise_key,set_index' }).select().single());
    }
    async deleteSet(id) {
      this._chk(await this.c.from('workout_sets').delete().eq('id', id).eq('user_id', this.userId));
    }
    async saveNote(exerciseKey, text) {
      const row = { user_id: this.userId, exercise_key: exerciseKey, note: text, updated_at: nowIso() };
      return this._chk(await this.c.from('exercise_notes').upsert(row, { onConflict: 'user_id,exercise_key' }).select().single());
    }
  }

  function createStore(user, supabaseClient) {
    if (window.AppConfig.mode === 'supabase') return new SupabaseStore(supabaseClient, user.id);
    return new LocalStore(user.id);
  }

  window.AppStorage = { createStore, LocalStore, SupabaseStore, uid };
})();
