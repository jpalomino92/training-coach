import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import { DemoAuth } from '../../src/services/auth/demoAuth';
import type { Backend } from '../../src/services/backend';
import type { RestPush } from '../../src/services/restPush';
import { LocalStore } from '../../src/services/storage/localStore';
import { TimerProvider, useTimer } from '../../src/state/TimerContext';

class FakePush implements RestPush {
  on = false;
  calls: (number | null)[] = [];
  supported() { return true; }
  async isOn() { return this.on; }
  async enable() { this.on = true; }
  async disable() { this.on = false; }
  schedule(at: number | null) { this.calls.push(at); }
}

const backend = (push?: RestPush): Backend => ({
  auth: new DemoAuth(localStorage, 1000), createStore: u => new LocalStore(u.id), ...(push ? { createRestPush: () => push } : {})
});

async function signUpAndOnboard(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Crear cuenta' }));
  await user.type(screen.getByLabelText('Email'), 'ana@correo.com');
  await user.type(screen.getByLabelText('Contraseña'), 'contraseña-larga');
  await user.type(screen.getByLabelText('Repite la contraseña'), 'contraseña-larga');
  await user.click(screen.getAllByRole('button', { name: 'Crear cuenta' }).at(-1)!);
  await user.type(await screen.findByLabelText('Nombre'), 'Ana');
  await user.click(screen.getByRole('button', { name: 'Continuar' }));
  await user.click(await screen.findByRole('button', { name: /Torso \/ Pierna/ }));
  await user.click(screen.getByRole('button', { name: 'Empezar' }));
}

describe('día a día', () => {
  it('Hoy: Rocky anima y recuerda qué llevar; se puede ocultar', async () => {
    const user = userEvent.setup();
    render(<App backend={backend()} />);
    await signUpAndOnboard(user);
    expect(await screen.findByText('¡Tu primer entrenamiento! Empieza por Pierna A.')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Rocky saca bíceps' })).toBeInTheDocument();
    const gear = screen.getByRole('region', { name: 'Para hoy, lleva' });
    expect(within(gear).getByText('Guantes o magnesio')).toBeInTheDocument();
    await user.click(within(gear).getByRole('button', { name: 'No mostrar más' }));
    expect(screen.queryByRole('region', { name: 'Para hoy, lleva' })).not.toBeInTheDocument();
  });

  it('cierra solo un entrenamiento que quedó abierto hace más de 4 horas', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App backend={backend()} />);
    await signUpAndOnboard(user);
    await screen.findByText(/Tu primer entrenamiento/);
    unmount();
    const userId = Object.keys(localStorage).find(k => k.startsWith('fuerza:v1:data:'))!.split(':').pop()!;
    const store = new LocalStore(userId);
    const started = new Date(Date.now() - 6 * 3600_000).toISOString();
    const w = await store.createWorkout({ program_id: 'maleUpperLower', day_id: 'PA', status: 'in_progress', started_at: started, feel: {} });

    render(<App backend={backend()} />);
    expect(await screen.findByText(/Cerramos el entrenamiento del .*: se quedó abierto\./)).toBeInTheDocument();
    const saved = (await new LocalStore(userId).loadAll()).workouts.find(x => x.id === w.id)!;
    expect(saved.status).toBe('completed');
  });

  it('Perfil: el aviso fuera de la app se activa en este teléfono', async () => {
    const user = userEvent.setup();
    const push = new FakePush();
    render(<App backend={backend(push)} />);
    await signUpAndOnboard(user);
    await user.click(await screen.findByRole('button', { name: /Perfil/ }));
    const sw = await screen.findByRole('switch', { name: /Aviso fuera de la app/ });
    expect(sw).not.toBeChecked();
    await user.click(sw);
    expect(push.on).toBe(true);
    expect(await screen.findByText('Listo: te avisaremos al terminar cada descanso.')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /Aviso fuera de la app/ })).toBeChecked();
  });
});

describe('temporizador y aviso push', () => {
  function Ctl() {
    const t = useTimer();
    return (
      <>
        <button onClick={() => t.start(90, 'Descanso', 'Toca: Remo · serie 2')}>start</button>
        <button onClick={() => t.addSeconds(15)}>add</button>
        <button onClick={() => t.stop()}>stop</button>
      </>
    );
  }

  it('programa el aviso al empezar, lo mueve al sumar tiempo y lo cancela al parar', async () => {
    const onAlarm = vi.fn();
    const user = userEvent.setup();
    render(<TimerProvider sound={false} onAlarm={onAlarm}><Ctl /></TimerProvider>);
    expect(onAlarm).not.toHaveBeenCalled();
    await user.click(screen.getByText('start'));
    const [at, title, body] = onAlarm.mock.calls[0];
    expect(at - Date.now()).toBeGreaterThan(85_000);
    expect([title, body]).toEqual(['¡Se acabó el descanso!', 'Toca: Remo · serie 2']);
    await user.click(screen.getByText('add'));
    expect(onAlarm.mock.calls[1][0]).toBe(at + 15_000);
    await user.click(screen.getByText('stop'));
    expect(onAlarm.mock.calls.at(-1)).toEqual([null]);
  });

  it('si la app está a la vista al final del descanso, lo cancela (ya avisa la app)', () => {
    vi.useFakeTimers();
    try {
      const onAlarm = vi.fn();
      let api: ReturnType<typeof useTimer> | null = null;
      function Grab() { api = useTimer(); return null; }
      render(<TimerProvider sound={false} onAlarm={onAlarm}><Grab /></TimerProvider>);
      act(() => api!.start(10, 'Descanso', 'Toca: Remo'));
      expect(onAlarm).toHaveBeenCalledTimes(1);
      act(() => { vi.advanceTimersByTime(7_500); });
      expect(onAlarm.mock.calls.at(-1)).toEqual([null]);
    } finally { vi.useRealTimers(); }
  });
});
