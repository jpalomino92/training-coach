import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import {
  blankProgram, defaultWeekPlan, duplicateProgram, exerciseFromDb, normalizeProgram, uniqueKey, validateProgram, type ExerciseDbItem
} from '../../src/domain/customProgram';
import { programList } from '../../src/domain/routines';
import type { Program } from '../../src/domain/types';
import { DemoAuth } from '../../src/services/auth/demoAuth';
import type { Backend } from '../../src/services/backend';
import type { AthleteState, CoachInfo, CoachService, Invite } from '../../src/services/coach';
import { LocalStore } from '../../src/services/storage/localStore';
import { ex } from './helpers';

const EDB: ExerciseDbItem = {
  exerciseId: 'abc123', name: 'dumbbell goblet squat', gifUrl: 'https://static.exercisedb.dev/media/abc123.gif',
  bodyParts: ['upper legs'], equipments: ['dumbbell'], targetMuscles: ['quads'], secondaryMuscles: ['glutes'],
  instructions: ['Step:1 Stand tall.', 'Step:2 Squat down.']
};

describe('rutinas propias', () => {
  it('una rutina nueva no se puede guardar sin ejercicios', () => {
    const issues = validateProgram(blankProgram('Laura'));
    expect(issues.map(i => i.message).join(' ')).toMatch(/añade al menos un ejercicio/);
  });

  it('duplicar una rutina incluida no cambia la original', () => {
    const original = programList()[0];
    const before = JSON.stringify(original);
    const copy = duplicateProgram(original, 'Laura');
    copy.days[0].exercises[0].name = 'Otro';
    expect(JSON.stringify(original)).toBe(before);
    expect(copy.id).toMatch(/^custom:/);
    expect(copy.custom).toBe(true);
    expect(validateProgram(copy)).toEqual([]);
  });

  it('valida series, rango, RIR, descanso y abreviaturas repetidas', () => {
    const p = duplicateProgram(programList()[0]);
    p.days[1].id = p.days[0].id;
    Object.assign(p.days[0].exercises[0], { sets: 0, reps: { min: 10, max: 8 }, rir: 'x', rest: 5 });
    const msgs = validateProgram(p).map(i => i.message).join(' | ');
    expect(msgs).toMatch(/entre 1 y 10 series/);
    expect(msgs).toMatch(/rango de repeticiones no es válido/);
    expect(msgs).toMatch(/RIR/);
    expect(msgs).toMatch(/descanso/);
    expect(msgs).toMatch(/repetida/);
  });

  it('el aviso de salud necesita texto y casilla', () => {
    const p = duplicateProgram(programList()[0]);
    p.safety = { requiresHealthNotice: true, warnings: [' '], ackText: '' };
    const paths = validateProgram(p).map(i => i.path);
    expect(paths).toContain('safety.warnings');
    expect(paths).toContain('safety.ackText');
  });

  it('ExerciseDB → ejercicio con GIF, instrucciones limpias y paso de mancuerna', () => {
    const e = exerciseFromDb(EDB);
    expect(e).toMatchObject({ key: 'edb_abc123', name: 'Dumbbell goblet squat', gifUrl: EDB.gifUrl, weightStep: 1, pose: 'squat', muscle: 'Cuádriceps', compound: false });
    expect(e.instructions).toEqual(['Stand tall.', 'Squat down.']);
  });

  it('claves únicas por día y plan semanal', () => {
    const day = { id: 'A', name: 'A', focus: '', color: 'red' as const, exercises: [ex({ key: 'x' }), ex({ key: 'x_2' })] };
    expect(uniqueKey('x', day)).toBe('x_3');
    const days = [1, 2, 3].map(n => ({ ...day, id: `D${n}` }));
    expect(defaultWeekPlan(days).map(([, id]) => id)).toEqual(['D1', null, 'D2', null, 'D3', null, null]);
  });

  it('normalizar respeta un plan válido aunque un día no tenga hueco', () => {
    const p = duplicateProgram(programList()[0]);
    const plan: [string, string | null][] = ['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((l, i) => [l, i === 0 ? p.days[0].id : null]);
    p.weekPlan = plan;
    expect(normalizeProgram(p).weekPlan).toEqual(plan);
    p.weekPlan = [['L', 'ZZZ']];
    expect(normalizeProgram(p).weekPlan).toHaveLength(7);
  });
});

/* ---------- Pantallas con un servicio de entrenador de prueba ---------- */

class FakeCoach {
  info: CoachInfo | null = null;
  state: AthleteState = { link: null, program: null };
  invitePrograms: Record<string, { coachName: string; program: Program | null }> = {};
  saved: Program[] = [];
  invites: Invite[] = [];
  async athleteState() { return this.state; }
  async coachInfo() { return this.info; }
  async joinWithCode(code: string) {
    const inv = this.invitePrograms[code];
    if (!inv) throw new Error('El código no es válido o ha caducado.');
    this.state = { link: { coachId: 'c1', coachName: inv.coachName, since: new Date().toISOString() }, program: inv.program };
    return this.state.link!;
  }
  async leaveCoach() { this.state = { link: null, program: null }; }
  async listAthletes() { return []; }
  async listPrograms() { return this.saved; }
  async listInvites() { return this.invites; }
  async saveProgram(p: Program) { this.saved = [p, ...this.saved.filter(x => x.id !== p.id)]; return p; }
  async createInvite() { const i = { code: 'K7M2Q9XA', expiresAt: new Date(Date.now() + 864e5).toISOString(), usedAt: null }; this.invites.push(i); return i; }
}

const backendWith = (fake: FakeCoach): Backend => ({
  auth: new DemoAuth(localStorage, 1000),
  createStore: u => new LocalStore(u.id),
  createCoach: () => fake as unknown as CoachService
});

async function signUpAndOnboard(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Crear cuenta' }));
  await user.type(screen.getByLabelText('Email'), 'ana@correo.com');
  await user.type(screen.getByLabelText('Contraseña'), 'contraseña-larga');
  await user.type(screen.getByLabelText('Repite la contraseña'), 'contraseña-larga');
  await user.click(screen.getAllByRole('button', { name: 'Crear cuenta' }).at(-1)!);
  await user.type(await screen.findByLabelText('Nombre'), 'Ana');
  await user.click(screen.getByRole('button', { name: 'Continuar' }));
  const normal = programList().find(p => !p.safety.requiresHealthNotice)!;
  await user.click(await screen.findByRole('button', { name: new RegExp(normal.shortName) }));
  await user.click(screen.getByRole('button', { name: 'Empezar' }));
  await screen.findByRole('heading', { name: 'Hola, Ana' });
}

afterEach(() => vi.unstubAllGlobals());

describe('entrenador y alumnos', () => {
  it('sin servicio de entrenador (modo demo) no aparece la sección', async () => {
    const user = userEvent.setup();
    render(<App backend={{ auth: new DemoAuth(localStorage, 1000), createStore: u => new LocalStore(u.id) }} />);
    await signUpAndOnboard(user);
    await user.click(screen.getByRole('button', { name: /Perfil/ }));
    expect(screen.queryByRole('heading', { name: 'Entrenador' })).not.toBeInTheDocument();
  });

  it('alumno: se une con código y consentimiento; la rutina asignada pide aceptar su aviso', async () => {
    const fake = new FakeCoach();
    const assigned = duplicateProgram(programList().find(p => !p.safety.requiresHealthNotice)!, 'Laura');
    assigned.shortName = 'Rodilla fuerte';
    assigned.safety = { requiresHealthNotice: true, warnings: ['Consulta con tu profesional sanitario antes de empezar.'], ackText: 'He leído el aviso.' };
    fake.invitePrograms.ABCD2345 = { coachName: 'Laura', program: assigned };
    const user = userEvent.setup();
    render(<App backend={backendWith(fake)} />);
    await signUpAndOnboard(user);

    await user.click(screen.getByRole('button', { name: /Perfil/ }));
    await user.click(await screen.findByRole('button', { name: 'Unirme con un código' }));
    const dialog = screen.getByRole('dialog', { name: 'Unirte a un entrenador' });
    await user.type(within(dialog).getByLabelText('Código de invitación'), 'abcd2345');
    const join = within(dialog).getByRole('button', { name: 'Unirme' });
    expect(join).toHaveAccessibleDescription('Marca la casilla para continuar');
    await user.click(within(dialog).getByRole('checkbox'));
    await user.click(join);

    expect(await screen.findByText(/ve tu progreso desde el/)).toBeInTheDocument();
    expect(screen.getByText('Laura')).toBeInTheDocument();
    expect(screen.getByText(/asignada por Laura/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Hoy/ }));
    expect(await screen.findByText(/Laura te ha asignado/)).toBeInTheDocument();
    const start = screen.getByRole('button', { name: 'Empezar' });
    expect(start).toHaveAttribute('aria-disabled', 'true');
    await user.click(screen.getByRole('checkbox', { name: 'He leído el aviso.' }));
    await user.click(start);
    expect(await screen.findByRole('group', { name: 'Elegir día' })).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Aviso de salud' })).toBeInTheDocument();
  });

  it('alumno: un código incorrecto muestra el error', async () => {
    const user = userEvent.setup();
    render(<App backend={backendWith(new FakeCoach())} />);
    await signUpAndOnboard(user);
    await user.click(screen.getByRole('button', { name: /Perfil/ }));
    await user.click(await screen.findByRole('button', { name: 'Unirme con un código' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Código de invitación'), 'ZZZZ9999');
    await user.click(within(dialog).getByRole('checkbox'));
    await user.click(within(dialog).getByRole('button', { name: 'Unirme' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('El código no es válido o ha caducado.');
  });

  it('entrenador: crea una rutina con un ejercicio de ExerciseDB y la guarda', async () => {
    const fake = new FakeCoach();
    fake.info = { displayName: 'Laura' };
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: [EDB], meta: { total: 1 } }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<App backend={backendWith(fake)} />);
    await signUpAndOnboard(user);

    await user.click(screen.getByRole('button', { name: /Perfil/ }));
    await user.click(await screen.findByRole('button', { name: 'Panel de entrenador' }));
    expect(await screen.findByRole('heading', { name: 'Laura' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Rutinas' }));
    await user.click(screen.getByRole('button', { name: 'Nueva rutina' }));

    // Sin ejercicios no se puede guardar
    await user.click(screen.getByRole('button', { name: 'Guardar rutina' }));
    expect(await screen.findByText(/Día 1: añade al menos un ejercicio/)).toBeInTheDocument();
    expect(fake.saved).toHaveLength(0);

    await user.clear(screen.getByLabelText('Nombre'));
    await user.type(screen.getByLabelText('Nombre'), 'Rodilla fuerte');
    await user.click(screen.getByRole('button', { name: 'Añadir ejercicio' }));
    const picker = screen.getByRole('dialog', { name: /Añadir a/ });
    await user.type(within(picker).getByLabelText('Buscar (en inglés)'), 'squat');
    await user.click(await within(picker).findByRole('button', { name: 'Añadir dumbbell goblet squat' }, { timeout: 3000 }));
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('name=squat'), expect.anything());

    const editor = await screen.findByRole('dialog', { name: 'Editar ejercicio' });
    await user.clear(within(editor).getByLabelText('Nombre'));
    await user.type(within(editor).getByLabelText('Nombre'), 'Sentadilla goblet');
    await user.click(within(editor).getByRole('button', { name: 'Guardar ejercicio' }));
    expect(screen.getByText('Sentadilla goblet')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Guardar rutina' }));
    expect(await screen.findByRole('list', { name: 'Tus rutinas' })).toBeInTheDocument();
    expect(fake.saved).toHaveLength(1);
    const p = fake.saved[0];
    expect(p).toMatchObject({ name: 'Rodilla fuerte', shortName: 'Rodilla fuerte', coachName: 'Laura', daysPerWeek: '1' });
    expect(p.days[0].exercises[0]).toMatchObject({ key: 'edb_abc123', name: 'Sentadilla goblet', gifUrl: EDB.gifUrl });
    expect(p.weekPlan).toHaveLength(7);
  });

  it('entrenador: crea un código de invitación', async () => {
    const fake = new FakeCoach();
    fake.info = { displayName: 'Laura' };
    const user = userEvent.setup();
    render(<App backend={backendWith(fake)} />);
    await signUpAndOnboard(user);
    await user.click(screen.getByRole('button', { name: /Perfil/ }));
    await user.click(await screen.findByRole('button', { name: 'Panel de entrenador' }));
    await user.click(await screen.findByRole('button', { name: 'Invitar' }));
    await user.click(screen.getByRole('button', { name: 'Crear código' }));
    expect(await screen.findByText('K7M2Q9XA', { selector: '.invite-code' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Compartir invitación' })).toBeInTheDocument();
  });
});
