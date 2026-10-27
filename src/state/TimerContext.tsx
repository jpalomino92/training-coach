/* Temporizador de descanso. Se calcula con la hora de fin (Date.now) para que
   siga siendo correcto aunque se bloquee la pantalla. Al terminar vibra 200 ms
   y se cierra solo a los 5 s. `onAlarm` programa el aviso push para cuando la
   app no está a la vista (y lo cancela si lo está al terminar). */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { playRestEnd, primeAudio } from '../services/sound';

export interface TimerState {
  endAt: number;
  total: number;
  /** "Descanso · luego serie 3 de 4" */
  label: string;
  /** "Toca: Jalón al pecho · serie 3" */
  nextLabel: string;
}

interface TimerApi {
  timer: TimerState | null;
  /** Segundos restantes (0 si terminó). */
  left: number;
  finished: boolean;
  start(seconds: number, label: string, nextLabel: string): void;
  addSeconds(s: number): void;
  stop(): void;
}

const Ctx = createContext<TimerApi | null>(null);
export const AUTO_CLOSE_MS = 5000;

export function useTimer(): TimerApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTimer fuera de TimerProvider');
  return v;
}

export const vibrate = (ms: number) => { try { navigator.vibrate?.(ms); } catch { /* sin vibración */ } };

/** Antes del final, si la app está a la vista, se cancela el aviso push: ya avisa la app. */
const PUSH_CANCEL_MS = 3000;

export type RestAlarm = (endAt: number | null, title?: string, body?: string) => void;

export function TimerProvider({ children, sound = true, onAlarm }: { children: ReactNode; sound?: boolean; onAlarm?: RestAlarm }) {
  const [timer, setTimer] = useState<TimerState | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const rang = useRef(false);
  const soundRef = useRef(sound);
  soundRef.current = sound;
  const alarmRef = useRef(onAlarm);
  alarmRef.current = onAlarm;
  const timerRef = useRef(timer);
  timerRef.current = timer;
  const scheduled = useRef(false);

  // Aviso push: se programa con cada cambio del descanso y se cancela al pararlo
  const endAt = timer?.endAt ?? null;
  useEffect(() => {
    if (endAt == null) {
      if (scheduled.current) { scheduled.current = false; alarmRef.current?.(null); }
      return;
    }
    scheduled.current = true;
    alarmRef.current?.(endAt, '¡Se acabó el descanso!', timerRef.current?.nextLabel || 'Toca la siguiente serie.');
    const id = setTimeout(() => {
      if (document.visibilityState === 'visible') alarmRef.current?.(null);
    }, Math.max(0, endAt - PUSH_CANCEL_MS - Date.now()));
    return () => clearTimeout(id);
  }, [endAt]);

  // El audio solo se puede activar tras un toque: se desbloquea con el primero
  useEffect(() => {
    const unlock = () => primeAudio();
    document.addEventListener('pointerdown', unlock, { passive: true });
    return () => document.removeEventListener('pointerdown', unlock);
  }, []);

  useEffect(() => {
    if (!timer) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    const onVis = () => setNow(Date.now());
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVis); };
  }, [timer]);

  const finished = !!timer && now >= timer.endAt;

  useEffect(() => {
    if (!timer || !finished) return;
    if (!rang.current) { rang.current = true; vibrate(200); if (soundRef.current) playRestEnd(); }
    const id = setTimeout(() => setTimer(null), Math.max(0, timer.endAt + AUTO_CLOSE_MS - Date.now()));
    return () => clearTimeout(id);
  }, [timer, finished]);

  const start = useCallback((seconds: number, label: string, nextLabel: string) => {
    rang.current = false;
    const t = Date.now();
    setNow(t);
    setTimer({ endAt: t + seconds * 1000, total: seconds, label, nextLabel });
  }, []);

  const addSeconds = useCallback((s: number) => {
    setTimer(cur => {
      if (!cur) return cur;
      const base = Math.max(cur.endAt, Date.now());
      rang.current = false;
      return { ...cur, endAt: base + s * 1000, total: cur.total + s };
    });
  }, []);

  const stop = useCallback(() => setTimer(null), []);

  const left = timer ? Math.max(0, Math.ceil((timer.endAt - now) / 1000)) : 0;

  return <Ctx.Provider value={{ timer, left, finished, start, addSeconds, stop }}>{children}</Ctx.Provider>;
}
