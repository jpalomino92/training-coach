/* ==========================================================
   UI Rendering + Workout Tracking + History + Progress
   Todo lo que depende de un programa sale de sus DATOS
   (js/data/routines.js). No hay código específico de ninguna rutina.
   ========================================================== */
(function () {
  'use strict';

  const { routinePrograms, PAIN_GUIDE, findExercise, findExerciseAnywhere } = window.RoutineData;
  const PG = window.Progression;
  const Poses = window.Poses;
  const root = document.getElementById('app');
  const DAY_MS = 86400000;

  const S = {
    auth: null, store: null, user: null, data: null,
    view: 'hoy', dayId: null,
    authMode: 'login', authError: '', busy: false,
    drafts: {}, editing: {}, openHist: {},
    editProfile: false, formError: '',
    timer: null, timerInt: null
  };

  /* ---------------- Utilidades ---------------- */
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtDate = iso => iso ? new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
  const fmtLong = iso => iso ? new Date(iso).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }) : '';
  const sameDay = (a, b) => { const x = new Date(a), y = new Date(b); return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate(); };
  const num = v => { if (v === '' || v == null) return null; const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? NaN : n; };
  const fmtKg = v => (v == null ? '—' : String(Math.round(v * 100) / 100).replace('.', ','));
  const restText = s => s <= 90 ? `${s} s` : (s % 60 ? `${Math.floor(s / 60)} min ${s % 60} s` : `${s / 60} min`);
  const rangeText = ex => `${ex.reps.min}${ex.reps.max !== ex.reps.min ? '-' + ex.reps.max : ''}${ex.unit === 's' ? ' s' : ''}`;
  const targetText = ex => `${ex.sets} × ${rangeText(ex)}${ex.perSide ? ' por lado' : ''}`;
  const repLabel = ex => ex.unit === 's' ? 'Segundos' : 'Reps';

  function toast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 3200);
  }
  async function guard(fn) {
    try { await fn(); } catch (e) { console.error(e); toast(e.message || 'Algo no ha funcionado. Inténtalo de nuevo.'); }
  }

  /* ---------------- Selectores de datos ---------------- */
  const program = () => routinePrograms[S.data.profile.routine_id] || Object.values(routinePrograms)[0];
  const dayById = id => program().days.find(d => d.id === id) || program().days[0];
  const byStartDesc = (a, b) => new Date(b.started_at) - new Date(a.started_at);
  const progWorkouts = () => S.data.workouts.filter(w => w.program_id === program().id);
  const setsOf = wid => S.data.sets.filter(s => s.workout_id === wid);

  function activeWorkout(dayId) {
    const list = progWorkouts().filter(w => w.day_id === dayId).sort(byStartDesc);
    return list.find(w => w.status === 'in_progress') ||
      list.find(w => w.status === 'completed' && w.completed_at && sameDay(w.completed_at, Date.now())) || null;
  }
  function lastSessionFor(key, excludeId) {
    const list = progWorkouts().filter(w => w.id !== excludeId).sort(byStartDesc);
    for (const w of list) {
      const sets = setsOf(w.id).filter(s => s.exercise_key === key).sort((a, b) => a.set_index - b.set_index);
      if (sets.length) return { w, sets };
    }
    return null;
  }
  function defaultDayId() {
    const p = program();
    const ws = progWorkouts();
    const inProg = ws.filter(w => w.status === 'in_progress').sort(byStartDesc)[0];
    if (inProg) return inProg.day_id;
    const done = ws.filter(w => w.status === 'completed' && w.completed_at).sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at))[0];
    if (!done) return p.days[0].id;
    if (sameDay(done.completed_at, Date.now())) return done.day_id;
    const i = p.days.findIndex(d => d.id === done.day_id);
    return p.days[(i + 1) % p.days.length].id;
  }
  function statusOf(w) {
    if (!w) return { icon: '○', text: 'No iniciado', cls: 'todo' };
    if (w.status === 'completed') return { icon: '✓', text: `Completado el ${fmtDate(w.completed_at)}`, cls: 'done' };
    return { icon: '◐', text: 'En progreso', cls: 'prog' };
  }
  function setDayColor(color) { document.documentElement.style.setProperty('--day', `var(--${color || 'ink'})`); }

  /* ---------------- Iconos ---------------- */
  const ICONS = {
    hoy: '<path d="M4 12h3l3-7 4 14 3-7h3"/>',
    rutina: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 9h8M8 13h8M8 17h5"/>',
    progreso: '<path d="M4 19V5M4 19h16M8 15l4-4 3 3 5-6"/>',
    historial: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
    perfil: '<circle cx="12" cy="9" r="4"/><path d="M4 20c1.5-4 4.5-5 8-5s6.5 1 8 5"/>'
  };
  const icon = k => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[k]}</svg>`;

  /* ==========================================================
     RENDER
     ========================================================== */
  function render() {
    if (!S.user) return renderAuth();
    if (!S.data.profile || S.editProfile) return renderProfileForm();
    renderMain();
  }

  /* ---------------- Autenticación ---------------- */
  function renderAuth() {
    setDayColor('red');
    const signup = S.authMode === 'signup';
    root.innerHTML = `
    <div class="auth">
      <div class="auth-plates" aria-hidden="true"><i style="background:var(--red)"></i><i style="background:var(--blue)"></i><i style="background:var(--yellow)"></i><i style="background:var(--green)"></i></div>
      <h1>${signup ? 'Crear cuenta' : 'Iniciar sesión'}</h1>
      <p class="sub">${signup ? 'Cada cuenta tiene su propia rutina, sus pesos y su historial.' : 'Entra para ver tu rutina de hoy y tu progreso.'}</p>
      ${S.auth.mode === 'demo' ? `<p class="note demo">Modo demo: las cuentas y los datos se guardan solo en este dispositivo. Usa una contraseña que no uses en otros sitios.</p>` : ''}
      <form data-form="${signup ? 'signup' : 'login'}" class="stack" novalidate>
        <label class="field">Email<input name="email" type="email" autocomplete="email" inputmode="email" required></label>
        <label class="field">Contraseña<input name="password" type="password" autocomplete="${signup ? 'new-password' : 'current-password'}" minlength="8" required></label>
        ${signup ? '<label class="field">Repite la contraseña<input name="password2" type="password" autocomplete="new-password" minlength="8" required></label>' : ''}
        ${S.authError ? `<p class="error" role="alert">${esc(S.authError)}</p>` : ''}
        <button class="btn primary" type="submit" ${S.busy ? 'disabled' : ''}>${S.busy ? 'Un momento…' : (signup ? 'Crear cuenta' : 'Iniciar sesión')}</button>
      </form>
      <button class="btn link" data-act="auth-toggle" type="button">${signup ? 'Ya tengo cuenta: iniciar sesión' : 'No tengo cuenta: crear cuenta'}</button>
    </div>`;
  }

  /* ---------------- Perfil (alta y edición) ---------------- */
  function renderProfileForm() {
    setDayColor('blue');
    const p = S.data.profile || {};
    const editing = !!S.data.profile;
    const progs = Object.values(routinePrograms);
    const sel = p.routine_id || '';
    const opt = (v, cur) => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(v)}</option>`;
    root.innerHTML = `
    <div class="auth wide">
      <h1>${editing ? 'Editar perfil' : 'Tu perfil'}</h1>
      <p class="sub">${editing ? 'Si cambias de rutina, tu historial anterior se conserva.' : 'Unos datos para asignarte la rutina correcta.'}</p>
      <form data-form="profile" class="stack" novalidate>
        <label class="field">Nombre<input name="name" required value="${esc(p.name)}" autocomplete="given-name"></label>
        <div class="row2">
          <label class="field">Edad<input name="age" type="number" inputmode="numeric" min="14" max="100" value="${esc(p.age)}"></label>
          <label class="field">Sexo<select name="sex">${['Mujer', 'Hombre', 'Otro', 'Prefiero no decirlo'].map(v => opt(v, p.sex || 'Mujer')).join('')}</select></label>
        </div>
        <label class="field">Objetivo<input name="goal" value="${esc(p.goal)}" placeholder="Ej.: ganar músculo mientras pierdo grasa"></label>
        <label class="field">Nivel de entrenamiento<select name="level">${['Principiante', 'Intermedio', 'Avanzado'].map(v => opt(v, p.level || 'Intermedio')).join('')}</select></label>
        <fieldset class="programs">
          <legend>Rutina asignada</legend>
          ${progs.map(pr => `
            <label class="prog-card">
              <input type="radio" name="routine_id" value="${pr.id}" ${pr.id === sel ? 'checked' : ''} required>
              <span class="prog-body">
                <b>${esc(pr.name)}</b>
                <span class="prog-meta">${esc(pr.audience)}, ${esc(pr.daysPerWeek)} días por semana, nivel ${esc(pr.level.toLowerCase())}</span>
                <span class="prog-desc">${esc(pr.description)}</span>
              </span>
            </label>
            ${pr.safety.requireAck ? `
            <div class="ack" data-ack-for="${pr.id}" ${pr.id === sel ? '' : 'hidden'}>
              ${pr.safety.warnings.map(w => `<p>${esc(w)}</p>`).join('')}
              <label class="chk"><input type="checkbox" name="ack_${pr.id}" ${p.safety_ack_at && p.routine_id === pr.id ? 'checked' : ''}> ${esc(pr.safety.ackText)}</label>
            </div>` : ''}`).join('')}
        </fieldset>
        ${S.formError ? `<p class="error" role="alert">${esc(S.formError)}</p>` : ''}
        <button class="btn primary" type="submit" ${S.busy ? 'disabled' : ''}>${editing ? 'Guardar cambios' : 'Empezar'}</button>
        ${editing ? '<button class="btn ghost" type="button" data-act="cancel-profile">Cancelar</button>' : '<button class="btn link" type="button" data-act="logout">Cerrar sesión</button>'}
      </form>
    </div>`;
  }

  /* ---------------- Estructura principal ---------------- */
  function renderMain() {
    if (!S.dayId || !program().days.some(d => d.id === S.dayId)) S.dayId = defaultDayId();
    const views = { hoy: viewToday, rutina: viewRoutine, progreso: viewProgress, historial: viewHistory, perfil: viewProfile };
    const labels = { hoy: 'Hoy', rutina: 'Rutina', progreso: 'Progreso', historial: 'Historial', perfil: 'Perfil' };
    setDayColor(S.view === 'hoy' ? dayById(S.dayId).color : 'ink');
    const body = (views[S.view] || viewToday)();
    root.innerHTML = `
    <div class="shell">
      <header class="top">
        <span class="brand">${esc(program().shortName)}</span>
        ${S.auth.mode === 'demo' ? '<span class="badge">Demo</span>' : ''}
      </header>
      <main class="view" id="view">${body}</main>
      <div id="timer" class="timer" ${S.timer ? '' : 'hidden'}></div>
      <nav class="tabs" aria-label="Secciones">
        ${Object.keys(labels).map(k => `<button type="button" data-act="nav" data-v="${k}" ${S.view === k ? 'aria-current="page"' : ''}>${icon(k)}<span>${labels[k]}</span></button>`).join('')}
      </nav>
    </div>`;
    tickTimer();
  }

  function safetyBanner(p, compact) {
    if (!p.safety.requireAck) return '';
    return `<aside class="warn-box" role="note">
      <b>Aviso de salud</b>
      ${p.safety.warnings.map(w => `<p>${esc(w)}</p>`).join('')}
      ${compact ? '' : `<ul>${(p.safety.rules || []).map(r => `<li>${esc(r)}</li>`).join('')}</ul>`}
    </aside>`;
  }

  /* ---------------- HOY ---------------- */
  function viewToday() {
    const p = program();
    const day = dayById(S.dayId);
    const w = activeWorkout(day.id);
    const st = statusOf(w);
    const doneCount = w ? setsOf(w.id).length : 0;
    const total = day.exercises.reduce((a, e) => a + e.sets, 0);
    return `
      <h1 class="hello">Hola, ${esc(S.data.profile.name)}</h1>
      ${safetyBanner(p, true)}
      <p class="section-label">Rutina de hoy</p>
      <div class="plates" role="group" aria-label="Elegir día">
        ${p.days.map(d => {
          const s = statusOf(activeWorkout(d.id));
          return `<button type="button" class="plate${d.optional ? ' opt' : ''}" style="background:var(--${d.color})" data-act="pick-day" data-day="${d.id}" aria-pressed="${d.id === day.id}" aria-label="${esc(d.name + ' ' + d.focus + ', ' + s.text)}"><span>${esc(d.id)}</span>${s.cls !== 'todo' ? `<em>${s.icon}</em>` : ''}</button>`;
        }).join('')}
      </div>
      <div class="dayhead">
        <h2>${esc(day.name)} — ${esc(day.focus)}</h2>
        <p class="status ${st.cls}"><span aria-hidden="true">${st.icon}</span> ${esc(st.text)}${w && w.status === 'in_progress' ? ` <span class="muted">${doneCount} de ${total} series</span>` : ''}</p>
      </div>
      <div class="ex-list">${day.exercises.map(ex => exCard(ex, day, w)).join('')}</div>
      ${w && w.status === 'in_progress' ? '<button class="btn primary block" type="button" data-act="finish">Terminar entrenamiento</button>' : ''}
      ${w && w.status === 'completed' ? `<p class="done-msg">✓ Entrenamiento completado el ${fmtDate(w.completed_at)}. Puedes seguir editando las series si lo necesitas.</p>` : ''}
    `;
  }

  function exCard(ex, day, w) {
    const p = program();
    const last = lastSessionFor(ex.key, w && w.id);
    const legacy = S.data.profile.legacy_weights && S.data.profile.legacy_weights[ex.key];
    const lastFeel = last && last.w.feel ? last.w.feel[ex.key] : undefined;
    const sug = PG.suggest(ex, last && last.sets, p, lastFeel);
    const sum = last && PG.summarize(last.sets);
    const cur = w ? setsOf(w.id).filter(s => s.exercise_key === ex.key) : [];
    const feel = w && w.feel ? w.feel[ex.key] : '';
    const note = S.data.notes[ex.key] ? S.data.notes[ex.key].note : '';
    const q = encodeURIComponent(ex.name + ' técnica correcta');

    const lastHtml = sum ? `
      <div class="last">
        <div class="last-h"><span>Última sesión</span><span>${fmtDate(last.w.completed_at || last.w.started_at)}</span></div>
        <div class="last-v"><b>${ex.unit === 's' || sum.topWeight <= 0 ? 'Sin carga' : fmtKg(sum.topWeight) + ' kg'}</b><span>${sum.reps.join(' / ')}${ex.unit === 's' ? ' s' : ''}</span><span>RIR final: ${sum.finalRir == null ? '—' : fmtKg(sum.finalRir)}</span></div>
      </div>` : (legacy ? `<div class="last"><div class="last-h"><span>Versión anterior de la app</span></div><div class="last-v"><b>${fmtKg(legacy)} kg</b></div></div>` : '');

    const rows = [];
    for (let i = 0; i < ex.sets; i++) {
      const saved = cur.find(s => s.set_index === i);
      const ek = `${ex.key}:${i}`;
      if (saved && !S.editing[ek]) {
        rows.push(`<div class="set done">
          <span class="set-n">Serie ${i + 1}</span>
          <span class="set-ok">✓ Serie registrada</span>
          <span class="set-val">${saved.weight ? fmtKg(saved.weight) + ' kg × ' : ''}${saved.reps}${ex.unit === 's' ? ' s' : ''}${saved.rir != null ? `, RIR ${fmtKg(saved.rir)}` : ''}</span>
          <button type="button" class="btn small ghost" data-act="edit-set" data-key="${ex.key}" data-i="${i}">Editar</button>
        </div>`);
      } else {
        const prevSet = last && last.sets.find(s => s.set_index === i);
        const prevToday = cur.filter(s => s.set_index < i).sort((a, b) => b.set_index - a.set_index)[0];
        const defW = saved ? saved.weight
          : prevToday && prevToday.weight != null ? prevToday.weight
          : prevSet && prevSet.weight != null ? prevSet.weight
          : sum && sum.topWeight > 0 ? sum.topWeight
          : (legacy || '');
        const id = s => `in-${ex.key}-${i}-${s}`;
        const val = (s, d) => esc(S.drafts[id(s)] != null ? S.drafts[id(s)] : (d == null ? '' : d));
        rows.push(`<div class="set">
          <div class="set-head"><span class="set-n">Serie ${i + 1}</span><span class="muted">Objetivo ${rangeText(ex)}${ex.perSide ? ' por lado' : ''}, RIR ${esc(ex.rir)}</span></div>
          <div class="set-inputs">
            <label>Peso (kg)<input id="${id('w')}" data-draft type="text" inputmode="decimal" value="${val('w', defW === '' ? '' : String(defW).replace('.', ','))}" placeholder="0"></label>
            <label>${repLabel(ex)}<input id="${id('r')}" data-draft type="number" inputmode="numeric" min="0" value="${val('r', saved && saved.reps)}" placeholder="${ex.reps.max}"></label>
            <label>RIR<input id="${id('q')}" data-draft type="text" inputmode="decimal" value="${val('q', saved && saved.rir != null ? String(saved.rir).replace('.', ',') : '')}" placeholder="${esc(String(ex.rir).split('-')[0])}"></label>
          </div>
          <div class="set-actions">
            <button type="button" class="btn primary" data-act="complete-set" data-key="${ex.key}" data-i="${i}">✓ Completar serie</button>
            ${saved ? `<button type="button" class="btn ghost small" data-act="cancel-edit" data-key="${ex.key}" data-i="${i}">Cancelar</button><button type="button" class="btn ghost small danger" data-act="delete-set" data-id="${saved.id}" data-key="${ex.key}" data-i="${i}">Borrar</button>` : ''}
          </div>
        </div>`);
      }
    }

    return `
    <article class="ex" id="ex-${ex.key}">
      <div class="ex-top">
        <div class="fig">${Poses.svg(ex.pose)}</div>
        <div class="ex-title">
          <h3>${esc(ex.name)}</h3>
          <div class="chips"><span class="chip strong">${targetText(ex)}</span><span class="chip">RIR ${esc(ex.rir)}</span><span class="chip">Descanso ${restText(ex.rest)}</span></div>
          <p class="muscle">${esc(ex.muscle)}</p>
        </div>
      </div>
      ${lastHtml}
      <p class="sug ${sug.level}">${esc(sug.text)}</p>
      ${feel === 'pain' ? `<p class="pain-alert" role="alert">${esc(PAIN_GUIDE.action)}</p>` : ''}
      <div class="sets">${rows.join('')}</div>
      <details class="more">
        <summary>Técnica, alternativa y notas</summary>
        <dl>
          <dt>Cómo hacerlo</dt><dd>${esc(ex.cue)}</dd>
          <dt>Músculo principal</dt><dd>${esc(ex.muscle)}</dd>
          <dt>Alternativa</dt><dd>${esc(ex.alt)}</dd>
          ${ex.warn ? `<dt>Precaución</dt><dd class="warn-text">${esc(ex.warn)}</dd>` : ''}
        </dl>
        <a class="vid" href="https://www.youtube.com/results?search_query=${q}" target="_blank" rel="noopener">Ver técnica en YouTube</a>
        <label class="field">¿Cómo lo sentiste hoy?
          <select data-act="feel" data-key="${ex.key}">
            <option value="" ${!feel ? 'selected' : ''}>Sin indicar</option>
            <option value="ok" ${feel === 'ok' ? 'selected' : ''}>Bien</option>
            <option value="muscle" ${feel === 'muscle' ? 'selected' : ''}>Molestia muscular normal</option>
            <option value="pain" ${feel === 'pain' ? 'selected' : ''}>Dolor articular o de espalda</option>
          </select>
        </label>
        <label class="field">Mis notas<textarea data-act="note" data-key="${ex.key}" rows="2" placeholder="Ej.: asiento en posición 4">${esc(note)}</textarea></label>
      </details>
    </article>`;
  }

  /* ---------------- RUTINA ---------------- */
  function viewRoutine() {
    const p = program();
    const dayOf = id => p.days.find(d => d.id === id);
    return `
      <h1>${esc(p.name)}</h1>
      <p class="lead">${esc(p.description)}</p>
      ${safetyBanner(p, false)}
      <section class="card">
        <h2>Semana tipo</h2>
        <div class="week">${p.weekPlan.map(([d, id]) => { const day = id && dayOf(id); return `<div class="${day ? 'on' : ''}" style="${day ? `background:var(--${day.color})` : ''}">${d}<b>${day ? esc(day.id) : '—'}</b></div>`; }).join('')}</div>
        <p class="small">Los días sin pesas son para cardio suave o descanso.</p>
      </section>
      ${p.days.map(d => `
        <section class="card day-card" style="--day:var(--${d.color})">
          <div class="day-card-h"><span class="dot" aria-hidden="true"></span><h2>${esc(d.name)} — ${esc(d.focus)}</h2></div>
          <ol class="plan">
            ${d.exercises.map(ex => `<li><span class="plan-name">${esc(ex.name)}</span><span class="plan-meta">${targetText(ex)}<br>RIR ${esc(ex.rir)}, descanso ${restText(ex.rest)}</span></li>`).join('')}
          </ol>
          <button class="btn primary" type="button" data-act="go-train" data-day="${d.id}">Entrenar este día</button>
        </section>`).join('')}
      <section class="card">
        <h2>Intensidad y progresión</h2>
        <p>${esc(p.intensity)}</p>
        <p>Doble progresión: cuando completes el máximo del rango en todas las series con al menos RIR ${p.progression.minRirToProgress}, la app te sugerirá subir ${esc(p.progression.step)}. El peso nunca cambia solo: tú decides.</p>
        <p class="small">RIR son las repeticiones que te quedan en reserva al terminar la serie. RIR 2 significa que podrías haber hecho 2 más con buena técnica.</p>
      </section>
      <section class="card">
        <h2>Molestia normal o dolor</h2>
        <p>${esc(PAIN_GUIDE.normal)}</p>
        <p class="warn-text">${esc(PAIN_GUIDE.stop)}</p>
        <p>${esc(PAIN_GUIDE.action)}</p>
      </section>
      <section class="card">
        <h2>Cardio</h2>
        <p>${esc(p.cardio)}</p>
      </section>
      ${(p.safety.warnings || []).length && !p.safety.requireAck ? `<section class="card"><h2>Precauciones</h2><ul>${p.safety.warnings.map(w => `<li>${esc(w)}</li>`).join('')}</ul></section>` : ''}
      <section class="card">
        <h2>Consejos</h2>
        <ul>${p.tips.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
      </section>`;
  }

  /* ---------------- PROGRESO ---------------- */
  function progressData() {
    const p = program();
    const start = new Date(S.data.profile.start_date || S.data.profile.created_at || Date.now());
    start.setHours(0, 0, 0, 0);
    const keys = [];
    p.days.forEach(d => d.exercises.forEach(e => { if (!keys.includes(e.key)) keys.push(e.key); }));
    const ws = progWorkouts().slice().sort((a, b) => new Date(a.started_at) - new Date(b.started_at));
    return keys.map(key => {
      const ex = findExercise(p, key);
      const sessions = [];
      ws.forEach(w => {
        const ss = setsOf(w.id).filter(s => s.exercise_key === key);
        if (!ss.length) return;
        const date = new Date(w.completed_at || w.started_at);
        sessions.push({
          date,
          week: Math.max(1, Math.floor((date - start) / (7 * DAY_MS)) + 1),
          top: Math.max(...ss.map(s => Number(s.weight) || 0)),
          best: Math.max(...ss.map(s => Number(s.reps) || 0))
        });
      });
      if (!sessions.length) return null;
      const loaded = ex.unit !== 's' && sessions.some(s => s.top > 0);
      const metric = s => loaded ? s.top : s.best;
      const weeks = {};
      sessions.forEach(s => { weeks[s.week] = Math.max(weeks[s.week] || 0, metric(s)); });
      return { ex, loaded, last: metric(sessions[sessions.length - 1]), max: Math.max(...sessions.map(metric)), weeks: Object.entries(weeks).map(([k, v]) => [Number(k), v]).sort((a, b) => a[0] - b[0]), series: sessions.map(metric) };
    }).filter(Boolean);
  }
  function sparkline(vals) {
    if (vals.length < 2) return '';
    const W = 120, H = 36, mn = Math.min(...vals), mx = Math.max(...vals), r = mx - mn || 1;
    const pts = vals.map((v, i) => `${(i / (vals.length - 1) * W).toFixed(1)},${(H - 4 - (v - mn) / r * (H - 8)).toFixed(1)}`).join(' ');
    return `<svg class="spark" viewBox="0 0 ${W} ${H}" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }
  function viewProgress() {
    const data = progressData();
    const completed = S.data.workouts.filter(w => w.status === 'completed').length;
    const start = S.data.profile.start_date;
    const weeks = start ? Math.max(1, Math.floor((Date.now() - new Date(start)) / (7 * DAY_MS)) + 1) : 1;
    const unit = d => d.loaded ? ' kg' : (d.ex.unit === 's' ? ' s' : ' reps');
    return `
      <h1>Progreso</h1>
      <div class="stats"><div><b>${completed}</b><span>entrenamientos completados</span></div><div><b>${weeks}</b><span>${weeks === 1 ? 'semana' : 'semanas'} desde que empezaste</span></div></div>
      ${data.length ? data.map(d => `
        <section class="card prog">
          <div class="prog-h"><h2>${esc(d.ex.name)}</h2>${sparkline(d.series)}</div>
          <div class="prog-nums">
            <div><span>${d.loaded ? 'Último peso' : 'Última marca'}</span><b>${fmtKg(d.last)}${unit(d)}</b></div>
            <div><span>${d.loaded ? 'Peso máximo registrado' : 'Mejor marca'}</span><b>${fmtKg(d.max)}${unit(d)}</b></div>
          </div>
          <p class="evo-h">Evolución</p>
          <ul class="evo">${d.weeks.slice(-8).map(([wk, v]) => `<li>Semana ${wk} → ${fmtKg(v)}${unit(d)}</li>`).join('')}</ul>
        </section>`).join('') : `
        <div class="empty"><p>Todavía no hay series registradas en esta rutina.</p><button class="btn primary" type="button" data-act="nav" data-v="hoy">Ir a la rutina de hoy</button></div>`}`;
  }

  /* ---------------- HISTORIAL ---------------- */
  function viewHistory() {
    const list = S.data.workouts.slice().sort(byStartDesc);
    if (!list.length) return `<h1>Historial</h1><div class="empty"><p>Aún no has registrado ningún entrenamiento.</p><button class="btn primary" type="button" data-act="nav" data-v="hoy">Empezar hoy</button></div>`;
    return `<h1>Historial</h1>${list.map(w => {
      const pr = routinePrograms[w.program_id];
      const day = pr && pr.days.find(d => d.id === w.day_id);
      const st = statusOf(w);
      const sets = setsOf(w.id);
      const open = !!S.openHist[w.id];
      const keys = [...new Set(sets.map(s => s.exercise_key))];
      return `<section class="card hist" style="--day:var(--${day ? day.color : 'ink'})">
        <button type="button" class="hist-h" data-act="toggle-hist" data-id="${w.id}" aria-expanded="${open}">
          <span class="dot" aria-hidden="true"></span>
          <span class="hist-t"><b>${esc(fmtLong(w.started_at))}</b><span>${esc(pr ? pr.shortName : w.program_id)}: ${esc(day ? day.name + ' — ' + day.focus : w.day_id)}</span></span>
          <span class="status ${st.cls}">${st.icon}</span>
        </button>
        ${open ? `<div class="hist-b">
          <p class="small">${esc(st.text)}. ${sets.length} ${sets.length === 1 ? 'serie' : 'series'} registradas.</p>
          ${keys.map(k => {
            const ex = (pr && findExercise(pr, k)) || findExerciseAnywhere(k) || { name: k, unit: 'reps' };
            const ss = sets.filter(s => s.exercise_key === k).sort((a, b) => a.set_index - b.set_index);
            return `<div class="hist-ex"><b>${esc(ex.name)}</b><ul>${ss.map(s => `<li>Serie ${s.set_index + 1}: ${s.weight ? fmtKg(s.weight) + ' kg × ' : ''}${s.reps}${ex.unit === 's' ? ' s' : ' reps'}${s.rir != null ? `, RIR ${fmtKg(s.rir)}` : ''}</li>`).join('')}</ul>${w.feel && w.feel[k] === 'pain' ? '<p class="warn-text small">Marcado con dolor articular o de espalda.</p>' : ''}</div>`;
          }).join('')}
          <button type="button" class="btn ghost small danger" data-act="delete-workout" data-id="${w.id}">Eliminar este entrenamiento</button>
        </div>` : ''}
      </section>`;
    }).join('')}`;
  }

  /* ---------------- PERFIL ---------------- */
  function viewProfile() {
    const p = S.data.profile, pr = program();
    const completed = S.data.workouts.filter(w => w.status === 'completed').length;
    const row = (k, v) => `<div><dt>${k}</dt><dd>${esc(v || '—')}</dd></div>`;
    return `
      <h1>${esc(p.name)}</h1>
      <dl class="profile">
        ${row('Objetivo', p.goal)}
        ${row('Rutina', pr.name)}
        ${row('Experiencia', p.level)}
        ${row('Edad', p.age ? p.age + ' años' : '')}
        ${row('Sexo', p.sex)}
        ${row('Entrenamientos completados', String(completed))}
        ${row('Fecha de inicio', fmtDate(p.start_date))}
        ${row('Email', S.user.email)}
      </dl>
      <div class="stack">
        <button class="btn primary" type="button" data-act="edit-profile">Editar perfil</button>
        <button class="btn ghost" type="button" data-act="export">Copiar mis datos</button>
        <button class="btn ghost danger" type="button" data-act="logout">Cerrar sesión</button>
      </div>
      ${S.auth.mode === 'demo' ? '<p class="note demo">Modo demo: tus datos se guardan solo en este navegador. Cerrar sesión no borra tu progreso, pero borrar los datos del navegador sí. Usa "Copiar mis datos" para tener una copia.</p>' : ''}`;
  }

  /* ==========================================================
     TEMPORIZADOR DE DESCANSO
     ========================================================== */
  function startTimer(sec, label) {
    S.timer = { end: Date.now() + sec * 1000, label };
    if (!S.timerInt) S.timerInt = setInterval(tickTimer, 500);
    tickTimer();
  }
  function stopTimer() {
    S.timer = null; clearInterval(S.timerInt); S.timerInt = null;
    const el = document.getElementById('timer'); if (el) el.hidden = true;
  }
  function tickTimer() {
    const el = document.getElementById('timer');
    if (!el || !S.timer) return;
    const left = Math.ceil((S.timer.end - Date.now()) / 1000);
    el.hidden = false;
    if (left <= 0) {
      if (!S.timer.rang) { S.timer.rang = true; if (navigator.vibrate) navigator.vibrate([200, 100, 200]); }
      el.innerHTML = `<span><b>Descanso terminado</b> ${esc(S.timer.label)}</span><button type="button" class="btn small" data-act="timer-skip">Cerrar</button>`;
      if (left < -6) stopTimer();
      return;
    }
    const m = Math.floor(left / 60), s = left % 60;
    el.innerHTML = `<span>Descanso <b>${m}:${String(s).padStart(2, '0')}</b></span><button type="button" class="btn small" data-act="timer-skip">Saltar</button>`;
  }

  /* ==========================================================
     ACCIONES
     ========================================================== */
  async function loadUser(user) {
    S.user = user;
    S.store = window.AppStorage.createStore(user, S.auth.client);
    S.data = await S.store.loadAll();
    S.view = 'hoy'; S.dayId = null; S.drafts = {}; S.editing = {}; S.openHist = {};
    render();
  }

  function readLegacyWeights() {
    const pr = routinePrograms.maleUpperLower;
    const out = {};
    try {
      pr.days.forEach(d => {
        const log = JSON.parse(localStorage.getItem('rtp:log:' + d.id) || 'null');
        if (!log) return;
        Object.entries(log).forEach(([i, v]) => {
          const ex = d.exercises[Number(i)];
          const kg = v && num(v.kg);
          if (ex && kg > 0) out[ex.key] = kg;
        });
      });
    } catch (e) { /* sin datos antiguos */ }
    return Object.keys(out).length ? out : null;
  }

  async function saveProfile(form) {
    const f = new FormData(form);
    const routine_id = f.get('routine_id');
    const name = String(f.get('name') || '').trim();
    if (!name) throw new Error('Escribe tu nombre.');
    if (!routine_id || !routinePrograms[routine_id]) throw new Error('Elige una rutina.');
    const pr = routinePrograms[routine_id];
    const prev = S.data.profile || {};
    if (pr.safety.requireAck && !f.get('ack_' + routine_id)) throw new Error('Para esta rutina tienes que marcar que has leído el aviso de salud.');
    const age = num(f.get('age'));
    const profile = {
      ...prev,
      name, age: age && !isNaN(age) ? Math.round(age) : null,
      sex: f.get('sex'), goal: String(f.get('goal') || '').trim(), level: f.get('level'),
      routine_id,
      safety_ack_at: pr.safety.requireAck ? (prev.routine_id === routine_id && prev.safety_ack_at ? prev.safety_ack_at : new Date().toISOString()) : prev.safety_ack_at || null,
      start_date: prev.start_date || new Date().toISOString().slice(0, 10),
      created_at: prev.created_at || new Date().toISOString()
    };
    if (routine_id === 'maleUpperLower' && !profile.legacy_weights) {
      const lw = readLegacyWeights(); if (lw) profile.legacy_weights = lw;
    }
    if (prev.routine_id && prev.routine_id !== routine_id) S.dayId = null;
    S.data.profile = await S.store.saveProfile(profile);
    S.editProfile = false; S.formError = ''; S.view = S.view || 'hoy';
  }

  async function ensureWorkout(dayId) {
    let w = activeWorkout(dayId);
    if (w) return w;
    w = await S.store.createWorkout({ program_id: program().id, day_id: dayId, status: 'in_progress', started_at: new Date().toISOString(), feel: {} });
    S.data.workouts.push(w);
    return w;
  }
  function replaceLocal(list, rec) {
    const i = list.findIndex(x => x.id === rec.id);
    if (i >= 0) list[i] = rec; else list.push(rec);
  }

  async function completeSet(key, i) {
    const day = dayById(S.dayId);
    const ex = day.exercises.find(e => e.key === key);
    if (!ex) return;
    const g = s => { const el = document.getElementById(`in-${key}-${i}-${s}`); return el ? el.value.trim() : ''; };
    const reps = parseInt(g('r'), 10);
    const weight = num(g('w'));
    const rir = num(g('q'));
    if (!(reps > 0)) { toast(ex.unit === 's' ? 'Escribe los segundos que aguantaste.' : 'Escribe las repeticiones que hiciste.'); const el = document.getElementById(`in-${key}-${i}-r`); if (el) el.focus(); return; }
    if (Number.isNaN(weight) || (weight !== null && weight < 0)) { toast('El peso tiene que ser un número, por ejemplo 12,5.'); return; }
    if (Number.isNaN(rir) || (rir !== null && (rir < 0 || rir > 10))) { toast('El RIR es un número entre 0 y 5.'); return; }

    const w = await ensureWorkout(day.id);
    const rec = await S.store.upsertSet({ workout_id: w.id, exercise_key: key, set_index: i, weight, reps, rir });
    replaceLocal(S.data.sets, rec);
    delete S.editing[`${key}:${i}`];
    ['w', 'r', 'q'].forEach(s => delete S.drafts[`in-${key}-${i}-${s}`]);

    const allDone = day.exercises.every(e => { const ss = setsOf(w.id).filter(s => s.exercise_key === e.key); for (let k = 0; k < e.sets; k++) if (!ss.some(s => s.set_index === k)) return false; return true; });
    if (allDone && w.status !== 'completed') {
      replaceLocal(S.data.workouts, await S.store.updateWorkout(w.id, { status: 'completed', completed_at: new Date().toISOString() }));
      stopTimer();
      render();
      toast('¡Entrenamiento completado!');
      return;
    }
    const isLastOfEx = setsOf(w.id).filter(s => s.exercise_key === key).length >= ex.sets;
    render();
    startTimer(ex.rest, isLastOfEx ? 'Pasa al siguiente ejercicio.' : `Siguiente: serie ${Math.min(i + 2, ex.sets)}.`);
  }

  async function onClick(e) {
    const b = e.target.closest('[data-act]');
    if (!b || b.tagName === 'SELECT' || b.tagName === 'TEXTAREA') return;
    const a = b.dataset.act;
    const key = b.dataset.key, i = b.dataset.i != null ? Number(b.dataset.i) : null;
    switch (a) {
      case 'nav': S.view = b.dataset.v; render(); window.scrollTo(0, 0); break;
      case 'auth-toggle': S.authMode = S.authMode === 'login' ? 'signup' : 'login'; S.authError = ''; render(); break;
      case 'pick-day': S.dayId = b.dataset.day; render(); break;
      case 'go-train': S.dayId = b.dataset.day; S.view = 'hoy'; render(); window.scrollTo(0, 0); break;
      case 'complete-set': await guard(() => completeSet(key, i)); break;
      case 'edit-set': {
        const w = activeWorkout(S.dayId);
        const s = w && setsOf(w.id).find(x => x.exercise_key === key && x.set_index === i);
        S.editing[`${key}:${i}`] = true;
        if (s) {
          S.drafts[`in-${key}-${i}-w`] = s.weight == null ? '' : String(s.weight).replace('.', ',');
          S.drafts[`in-${key}-${i}-r`] = String(s.reps);
          S.drafts[`in-${key}-${i}-q`] = s.rir == null ? '' : String(s.rir).replace('.', ',');
        }
        render(); break;
      }
      case 'cancel-edit': delete S.editing[`${key}:${i}`]; ['w', 'r', 'q'].forEach(s => delete S.drafts[`in-${key}-${i}-${s}`]); render(); break;
      case 'delete-set': await guard(async () => {
        await S.store.deleteSet(b.dataset.id);
        S.data.sets = S.data.sets.filter(s => s.id !== b.dataset.id);
        delete S.editing[`${key}:${i}`];
        const w = activeWorkout(S.dayId);
        if (w && w.status === 'completed') replaceLocal(S.data.workouts, await S.store.updateWorkout(w.id, { status: 'in_progress', completed_at: null }));
        render(); toast('Serie borrada.');
      }); break;
      case 'finish': await guard(async () => {
        const w = activeWorkout(S.dayId); if (!w) return;
        const day = dayById(S.dayId);
        const total = day.exercises.reduce((n, x) => n + x.sets, 0);
        if (setsOf(w.id).length < total && !confirm('Quedan series sin registrar. ¿Terminar el entrenamiento igualmente?')) return;
        replaceLocal(S.data.workouts, await S.store.updateWorkout(w.id, { status: 'completed', completed_at: new Date().toISOString() }));
        stopTimer(); render(); toast('Entrenamiento guardado.');
      }); break;
      case 'toggle-hist': S.openHist[b.dataset.id] = !S.openHist[b.dataset.id]; render(); break;
      case 'delete-workout': await guard(async () => {
        if (!confirm('¿Eliminar este entrenamiento y todas sus series? No se puede deshacer.')) return;
        await S.store.deleteWorkout(b.dataset.id);
        S.data.workouts = S.data.workouts.filter(w => w.id !== b.dataset.id);
        S.data.sets = S.data.sets.filter(s => s.workout_id !== b.dataset.id);
        render(); toast('Entrenamiento eliminado.');
      }); break;
      case 'edit-profile': S.editProfile = true; S.formError = ''; render(); window.scrollTo(0, 0); break;
      case 'cancel-profile': S.editProfile = false; S.formError = ''; render(); break;
      case 'export': await guard(async () => {
        const json = JSON.stringify({ exported_at: new Date().toISOString(), email: S.user.email, ...S.data }, null, 2);
        try { await navigator.clipboard.writeText(json); toast('Datos copiados. Pégalos en una nota o un email para guardarlos.'); }
        catch (err) { window.prompt('Copia tus datos:', json); }
      }); break;
      case 'logout': await guard(async () => {
        await S.auth.signOut(); stopTimer();
        Object.assign(S, { user: null, store: null, data: null, authMode: 'login', authError: '', editProfile: false, drafts: {}, editing: {} });
        render();
      }); break;
      case 'timer-skip': stopTimer(); break;
    }
  }

  async function onSubmit(e) {
    const form = e.target.closest('form[data-form]');
    if (!form) return;
    e.preventDefault();
    const type = form.dataset.form;
    if (S.busy) return;
    if (type === 'login' || type === 'signup') {
      const f = new FormData(form);
      const email = f.get('email'), pw = f.get('password');
      S.busy = true; S.authError = ''; render();
      try {
        if (type === 'signup' && pw !== f.get('password2')) throw new Error('Las contraseñas no coinciden.');
        const user = type === 'signup' ? await S.auth.signUp(email, pw) : await S.auth.signIn(email, pw);
        S.busy = false;
        await loadUser(user);
      } catch (err) {
        S.busy = false; S.authError = err.message; render();
        const el = root.querySelector('input[name="email"]'); if (el) el.value = email || '';
      }
      return;
    }
    if (type === 'profile') {
      S.busy = true;
      try { await saveProfile(form); S.busy = false; render(); window.scrollTo(0, 0); }
      catch (err) {
        S.busy = false; S.formError = err.message;
        const err_el = form.querySelector('.error');
        if (err_el) err_el.textContent = err.message;
        else { const p = document.createElement('p'); p.className = 'error'; p.setAttribute('role', 'alert'); p.textContent = err.message; form.querySelector('button[type="submit"]').before(p); }
      }
    }
  }

  async function onChange(e) {
    const t = e.target;
    if (t.name === 'routine_id') {
      root.querySelectorAll('[data-ack-for]').forEach(el => { el.hidden = el.dataset.ackFor !== t.value; });
      return;
    }
    if (t.dataset.act === 'feel') {
      await guard(async () => {
        const w = await ensureWorkout(S.dayId);
        const feel = { ...(w.feel || {}), [t.dataset.key]: t.value || undefined };
        if (!t.value) delete feel[t.dataset.key];
        replaceLocal(S.data.workouts, await S.store.updateWorkout(w.id, { feel }));
        if (t.value === 'pain') toast('Detén el ejercicio. Si el dolor continúa, consulta con un profesional sanitario.');
        render();
        const d = document.querySelector(`#ex-${t.dataset.key} details`); if (d) d.open = true;
      });
      return;
    }
    if (t.dataset.act === 'note') {
      await guard(async () => {
        S.data.notes[t.dataset.key] = await S.store.saveNote(t.dataset.key, t.value);
        toast('Nota guardada.');
      });
    }
  }

  function onInput(e) {
    const t = e.target;
    if (t.hasAttribute('data-draft')) S.drafts[t.id] = t.value;
  }

  /* ==========================================================
     ARRANQUE
     ========================================================== */
  function loadScript(src) {
    return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('No se pudo cargar ' + src)); document.head.appendChild(s); });
  }

  async function init() {
    root.addEventListener('click', onClick);
    root.addEventListener('submit', onSubmit);
    root.addEventListener('change', onChange);
    root.addEventListener('input', onInput);
    try {
      if (window.AppConfig.mode === 'supabase' && !window.supabase) await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js');
      S.auth = window.AppAuth.createAuth();
      const session = await S.auth.getSession();
      if (session) await loadUser(session); else render();
    } catch (e) {
      console.error(e);
      root.innerHTML = `<div class="auth"><h1>No se pudo iniciar</h1><p class="error">${esc(e.message)}</p></div>`;
    }
  }

  window.App = { init, _state: S };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
