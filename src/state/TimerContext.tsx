/* Temporizador de descanso. Se calcula con la hora de fin (Date.now) para que
   siga siendo correcto aunque se bloquee la pantalla. Al terminar vibra 200 ms
   y se cierra solo a los 5 s. */
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

export function TimerProvider({ children, sound = true }: { children: ReactNode; sound?: boolean }) {
  const [timer, setTimer] = useState<TimerState | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const rang = useRef(false);
  const soundRef = useRef(sound);
  soundRef.current = sound;

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
