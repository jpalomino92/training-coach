import { describe, expect, it } from 'vitest';
import { validateProgram } from '../../src/domain/customProgram';
import { parseCsv } from '../../src/domain/csv';
import { importAiRoutine, importRoutine, isToFailure, matchExercise, parseLoad, parseRest, parseRir, parseTarget, ROUTINE_TEMPLATE, type AiRoutine } from '../../src/domain/routineImport';
import { readXlsx } from '../../src/services/xlsx';

const csv = (text: string, name = 'rutina.csv') => importRoutine([{ name, rows: parseCsv(text) }], name);

describe('importar rutina: celdas', () => {
  it('entiende repeticiones, series y tiempos', () => {
    expect(parseTarget('8-12')).toEqual({ min: 8, max: 12, unit: 'reps' });
    expect(parseTarget('4x8-12')).toEqual({ sets: 4, min: 8, max: 12, unit: 'reps' });
    expect(parseTarget('3 × 10')).toEqual({ sets: 3, min: 10, max: 10, unit: 'reps' });
    expect(parseTarget('8 a 10 por lado')).toEqual({ min: 8, max: 10, unit: 'reps' });
    expect(parseTarget('30-45s')).toEqual({ min: 30, max: 45, unit: 's' });
    expect(parseTarget('45 seg')).toEqual({ min: 45, max: 45, unit: 's' });
    expect(parseTarget('20 min')).toEqual({ min: 20, max: 20, unit: 'min' });
    expect(parseTarget('3 series de 10')).toEqual({ sets: 3, min: 10, max: 10, unit: 'reps' });
    expect(parseTarget('12-10-8')).toEqual({ sets: 3, min: 8, max: 12, unit: 'reps' });
    expect(parseTarget('4x15/12/10/8')).toEqual({ sets: 4, min: 8, max: 15, unit: 'reps' });
    expect(parseTarget('10 c/u')).toEqual({ min: 10, max: 10, unit: 'reps' });
    expect(parseTarget('al fallo')).toBeNull();
    expect(isToFailure('Al fallo')).toBe(true);
    expect(isToFailure('AMRAP')).toBe(true);
    expect(isToFailure('10')).toBe(false);
  });

  it('pasa el RPE a RIR y acepta "al fallo"', () => {
    expect(parseRir('2')).toEqual({ rir: '2', fromRpe: false });
    expect(parseRir('1-2')).toEqual({ rir: '1-2', fromRpe: false });
    expect(parseRir('RIR 3')).toEqual({ rir: '3', fromRpe: false });
    expect(parseRir('RPE 8')).toEqual({ rir: '2', fromRpe: true });
    expect(parseRir('7-8')).toEqual({ rir: '2-3', fromRpe: true });
    expect(parseRir('8', true)).toEqual({ rir: '2', fromRpe: true });
    expect(parseRir('al fallo')).toEqual({ rir: '0', fromRpe: false });
    expect(parseRir('fuerte')).toBeNull();
  });

  it('lee el descanso en segundos o minutos', () => {
    expect(parseRest('90')).toBe(90);
    expect(parseRest('2')).toBe(120);
    expect(parseRest('2 min')).toBe(120);
    expect(parseRest("2'")).toBe(120);
    expect(parseRest('1:30')).toBe(90);
    expect(parseRest("1'30''")).toBe(90);
    expect(parseRest('1,5 min')).toBe(90);
    expect(parseRest("45''")).toBe(45);
    expect(parseRest('mucho')).toBeNull();
  });

  it('reconoce los ejercicios del catálogo con otros nombres', () => {
    expect(matchExercise('Press de banca')?.key).toBe('bench_press');
    expect(matchExercise('press banca')?.key).toBe('bench_press');
    expect(matchExercise('SENTADILLA CON BARRA')?.key).toBe('squat_bar');
    expect(matchExercise('Jalón al pecho')?.key).toBe('lat_pulldown');
    expect(matchExercise('Bench press')?.key).toBe('bench_press');
    expect(matchExercise('Remo Gironda')?.key).toBe('cable_row');
    expect(matchExercise('Flexión')).toBeNull();
    expect(matchExercise('Sentadilla sissy')).toBeNull();
  });
});

describe('importar rutina: planilla', () => {
  it('la plantilla se importa entera y se puede guardar', () => {
    const r = csv(ROUTINE_TEMPLATE, 'plantilla-rutina.csv');
    expect(r.errors).toEqual([]);
    const p = r.program!;
    expect(p.id).toMatch(/^own:/);
    expect(p.own).toBe(true);
    expect(p.name).toBe('Plantilla rutina');
    expect(p.days.map(d => [d.id, d.name, d.exercises.length])).toEqual([['D1', 'Día 1', 4], ['D2', 'Día 2', 4]]);
    expect(r.matched).toBe(r.total);
    const [squat, , curl, ext] = p.days[0].exercises;
    expect(squat).toMatchObject({ key: 'squat_bar', sets: 4, reps: { min: 6, max: 8 }, rest: 180, rir: '2' });
    expect(curl.group).toBeTruthy();
    expect(ext.group).toBe(curl.group);
    expect(p.days[1].exercises[3]).toMatchObject({ key: 'farmer_walk', unit: 's', reps: { min: 30, max: 40 } });
    expect(validateProgram(p)).toEqual([]);
  });

  it('acepta títulos arriba, celdas de día vacías, "4x10" en series y marca lo que no conoce', () => {
    const r = csv([
      'RUTINA DE JUAN;;;',
      'Día;Ejercicio;Series x reps;RPE;Pausa;Observaciones',
      'Lunes;Press banca;4x8-10;8;2 min;',
      ';Hack squat máquina;3x12;9;90;',
      ';Zancada lateral;3x10 por pierna;;;Controla la bajada',
      'Jueves;Peso muerto;5x5;;3;'
    ].join('\n'));
    expect(r.errors).toEqual([]);
    const p = r.program!;
    expect(p.days.map(d => d.name)).toEqual(['Lunes', 'Jueves']);
    expect(p.days.map(d => d.id)).toEqual(['L', 'J']);
    const [bench, hack, lunge] = p.days[0].exercises;
    expect(bench).toMatchObject({ key: 'bench_press', sets: 4, rir: '2', rest: 120 });
    expect(hack).toMatchObject({ key: 'own_hack_squat_maquina', rir: '1', pose: 'squat', compound: true });
    expect(lunge).toMatchObject({ perSide: true, cue: 'Controla la bajada', rir: '2', pose: 'lunge' });
    expect(r.review).toEqual(['own_hack_squat_maquina', 'own_zancada_lateral']);
    expect(r.notes.join(' ')).toMatch(/RPE se pasó a RIR/);
    expect(r.notes.join(' ')).toMatch(/2 ejercicios no están en el catálogo/);
    expect(p.days[1].exercises[0]).toMatchObject({ key: 'deadlift', sets: 5, rest: 180 });
  });

  it('un dato que no se entiende no descarta el ejercicio: pone un valor habitual y lo marca para revisar', () => {
    const r = csv('dia;ejercicio;series;reps;rir;descanso\n1;Press banca;3;muchas;2;\n1;Remo con barra;3-4;10;mucho;\n1;Curl martillo;3;al fallo;;un rato\n1;Fondos;tres;10;1;60');
    expect(r.errors).toEqual([]);
    const [bench, row, curl, dips] = r.program!.days[0].exercises;
    expect(bench).toMatchObject({ key: 'bench_press', reps: { min: 8, max: 12 }, rir: '2' });
    expect(row).toMatchObject({ key: 'row_bar', sets: 4 });
    expect(curl).toMatchObject({ key: 'hammer_curl', reps: { min: 8, max: 12 }, rir: '0' });
    expect(dips).toMatchObject({ key: 'dips', sets: 3, rest: 60 });
    expect(r.review).toEqual(['bench_press', 'row_bar', 'hammer_curl', 'dips']);
    expect(r.notes).toEqual(expect.arrayContaining([
      'Press banca (Día 1): no se entendieron las repeticiones ("muchas"): se puso 8-12.',
      'Remo con barra (Día 1): no se entendió el RIR ("mucho").',
      'Curl martillo (Día 1): "al fallo" no tiene número de repeticiones: se puso 8-12 y RIR 0; no se entendió el descanso ("un rato"): se usó el habitual.',
      'Fondos (Día 1): no se entendieron las series ("tres"): se pusieron 3.'
    ]));
    expect(r.notes.join(' ')).not.toMatch(/no están en el catálogo/);
  });

  it('sin columna "ejercicio" no importa nada', () => {
    const r = csv('nombre del día;cosa\n1;2');
    expect(r.program).toBeNull();
    expect(r.errors[0].message).toMatch(/columna "ejercicio"/);
  });

  it('sin columna de día, cada hoja es un día', () => {
    const r = importRoutine([
      { name: 'Empuje', rows: [['Ejercicio', 'Series', 'Reps'], ['Press banca', '3', '8']] },
      { name: 'Tirón', rows: [['Ejercicio', 'Series', 'Reps'], ['Remo con barra', '3', '8']] },
      { name: 'Notas', rows: [['Comer bien']] }
    ], 'ppl.xlsx');
    expect(r.program!.days.map(d => [d.id, d.name])).toEqual([['E', 'Empuje'], ['T', 'Tirón']]);
  });

  it('una marca de biserie suelta se ignora', () => {
    const r = csv('dia;ejercicio;series;reps;biserie\n1;Press banca;3;8;A\n1;Remo con barra;3;8;\n1;Curl martillo;3;12;A');
    expect(r.program!.days[0].exercises.every(e => !e.group)).toBe(true);
    expect(r.notes.join(' ')).toMatch(/2 marcas de biserie/);
  });
});

/* ---------- Excel ---------- */

const enc = new TextEncoder();

async function deflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Response(data as BodyInit).body!.pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** ZIP mínimo (sin CRC, que el lector no comprueba). */
async function zip(files: Record<string, string>): Promise<ArrayBuffer> {
  const parts: Uint8Array[] = [], central: Uint8Array[] = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const n = enc.encode(name), data = await deflate(enc.encode(text));
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); local.setUint16(8, 8, true);
    local.setUint32(18, data.length, true); local.setUint16(26, n.length, true);
    parts.push(new Uint8Array(local.buffer), n, data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(10, 8, true); c.setUint32(20, data.length, true);
    c.setUint16(28, n.length, true); c.setUint32(42, offset, true);
    central.push(new Uint8Array(c.buffer), n);
    offset += 30 + n.length + data.length;
  }
  const cdSize = central.reduce((s, p) => s + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(10, Object.keys(files).length, true);
  end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
  const all = [...parts, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(all.reduce((s, p) => s + p.length, 0));
  let at = 0;
  for (const p of all) { out.set(p, at); at += p.length; }
  return out.buffer;
}

const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

describe('leer Excel', () => {
  it('lee las hojas con textos compartidos, números y textos en línea', async () => {
    const buf = await zip({
      'xl/workbook.xml': `<workbook ${NS}><sheets><sheet name="Pierna" sheetId="1" r:id="rId1"/><sheet name="Torso" sheetId="2" r:id="rId2"/></sheets></workbook>`,
      'xl/_rels/workbook.xml.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="/xl/worksheets/sheet2.xml"/></Relationships>',
      'xl/sharedStrings.xml': `<sst ${NS}><si><t>Ejercicio</t></si><si><t>Reps</t></si><si><r><t>Sentadilla </t></r><r><t>con barra</t></r></si></sst>`,
      'xl/worksheets/sheet1.xml': `<worksheet ${NS}><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="s"><v>1</v></c></row><row r="3"><c r="A3" t="s"><v>2</v></c><c r="C3"><v>10</v></c></row></sheetData></worksheet>`,
      'xl/worksheets/sheet2.xml': `<worksheet ${NS}><sheetData><row r="1"><c r="B1" t="inlineStr"><is><t>Hola</t></is></c></row></sheetData></worksheet>`
    });
    const sheets = await readXlsx(buf);
    expect(sheets).toEqual([
      { name: 'Pierna', rows: [['Ejercicio', '', 'Reps'], [], ['Sentadilla con barra', '', '10']] },
      { name: 'Torso', rows: [['', 'Hola']] }
    ]);
  });

  it('un archivo que no es Excel da un error claro', async () => {
    await expect(readXlsx(enc.encode('hola').buffer as ArrayBuffer)).rejects.toThrow(/no es un Excel válido/);
  });
});

describe('importar rutina con IA', () => {
  const row = (over: Partial<AiRoutine['rows'][number]>) => ({ day: 'Día 1', exercise: '', sets: '3', reps: '10', rir: '', rest: '', group: '', notes: '', uncertain: false, ...over });

  it('usa el mismo importador que la planilla y marca lo dudoso', () => {
    const r = importAiRoutine({
      name: 'Rutina de Marta', description: 'Fuerza tres días.', precautions: ['No cargar peso sobre la columna.'], warnings: ['La última línea estaba tachada.'],
      rows: [
        row({ exercise: 'Press banca', sets: '4', reps: '8-10', rir: 'RPE 8', rest: '2 min' }),
        row({ exercise: 'Remo con barra', uncertain: true }),
        row({ exercise: 'Curl martillo', reps: 'muchas' }),
        row({ day: 'Día 2', exercise: 'Sentadilla búlgara', reps: '10', notes: 'por lado', group: 'A' }),
        row({ day: 'Día 2', exercise: 'Hip thrust', group: 'A' })
      ]
    });
    const p = r.program!;
    expect(p).toMatchObject({ name: 'Rutina de Marta', shortName: 'Rutina de Marta', description: 'Fuerza tres días.', own: true });
    expect(p.safety).toMatchObject({ requiresHealthNotice: false, warnings: ['No cargar peso sobre la columna.'] });
    expect(p.days[0].exercises.map(e => e.key)).toEqual(['bench_press', 'row_bar', 'hammer_curl']);
    expect(p.days[0].exercises[0]).toMatchObject({ rir: '2', rest: 120, sets: 4 });
    expect(p.days[1].exercises[0]).toMatchObject({ key: 'bulgarian_split', perSide: true });
    expect(p.days[1].exercises[0].group).toBe(p.days[1].exercises[1].group);
    expect(r.review).toEqual(['hammer_curl', 'row_bar']);
    expect(r.errors).toEqual([]);
    expect(r.notes).toContain('Curl martillo (Día 1): no se entendieron las repeticiones ("muchas"): se puso 8-12.');
    expect(r.notes[0]).toBe('La última línea estaba tachada.');
    expect(r.notes[1]).toMatch(/no estaba segura de 1 ejercicio/);
    expect(validateProgram(p)).toEqual([]);
  });
});

describe('importar rutina: peso inicial, vídeo y hoja original', () => {
  it('lee el peso en kilos, bloques, libras o peso corporal', () => {
    expect(parseLoad('')).toEqual({});
    expect(parseLoad('20')).toEqual({ weight: 20, load: 'kg' });
    expect(parseLoad('12,5 kg')).toEqual({ weight: 12.5, load: 'kg' });
    expect(parseLoad('4 bloques')).toEqual({ weight: 4, load: 'bloques' });
    expect(parseLoad('3 placas')).toEqual({ weight: 3, load: 'bloques' });
    expect(parseLoad('25 lb')).toEqual({ weight: 11.5, load: 'kg' });
    expect(parseLoad('20/22,5/25 kg')).toEqual({ weight: 20, load: 'kg' });
    expect(parseLoad('mancuernas de 2.5Kg')).toEqual({ weight: 2.5, load: 'kg' });
    expect(parseLoad('Peso corporal')).toEqual({ noWeight: true });
    expect(parseLoad('ligero')).toBeNull();
    expect(parseLoad('900')).toBeNull();
  });

  it('guarda el peso inicial, el vídeo (aunque su columna no tenga título) y una copia de la planilla', () => {
    const r = csv([
      'dia;ejercicio;series;reps;peso;;',
      'Día 1;Prensa;3;12;5 bloques;;https://youtube.com/shorts/abc',
      'Día 1;Press banca;3;8;40;;',
      'Día 1;Plancha;3;30s;peso corporal;;',
      'Día 1;Curl con mancuernas;3;10;un poco;;'
    ].join('\n'), 'Rutina de mamá.csv');
    const [press, bench, plank, curl] = r.program!.days[0].exercises;
    expect(press).toMatchObject({ key: 'leg_press', startWeight: 5, load: 'bloques', weightStep: 1, videoUrl: 'https://youtube.com/shorts/abc' });
    expect(bench).toMatchObject({ key: 'bench_press', startWeight: 40 });
    expect(bench.load).toBeUndefined();
    expect(plank).toMatchObject({ noWeight: true });
    expect(plank.startWeight).toBeUndefined();
    expect(curl.startWeight).toBeUndefined();
    expect(r.review).toContain(curl.key);
    expect(r.notes.join(' ')).toMatch(/2 ejercicios tienen peso inicial/);
    expect(r.notes.join(' ')).toMatch(/1 ejercicio tiene su vídeo/);
    expect(r.notes.join(' ')).toMatch(/no se entendió el peso \("un poco"\)/);
    const src = r.program!.source!;
    expect(src).toMatchObject({ kind: 'sheet', name: 'Rutina de mamá.csv' });
    expect(src.sheets![0].rows[1]).toEqual(['Día 1', 'Prensa', '3', '12', '5 bloques', '', 'https://youtube.com/shorts/abc']);
    expect(validateProgram(r.program!)).toEqual([]);
  });

  it('la IA también trae el peso y el vídeo, y el original queda en la rutina', () => {
    const r = importAiRoutine({
      name: 'Hoja', description: '', precautions: [], warnings: [],
      rows: [{ day: 'Día 1', exercise: 'Prensa', sets: '3', reps: '12', rir: '', rest: '', group: '', notes: '', weight: '4 bloques', video: 'https://youtu.be/x', uncertain: false }]
    }, { kind: 'photos', name: '2 fotos' });
    expect(r.program!.days[0].exercises[0]).toMatchObject({ startWeight: 4, load: 'bloques', videoUrl: 'https://youtu.be/x' });
    expect(r.program!.source).toMatchObject({ kind: 'photos', name: '2 fotos' });
    expect(r.program!.source!.sheets).toBeUndefined();
  });
});
