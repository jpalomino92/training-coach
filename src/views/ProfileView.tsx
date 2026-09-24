/* PERFIL: datos, apariencia, peso corporal, descanso, ayudas durante el entrenamiento,
   importar/exportar CSV, contraseña, copiar mis datos y cerrar sesión. */
import { useEffect, useRef, useState } from 'react';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { Sheet } from '../components/Sheet';
import { RestStepper } from '../components/RestStepper';
import { SwitchRow } from '../components/Switch';
import { exportBodyWeightsCsv, exportSetsCsv } from '../domain/csv';
import { fmtDate, fmtDayMonth, localDate, toDate } from '../domain/format';
import type { Prefs, ThemePref } from '../domain/types';
import { downloadText } from '../services/download';
import { useApp } from '../state/AppContext';
import { ImportSheet } from './ImportSheet';
import { ChangePasswordSheet } from './PasswordSheets';

const wakeLockSupported = () => typeof navigator !== 'undefined' && 'wakeLock' in navigator;

/** Ajustes que se guardan al momento (los tiempos de descanso, medio segundo después del último toque). */
function useSettings() {
  const { prefs, updateSettings, showToast } = useApp();
  const [draft, setDraft] = useState<Prefs>(prefs);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pending = useRef<Partial<Prefs>>({});
  const flush = () => {
    clearTimeout(timer.current);
    const patch = pending.current;
    pending.current = {};
    if (Object.keys(patch).length) updateSettings(patch).catch(e => showToast(e instanceof Error ? e.message : 'No se pudo guardar.'));
  };
  const flushRef = useRef(flush);
  flushRef.current = flush;
  // Al salir de Perfil se guarda lo pendiente
  useEffect(() => () => flushRef.current(), []);
  /** Los cambios pendientes se acumulan y se guardan juntos. */
  const save = (patch: Partial<Prefs>, delay = 0) => {
    setDraft(d => ({ ...d, ...patch }));
    pending.current = { ...pending.current, ...patch };
    clearTimeout(timer.current);
    timer.current = setTimeout(() => flushRef.current(), delay);
  };
  return { draft, save };
}

const THEMES: { value: ThemePref; label: string }[] = [
  { value: 'auto', label: 'Automático' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' }
];

export function ProfileView() {
  const { profile, user, data, program, updatePrefs, setEditingProfile, signOut, showToast, mode } = useApp();
  const { draft, save } = useSettings();
  const [exportText, setExportText] = useState<string | null>(null);
  const [sheet, setSheet] = useState<'import' | 'password' | null>(null);
  const [busy, setBusy] = useState(false);
  if (!profile || !user) return null;
  const completed = data.workouts.filter(w => w.status === 'completed').length;

  const pref = async (patch: Parameters<typeof updatePrefs>[0]) => {
    try { await updatePrefs(patch); } catch (e) { showToast(e instanceof Error ? e.message : 'No se pudo guardar.'); }
  };

  const copy = async () => {
    const json = JSON.stringify({ exported_at: new Date().toISOString(), email: user.email, ...data }, null, 2);
    try {
      await navigator.clipboard.writeText(json);
      showToast('Datos copiados. Pégalos en una nota o un email para guardarlos.');
    } catch {
      setExportText(json);
    }
  };

  const logout = async () => {
    setBusy(true);
    try { await signOut(); } catch (e) { setBusy(false); showToast(e instanceof Error ? e.message : 'No se pudo cerrar la sesión.'); }
  };

  const rows: [string, string][] = [
    ['Edad', profile.age ? `${profile.age} años` : '—'],
    ['Sexo', profile.sex || '—'],
    ['Objetivo', profile.goal || '—'],
    ['Nivel', profile.level || '—'],
    ['Rutina', `${program.shortName} · ${program.daysPerWeek} días`]
  ];
  if (program.safety.requiresHealthNotice && profile.health_notice_ack_at) rows.push(['Aviso de salud', `Aceptado el ${fmtDate(profile.health_notice_ack_at)}`]);

  return (
    <main className="screen">
      <div className="who">
        <span className="avatar" aria-hidden="true">{profile.name.trim().charAt(0).toUpperCase()}</span>
        <div className="tx">
          <h1 className="h1">{profile.name}</h1>
          <span>{user.email}</span>
        </div>
      </div>

      <div className="tiles">
        <div className="card tile"><b>{completed}</b><span>{completed === 1 ? 'entrenamiento completado' : 'entrenamientos completados'}</span></div>
        <div className="card tile"><b>{fmtDayMonth(profile.start_date)}</b><span>fecha de inicio · {toDate(profile.start_date).getFullYear()}</span></div>
      </div>

      <section className="card card-pad" aria-labelledby="p-datos">
        <h2 className="eyebrow" id="p-datos">Tus datos</h2>
        <dl className="dl">{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      </section>

      <section className="card card-pad" aria-labelledby="p-apariencia">
        <h2 className="eyebrow" id="p-apariencia">Apariencia</h2>
        <div className="seg cols-3" role="group" aria-labelledby="p-apariencia">
          {THEMES.map(t => <button key={t.value} type="button" aria-pressed={profile.theme === t.value} onClick={() => pref({ theme: t.value })}>{t.label}</button>)}
        </div>
      </section>

      <section className="card">
        <SwitchRow eyebrow="Progreso" title="Mostrar peso corporal" checked={profile.show_body_weight}
          description="Si lo desactivas, Progreso muestra solo tus ejercicios. Tus registros se guardan."
          onChange={v => pref({ show_body_weight: v })} />
      </section>

      <section className="card" aria-labelledby="p-descanso">
        <div className="card-pad" style={{ paddingBottom: 0 }}><h2 className="eyebrow" id="p-descanso">Descanso</h2></div>
        <SwitchRow title="Usar los descansos de la rutina" checked={draft.rest_mode === 'routine'}
          description={draft.rest_mode === 'routine' ? 'Cada ejercicio usa el descanso que indica tu rutina.' : 'Usas tus propios tiempos. La rutina no cambia.'}
          onChange={v => save({ rest_mode: v ? 'routine' : 'custom' })} />
        {draft.rest_mode === 'custom' && (
          <div className="rest-custom">
            <RestStepper label="Ejercicios básicos" hint="Sentadilla, press, remos, peso muerto…" value={draft.rest_compound}
              onChange={v => save({ rest_compound: v }, 500)} />
            <RestStepper label="Accesorios" hint="Máquinas, aislamiento y core." value={draft.rest_accessory}
              onChange={v => save({ rest_accessory: v }, 500)} />
          </div>
        )}
      </section>

      <section className="card" aria-labelledby="p-entreno">
        <div className="card-pad" style={{ paddingBottom: 0 }}><h2 className="eyebrow" id="p-entreno">Durante el entrenamiento</h2></div>
        <SwitchRow title="Sonido al terminar el descanso" checked={draft.sound}
          description="Dos pitidos cortos, además de la vibración (en iPhone no hay vibración)." onChange={v => save({ sound: v })} />
        <SwitchRow title="Mantener la pantalla encendida" checked={draft.keep_awake && wakeLockSupported()}
          description={wakeLockSupported() ? 'Mientras tengas un entrenamiento en curso. Gasta algo más de batería.' : 'Tu navegador no lo permite.'}
          onChange={v => { if (wakeLockSupported()) save({ keep_awake: v }); }} />
      </section>

      <section className="card card-pad" aria-labelledby="p-datos-csv">
        <h2 className="eyebrow" id="p-datos-csv">Importar y exportar</h2>
        <Button variant="secondary" block icon="upload" onClick={() => setSheet('import')}>Importar CSV</Button>
        <div className="btn-row">
          <Button variant="secondary" small icon="download" onClick={() => downloadText(`peso-corporal-${localDate()}.csv`, exportBodyWeightsCsv(data))}>Peso (CSV)</Button>
          <Button variant="secondary" small icon="download" onClick={() => downloadText(`historial-${localDate()}.csv`, exportSetsCsv(data))}>Series (CSV)</Button>
        </div>
        <p className="hint">Importa tu historial de pesos (del peso corporal o de los ejercicios) desde otra app o una hoja de cálculo.</p>
      </section>

      <div className="stack-sm">
        <Button variant="secondary" block icon="pencil" onClick={() => setEditingProfile(true)}>Editar perfil</Button>
        <Button variant="secondary" block icon="key" onClick={() => setSheet('password')}>Cambiar contraseña</Button>
        <Button variant="secondary" block icon="copy" onClick={copy} aria-describedby="copy-hint">Copiar mis datos</Button>
        <p className="hint tc" id="copy-hint">Copia tu perfil e historial como texto para guardarlo donde quieras.</p>
        <Button variant="link" icon="logout" onClick={logout} loading={busy} style={{ alignSelf: 'center' }}>Cerrar sesión</Button>
      </div>

      {mode === 'demo' && (
        <div className="note demo-note"><Icon name="info" /><p><b>Modo demo.</b> Tus datos se guardan solo en este navegador. Cerrar sesión no borra tu progreso, pero borrar los datos del navegador sí. Usa "Copiar mis datos" para tener una copia.</p></div>
      )}

      {sheet === 'import' && <ImportSheet onClose={() => setSheet(null)} />}
      {sheet === 'password' && <ChangePasswordSheet onClose={() => setSheet(null)} />}

      {exportText !== null && (
        <Sheet title="Copiar mis datos" onClose={() => setExportText(null)} closeLabel="Cerrar">
          <p className="sm">No se pudo copiar automáticamente. Selecciona el texto y cópialo.</p>
          <textarea className="inp export-text" readOnly value={exportText} aria-label="Tus datos en formato texto" data-autofocus onFocus={e => e.currentTarget.select()} />
        </Sheet>
      )}
    </main>
  );
}
