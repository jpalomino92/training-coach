import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import { SetEditor, validateSet } from '../../src/components/SetRow';
import { WeightStepper } from '../../src/components/WeightStepper';
import { DemoAuth } from '../../src/services/auth/demoAuth';
import type { Backend } from '../../src/services/backend';
import { LocalStore } from '../../src/services/storage/localStore';
import { ex } from './helpers';

const backend = (): Backend => ({ auth: new DemoAuth(localStorage, 1000), createStore: u => new LocalStore(u.id) });

function Stepper({ step, initial }: { step: number; initial: string }) {
  const [v, setV] = useState(initial);
  return <WeightStepper value={v} step={step} onChange={setV} />;
}

async function signUpAndOnboard(user: ReturnType<typeof userEvent.setup>, routine: RegExp, ack = false) {
  await user.click(await screen.findByRole('button', { name: 'Crear cuenta' }));
  await user.type(screen.getByLabelText('Email'), 'ana@correo.com');
  await user.type(screen.getByLabelText('Contraseña'), 'contraseña-larga');
  await user.type(screen.getByLabelText('Repite la contraseña'), 'contraseña-larga');
  await user.click(screen.getAllByRole('button', { name: 'Crear cuenta' }).at(-1)!);
  await user.type(await screen.findByLabelText('Nombre'), 'Ana');
  await user.click(screen.getByRole('button', { name: 'Continuar' }));
  await user.click(await screen.findByRole('button', { name: routine }));
  if (ack) await user.click(screen.getByRole('checkbox'));
}

describe('componentes', () => {
  it('validación de serie: reps 1–50, RIR 0–5, peso 0–500', () => {
    const e = ex();
    expect(validateSet(e, { weight: '40', reps: '', rir: '2' }).errors.reps).toMatch(/entre 1 y 50/);
    expect(validateSet(e, { weight: '40', reps: '51', rir: '2' }).errors.reps).toBeTruthy();
    expect(validateSet(e, { weight: '40', reps: '10', rir: '6' }).errors.rir).toMatch(/entre 0 y 5/);
    expect(validateSet(e, { weight: '501', reps: '10', rir: '2' }).errors.weight).toBeTruthy();
    expect(validateSet(e, { weight: '42,5', reps: '10', rir: '1,5' }).values).toEqual({ weight: 42.5, reps: 10, rir: 1.5 });
    expect(validateSet(e, { weight: '', reps: '10', rir: '' }).values).toEqual({ weight: null, reps: 10, rir: null });
  });

  it('SetEditor: muestra el error al pulsar Completar, enlazado con aria-invalid', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<SetEditor ex={ex()} index={0} mode="new" initial={{ weight: '40', reps: '', rir: '' }} onSubmit={onSubmit} />);
    await user.click(screen.getByRole('button', { name: /Completar serie/ }));
    const reps = screen.getByLabelText('Reps');
    expect(reps).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText(/Escribe cuántas repeticiones hiciste/)).toBeInTheDocument();
    expect(reps).toHaveFocus();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('SetEditor: sin peso ni reps el botón queda deshabilitado (enfocable) con el motivo', () => {
    render(<SetEditor ex={ex()} index={0} mode="new" initial={{ weight: '', reps: '', rir: '' }} onSubmit={vi.fn()} />);
    const btn = screen.getByRole('button', { name: /Completar serie/ });
    expect(btn).toHaveAttribute('aria-disabled', 'true');
    expect(btn).toHaveAccessibleDescription('Escribe el peso y las repeticiones');
  });

  it('WeightStepper: usa el paso del ejercicio y nunca baja de 0', async () => {
    const user = userEvent.setup();
    render(<Stepper step={2.5} initial="40" />);
    await user.click(screen.getByRole('button', { name: 'Sumar 2,5 kg' }));
    expect(screen.getByLabelText('Peso kg')).toHaveValue('42,5');
    render(<Stepper step={1} initial="0,5" />);
    await user.click(screen.getByRole('button', { name: 'Restar 1 kg' }));
    expect(screen.getAllByLabelText('Peso kg')[1]).toHaveValue('0');
  });

  it('perfil inicial: la rutina de 56 años exige marcar el aviso con su texto literal', async () => {
    const user = userEvent.setup();
    render(<App backend={backend()} />);
    await signUpAndOnboard(user, /Fuerza segura/);
    const start = screen.getByRole('button', { name: 'Empezar' });
    expect(start).toHaveAttribute('aria-disabled', 'true');
    expect(start).toHaveAccessibleDescription('Marca la casilla del aviso para continuar');
    expect(screen.getByText(/Debido al antecedente de cirugía de columna y artrosis/)).toBeInTheDocument();
    await user.click(start);
    expect(screen.getByRole('heading', { name: 'Elige tu rutina' })).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'He leído el aviso y revisaré esta rutina con mi médico o fisioterapeuta antes de empezar.' }));
    expect(start).not.toHaveAttribute('aria-disabled');
    await user.click(start);
    expect(await screen.findByRole('heading', { name: 'Hola, Ana' })).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Aviso de salud' })).toBeInTheDocument();
  });

  it('Hoy: completar una serie la registra, arranca el descanso y activa la siguiente', async () => {
    const user = userEvent.setup();
    render(<App backend={backend()} />);
    await signUpAndOnboard(user, /Torso \/ Pierna/);
    await user.click(screen.getByRole('button', { name: 'Empezar' }));
    const card = await screen.findByRole('article', { name: 'Sentadilla con barra' });
    await user.type(within(card).getByLabelText('Peso kg'), '80');
    await user.type(within(card).getByLabelText('Reps'), '8');
    await user.type(within(card).getByLabelText('RIR'), '2');
    await user.click(within(card).getByRole('button', { name: /Completar serie/ }));
    expect(await within(card).findByText('✓ Serie registrada')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Temporizador de descanso' })).toHaveTextContent('Descanso · luego serie 2 de 4');
    expect(within(card).getByRole('form', { name: 'Serie 2 de 4' })).toBeInTheDocument();
    // La siguiente serie llega rellenada con la anterior de hoy
    expect(within(card).getByLabelText('Peso kg')).toHaveValue('80');
    expect(screen.getByText(/En progreso · 1 de 23 series/)).toBeInTheDocument();
  });
});
