import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { programList } from '../../src/domain/routines';
import { DemoAuth } from '../../src/services/auth/demoAuth';
import type { AiGenerateInput, AiImporter, AiImportInput } from '../../src/services/aiImport';
import { LocalOwnPrograms } from '../../src/services/ownPrograms';
import { LocalStore } from '../../src/services/storage/localStore';

async function signUpAndOnboard(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Crear cuenta' }));
  await user.type(screen.getByLabelText('Email'), 'eva@correo.com');
  await user.type(screen.getByLabelText('Contraseña'), 'contraseña-larga');
  await user.type(screen.getByLabelText('Repite la contraseña'), 'contraseña-larga');
  await user.click(screen.getAllByRole('button', { name: 'Crear cuenta' }).at(-1)!);
  await user.type(await screen.findByLabelText('Nombre'), 'Eva');
  await user.click(screen.getByRole('button', { name: 'Continuar' }));
  const normal = programList().find(p => !p.safety.requiresHealthNotice)!;
  await user.click(await screen.findByRole('button', { name: new RegExp(normal.shortName) }));
  await user.click(screen.getByRole('button', { name: 'Empezar' }));
  await screen.findByRole('heading', { name: 'Hola, Eva' });
  return normal;
}

const SHEET = 'dia;ejercicio;series;reps;rir;descanso\nDía 1;Press banca;4;6-8;2;3 min\nDía 1;Sentadilla sissy;3;10-12;1;60\nDía 2;Remo con barra;4;8-10;RPE 8;2 min\nDía 2;fila rota;3;muchas;2;60';

describe('rutinas propias de la persona', () => {
  it('importa una planilla, la revisa en el editor, la guarda y entrena con ella', async () => {
    const user = userEvent.setup();
    render(<App backend={{ auth: new DemoAuth(localStorage, 1000), createStore: u => new LocalStore(u.id) }} />);
    const normal = await signUpAndOnboard(user);

    await user.click(screen.getByRole('button', { name: /Rutina/ }));
    await user.click(await screen.findByRole('button', { name: 'Cambiar de rutina' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Importar rutina (Excel, foto o PDF)' }));
    const dialog = await screen.findByRole('dialog', { name: 'Importar rutina' });
    await user.upload(within(dialog).getByLabelText('Elige un archivo Excel o CSV'), new File([SHEET], 'Rutina de Eva.csv', { type: 'text/csv' }));
    expect(await within(dialog).findByText('Se leyeron 2 días y 4 ejercicios.')).toBeInTheDocument();
    expect(within(dialog).getByText('2 ejercicios quedan marcados para revisar.')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Revisar y guardar' }));

    expect(await screen.findByText('Rutina importada: revísala antes de guardar.')).toBeInTheDocument();
    expect(screen.getByText('fila rota (Día 2): no se entendieron las repeticiones ("muchas"): se puso 8-12.')).toBeInTheDocument();
    expect(screen.getAllByText('Revisar')).toHaveLength(2);
    expect(screen.getByLabelText('Nombre')).toHaveValue('Rutina de Eva');
    await user.click(screen.getByRole('button', { name: 'Guardar rutina' }));

    // Al guardarla pasa a ser la rutina activa
    expect(await screen.findByText('"Rutina de Eva" guardada. Ahora entrenas con ella.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Rutina de Eva' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: normal.shortName })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editar rutina' })).toBeInTheDocument();

    // La planilla original queda guardada con la rutina
    await user.click(screen.getByRole('button', { name: 'Ver hoja original' }));
    const original = await screen.findByRole('dialog', { name: 'Hoja original' });
    expect(within(original).getByText('Planilla · Rutina de Eva.csv', { exact: false })).toBeInTheDocument();
    expect(within(original).getByRole('cell', { name: 'Sentadilla sissy' })).toBeInTheDocument();
    await user.click(within(original).getByRole('button', { name: 'Cerrar' }));

    // Queda guardada para esta persona
    const userId = Object.keys(localStorage).find(k => k.startsWith('fuerza:v1:own:'))!.split(':').pop()!;
    const saved = await new LocalOwnPrograms(userId).list();
    expect(saved.map(p => p.name)).toEqual(['Rutina de Eva']);
    expect(saved[0].days[1].exercises[0]).toMatchObject({ key: 'row_bar', rir: '2', rest: 120 });
  });

  it('copia una rutina incluida y no deja eliminar la que se está usando', async () => {
    const user = userEvent.setup();
    render(<App backend={{ auth: new DemoAuth(localStorage, 1000), createStore: u => new LocalStore(u.id) }} />);
    const normal = await signUpAndOnboard(user);

    await user.click(screen.getByRole('button', { name: /Rutina/ }));
    await user.click(await screen.findByRole('button', { name: 'Cambiar de rutina' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: `Copiar ${normal.shortName} y editarla` }));
    expect(screen.getByLabelText('Nombre')).toHaveValue(`Copia de ${normal.name}`);
    await user.click(screen.getByRole('button', { name: 'Guardar rutina' }));
    const copy = `Copia de ${normal.shortName}`;
    expect(await screen.findByRole('heading', { name: copy })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cambiar de rutina' }));
    const picker = screen.getByRole('dialog');
    expect(within(within(picker).getByRole('group', { name: 'Mis rutinas' })).getByRole('button', { name: new RegExp(copy) })).toHaveAttribute('aria-pressed', 'true');
    expect(within(picker).getByRole('button', { name: 'Eliminar' })).toHaveAccessibleDescription('Es la rutina que estás usando: elige otra antes de eliminarla');

    // Vuelve a la incluida y entonces sí se puede eliminar la copia
    await user.click(within(within(picker).getByRole('group', { name: 'Rutinas incluidas' })).getByRole('button', { name: new RegExp(normal.shortName) }));
    await user.click(within(picker).getByRole('button', { name: `Cambiar a ${normal.shortName}` }));
    await user.click(await screen.findByRole('button', { name: 'Cambiar de rutina' }));
    const again = screen.getByRole('dialog');
    await user.click(within(again).getByRole('button', { name: new RegExp(copy) }));
    await user.click(within(again).getByRole('button', { name: 'Eliminar' }));
    await user.click(within(again).getAllByRole('button', { name: 'Eliminar' }).at(-1)!);
    expect(await screen.findByText(`"${copy}" eliminada. Tu historial se conserva.`)).toBeInTheDocument();
    expect(within(again).queryByRole('group', { name: 'Mis rutinas' })).not.toBeInTheDocument();
  });

  it('lee una rutina pegada como texto con IA y descuenta del límite mensual', async () => {
    const calls: AiImportInput[] = [];
    let left = 2;
    const fake: AiImporter = {
      async remaining() { return left; },
      async read(input) {
        calls.push(input);
        left--;
        return { remaining: left, routine: { name: 'Rutina del gimnasio', description: '', precautions: [], warnings: [], rows: [
          { day: 'Lunes', exercise: 'Press banca', sets: '4', reps: '8', rir: '', rest: '2 min', group: '', notes: '', uncertain: false },
          { day: 'Lunes', exercise: 'Remo con barra', sets: '4', reps: '8', rir: '', rest: '', group: '', notes: '', uncertain: true }
        ] } };
      },
      async generate() { throw new Error('No se usa en esta prueba.'); }
    };
    const user = userEvent.setup();
    render(<App backend={{ auth: new DemoAuth(localStorage, 1000), createStore: u => new LocalStore(u.id), createAiImporter: () => fake }} />);
    await signUpAndOnboard(user);
    await user.click(screen.getByRole('button', { name: /Rutina/ }));
    await user.click(await screen.findByRole('button', { name: 'Cambiar de rutina' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Importar rutina (Excel, foto o PDF)' }));
    const dialog = await screen.findByRole('dialog', { name: 'Importar rutina' });
    await user.click(within(dialog).getByRole('button', { name: 'Foto, PDF o texto' }));
    expect(await within(dialog).findByText('Te quedan 2 de 2 lecturas con IA este mes.')).toBeInTheDocument();
    const read = within(dialog).getByRole('button', { name: 'Leer con IA' });
    expect(read).toHaveAccessibleDescription('Sube fotos o un PDF, o pega el texto');
    await user.type(within(dialog).getByLabelText('O pega el texto de la rutina'), 'Lunes: press banca 4x8, remo 4x8');
    await user.click(read);
    expect(await within(dialog).findByText('Se leyeron 1 día y 2 ejercicios.')).toBeInTheDocument();
    expect(within(dialog).getByText('Te quedan 1 de 2 lecturas con IA este mes.')).toBeInTheDocument();
    expect(calls).toEqual([{ images: [], text: 'Lunes: press banca 4x8, remo 4x8' }]);
    await user.click(within(dialog).getByRole('button', { name: 'Revisar y guardar' }));
    expect(await screen.findByText(/La IA no estaba segura de 1 ejercicio/)).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre')).toHaveValue('Rutina del gimnasio');
    await user.click(screen.getByRole('button', { name: 'Guardar rutina' }));
    expect(await screen.findByRole('heading', { name: 'Rutina del gimnasio' })).toBeInTheDocument();
  });

  it('crea una rutina a medida con IA en el perfil inicial, la revisa y empieza con ella', async () => {
    const calls: AiGenerateInput[] = [];
    let left = 2;
    const fake: AiImporter = {
      async remaining() { return left; },
      async read() { throw new Error('No se usa en esta prueba.'); },
      async generate(input) {
        calls.push(input);
        left--;
        return { remaining: left, routine: { name: 'Fuerza en casa', description: '', precautions: ['Evita cargar la espalda baja.'], warnings: [], rows: [
          { day: 'Día A', exercise: 'Sentadilla goblet', sets: '3', reps: '10-12', rir: '2', rest: '90', group: '', notes: '', weight: '', video: '', uncertain: false },
          { day: 'Día B', exercise: 'Remo con mancuerna', sets: '3', reps: '10-12', rir: '2', rest: '90', group: '', notes: 'por lado', weight: '', video: '', uncertain: false }
        ] } };
      }
    };
    const user = userEvent.setup();
    render(<App backend={{ auth: new DemoAuth(localStorage, 1000), createStore: u => new LocalStore(u.id), createAiImporter: () => fake }} />);
    await user.click(await screen.findByRole('button', { name: 'Crear cuenta' }));
    await user.type(screen.getByLabelText('Email'), 'ana@correo.com');
    await user.type(screen.getByLabelText('Contraseña'), 'contraseña-larga');
    await user.type(screen.getByLabelText('Repite la contraseña'), 'contraseña-larga');
    await user.click(screen.getAllByRole('button', { name: 'Crear cuenta' }).at(-1)!);
    await user.type(await screen.findByLabelText('Nombre'), 'Ana');
    await user.type(screen.getByLabelText('Edad'), '62');
    await user.click(screen.getByRole('button', { name: 'Ganar fuerza' }));
    await user.click(screen.getByRole('button', { name: 'Mejorar postura y movilidad' }));
    await user.click(screen.getByRole('button', { name: 'Continuar' }));

    await user.click(await screen.findByRole('button', { name: /Crear una rutina a tu medida con IA/ }));
    expect(await screen.findByText('Te quedan 2 de 2 usos de IA este mes.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ganar fuerza' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(within(screen.getByRole('group', { name: 'Días por semana' })).getByRole('button', { name: '2' }));
    await user.click(screen.getByRole('button', { name: 'Casa con mancuernas' }));
    await user.type(screen.getByLabelText('Lesiones o limitaciones (opcional)'), 'Hernia lumbar');
    await user.click(screen.getByRole('button', { name: 'Crear mi rutina con IA' }));

    expect(await screen.findByText('Rutina importada: revísala antes de guardar.')).toBeInTheDocument();
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ age: 62, goals: ['Ganar fuerza', 'Mejorar postura y movilidad'], days: 2, minutes: 60, place: 'Casa con mancuernas', limitations: 'Hernia lumbar' });
    expect(calls[0].catalog).toContain('Abductor y aductor');
    expect(screen.getByLabelText('Nombre')).toHaveValue('Fuerza en casa');
    // Con lesiones pide aceptar las precauciones, y la progresión es prudente
    expect(screen.getByRole('switch', { name: /Pedir aceptar un aviso/ })).toBeChecked();
    expect(screen.getByRole('switch', { name: /Progresión prudente/ })).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Ver lo que le pediste a la IA' }));
    const asked = await screen.findByRole('dialog', { name: 'Hoja original' });
    expect(within(asked).getByText(/Lesiones o limitaciones: Hernia lumbar/)).toBeInTheDocument();
    await user.click(within(asked).getByRole('button', { name: 'Cerrar' }));
    await user.click(screen.getByRole('button', { name: 'Guardar rutina' }));

    expect(await screen.findByRole('heading', { name: 'Hola, Ana' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Rutina/ }));
    expect(await screen.findByRole('heading', { name: 'Fuerza en casa' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Perfil/ }));
    expect(await screen.findByText('Ganar fuerza, Mejorar postura y movilidad')).toBeInTheDocument();
  });

  it('en modo demo la lectura con IA explica que necesita cuenta en la nube', async () => {
    const user = userEvent.setup();
    render(<App backend={{ auth: new DemoAuth(localStorage, 1000), createStore: u => new LocalStore(u.id) }} />);
    await signUpAndOnboard(user);
    await user.click(screen.getByRole('button', { name: /Rutina/ }));
    await user.click(await screen.findByRole('button', { name: 'Cambiar de rutina' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Importar rutina (Excel, foto o PDF)' }));
    const dialog = await screen.findByRole('dialog', { name: 'Importar rutina' });
    await user.click(within(dialog).getByRole('button', { name: 'Foto, PDF o texto' }));
    expect(within(dialog).getByText('Leer con IA necesita una cuenta en la nube')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Leer con IA' })).toHaveAccessibleDescription('Necesita una cuenta en la nube');
  });
});
