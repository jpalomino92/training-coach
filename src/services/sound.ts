/* Aviso sonoro al terminar el descanso (Web Audio: sin archivos).
   Los navegadores solo dejan sonar audio después de un toque de la persona:
   el contexto se crea y se reanuda en el primer toque. */
type AudioCtx = AudioContext;
let ctx: AudioCtx | null = null;

function getCtx(): AudioCtx | null {
  if (ctx) return ctx;
  const C = (globalThis as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
    || (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!C) return null;
  try { ctx = new C(); } catch { ctx = null; }
  return ctx;
}

/** Llamar desde un gesto (toque) para desbloquear el audio. */
export function primeAudio() {
  const c = getCtx();
  if (c && c.state === 'suspended') void c.resume().catch(() => {});
}

/** Dos pitidos cortos. Silencioso si el navegador no permite audio. */
export function playRestEnd() {
  const c = getCtx();
  if (!c || c.state !== 'running') return;
  const t0 = c.currentTime + 0.02;
  [0, 0.28].forEach(offset => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, t0 + offset);
    gain.gain.exponentialRampToValueAtTime(0.35, t0 + offset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + offset + 0.18);
    osc.connect(gain).connect(c.destination);
    osc.start(t0 + offset);
    osc.stop(t0 + offset + 0.2);
  });
}
