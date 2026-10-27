/* "Ver hoja original" de una rutina importada: la planilla como tabla,
   el texto pegado, las respuestas con que la IA la creó, o las fotos y
   el PDF (enlaces temporales del almacenamiento, o lo elegido en el
   dispositivo mientras se revisa una importación sin guardar). */
import { useEffect, useState } from 'react';
import { Icon } from '../components/Icon';
import { Sheet } from '../components/Sheet';
import type { ProgramSource } from '../domain/types';
import { blobFromDataUrl } from '../services/download';
import { useApp } from '../state/AppContext';

const URL_RE = /^https?:\/\/\S+$/i;

const KIND: Record<ProgramSource['kind'], string> = {
  sheet: 'Planilla', photos: 'Fotos', pdf: 'PDF', text: 'Texto pegado', generated: 'Tus respuestas a la IA'
};

export function SourceSheet({ source, previews, onClose }: { source: ProgramSource; previews?: string[]; onClose(): void }) {
  const { ownSourceUrls } = useApp();
  const stored = source.files || [];
  const [urls, setUrls] = useState<string[] | null>(previews ? null : stored.length ? null : []);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    const made: string[] = [];
    if (previews) {
      // Un PDF en data URL no se abre en otra pestaña: se pasa a un enlace del navegador
      setUrls(previews.map(d => {
        if (!d.startsWith('data:application/pdf')) return d;
        const u = URL.createObjectURL(blobFromDataUrl(d));
        made.push(u);
        return u;
      }));
    } else if (stored.length) {
      ownSourceUrls(stored).then(u => { if (live) setUrls(u); }).catch(e => { if (live) { setError(e instanceof Error ? e.message : 'No se pudieron abrir los archivos.'); setUrls([]); } });
    }
    return () => { live = false; made.forEach(u => URL.revokeObjectURL(u)); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previews, stored.join('|')]);

  const files = source.kind === 'photos' || source.kind === 'pdf';
  const date = new Date(source.at).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <Sheet title="Hoja original" onClose={onClose} closeLabel="Cerrar">
      <p className="sm muted">{KIND[source.kind]}{source.name ? ` · ${source.name}` : ''} · {date}</p>

      {source.sheets?.map(sh => (
        <section key={sh.name} className="stack-sm">
          {source.sheets!.length > 1 && <h3 className="eyebrow">{sh.name}</h3>}
          <div className="src-table" tabIndex={0} role="region" aria-label={`Hoja ${sh.name}`}>
            <table>
              <tbody>
                {sh.rows.map((r, i) => (
                  <tr key={i}>{r.map((c, j) => <td key={j}>{URL_RE.test(c) ? <a href={c} target="_blank" rel="noopener noreferrer">Vídeo</a> : c}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      {source.text && <pre className="src-text">{source.text}</pre>}

      {files && urls == null && <p className="hint" role="status">Cargando…</p>}
      {error && <div className="alert" role="alert"><Icon name="alert" /><p>{error}</p></div>}
      {files && urls?.length === 0 && !error && (
        <p className="sm muted">No se guardaron {source.kind === 'pdf' ? 'el PDF' : 'las fotos'} de esta rutina.</p>
      )}
      {source.kind === 'photos' && urls?.map((u, i) => (
        <a key={u} href={u} target="_blank" rel="noopener noreferrer" className="src-img">
          <img src={u} alt={`Foto ${i + 1} de la rutina`} loading="lazy" />
        </a>
      ))}
      {source.kind === 'pdf' && urls?.[0] && (
        <a className="btn btn-secondary btn-block" href={urls[0]} target="_blank" rel="noopener noreferrer">
          <Icon name="download" />Abrir el PDF<span className="sr-only"> (se abre en otra pestaña)</span>
        </a>
      )}
    </Sheet>
  );
}
