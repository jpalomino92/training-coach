/* ==========================================================
   Lector mínimo de Excel (.xlsx) sin dependencias: abre el ZIP,
   lee los textos compartidos y devuelve cada hoja como filas de
   texto. Solo valores (sin fórmulas ni formatos), suficiente para
   importar una rutina.
   ========================================================== */

export interface Sheet { name: string; rows: string[][] }

const td = new TextDecoder();

/** Archivos del ZIP por nombre (sin descomprimir todavía). */
function zipEntries(buf: ArrayBuffer): Map<string, () => Promise<Uint8Array>> {
  const v = new DataView(buf);
  const bytes = new Uint8Array(buf);
  // Fin del directorio central: se busca desde el final (puede llevar un comentario)
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 66_000); i--) {
    if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('El archivo no es un Excel válido (.xlsx).');
  const count = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const out = new Map<string, () => Promise<Uint8Array>>();
  for (let n = 0; n < count; n++) {
    if (v.getUint32(p, true) !== 0x02014b50) throw new Error('El archivo Excel está dañado.');
    const method = v.getUint16(p + 10, true);
    const size = v.getUint32(p + 20, true);
    const nameLen = v.getUint16(p + 28, true);
    const extraLen = v.getUint16(p + 30, true);
    const commentLen = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true);
    const name = td.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    const start = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
    const data = bytes.subarray(start, start + size);
    out.set(name, async () => {
      if (method === 0) return data;
      if (method !== 8) throw new Error('El archivo Excel usa una compresión no compatible.');
      const stream = new Response(data).body!.pipeThrough(new DecompressionStream('deflate-raw'));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

const xml = (text: string) => new DOMParser().parseFromString(text, 'application/xml');
const all = (node: Document | Element, tag: string) => [...node.getElementsByTagNameNS('*', tag)];
/** Texto de un <si> o <is>: puede venir partido en varios <t> (texto con formato). */
const textOf = (node: Element) => all(node, 't').map(t => t.textContent || '').join('');

/** Columna de una referencia de celda: "C12" → 2. */
function colIndex(ref: string): number {
  let n = 0;
  for (const ch of ref.replace(/\d+$/, '')) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function sheetRows(doc: Document, shared: string[]): string[][] {
  const rows: string[][] = [];
  for (const row of all(doc, 'row')) {
    const r = Number(row.getAttribute('r')) - 1;
    const cells: string[] = [];
    let next = 0;
    for (const c of all(row, 'c')) {
      const ref = c.getAttribute('r');
      const i = ref ? colIndex(ref) : next;
      next = i + 1;
      const t = c.getAttribute('t');
      const val = all(c, 'v')[0]?.textContent ?? '';
      const text = t === 's' ? shared[Number(val)] ?? '' : t === 'inlineStr' ? textOf(all(c, 'is')[0] || c) : t === 'b' ? (val === '1' ? 'VERDADERO' : 'FALSO') : val;
      cells[i] = text.trim();
    }
    rows[Number.isInteger(r) && r >= 0 ? r : rows.length] = Array.from(cells, c => c ?? '');
  }
  return Array.from(rows, r => r ?? []);
}

/** Hojas del libro en su orden, con sus filas como texto. */
export async function readXlsx(buf: ArrayBuffer): Promise<Sheet[]> {
  const files = zipEntries(buf);
  const read = async (name: string) => { const f = files.get(name); return f ? td.decode(await f()) : null; };
  const wb = await read('xl/workbook.xml');
  if (!wb) throw new Error('El archivo no es un Excel válido (.xlsx).');
  const rels = xml((await read('xl/_rels/workbook.xml.rels')) || '<Relationships/>');
  const target = new Map(all(rels, 'Relationship').map(r => [r.getAttribute('Id'), r.getAttribute('Target') || '']));
  const ssText = await read('xl/sharedStrings.xml');
  const shared = ssText ? all(xml(ssText), 'si').map(textOf) : [];
  const sheets: Sheet[] = [];
  for (const [i, s] of all(xml(wb), 'sheet').entries()) {
    const rid = [...s.attributes].find(a => a.localName === 'id' && a.prefix)?.value;
    const t = (rid && target.get(rid)) || `worksheets/sheet${i + 1}.xml`;
    const path = t.startsWith('/') ? t.slice(1) : `xl/${t}`;
    const text = await read(path);
    if (text) sheets.push({ name: s.getAttribute('name') || `Hoja ${i + 1}`, rows: sheetRows(xml(text), shared) });
  }
  return sheets;
}
