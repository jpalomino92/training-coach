/* Desplegable "Técnica, alternativa y notas": técnica (cue), alternativa y
   precaución de la rutina, vídeo, sensación y notas (se guardan solas). */
import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState } from 'react';
import type { Exercise, Feel } from '../domain/types';
import { FeelPicker } from './FeelPicker';
import { Icon } from './Icon';

export interface TechniquePanelHandle { showAlternative(): void }

interface Props {
  ex: Exercise;
  feel?: Feel;
  onFeel(v: Feel | null): void;
  note: string;
  onSaveNote(text: string): Promise<void>;
  showFeel: boolean;
}

export const TechniquePanel = forwardRef<TechniquePanelHandle, Props>(function TechniquePanel({ ex, feel, onFeel, note, onSaveNote, showFeel }, ref) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(note);
  const bodyId = useId(), feelId = useId(), noteId = useId(), altId = useId();
  const altRef = useRef<HTMLElement>(null);
  const saved = useRef(note);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useImperativeHandle(ref, () => ({
    showAlternative() {
      setOpen(true);
      requestAnimationFrame(() => { altRef.current?.focus(); altRef.current?.scrollIntoView({ block: 'center' }); });
    }
  }));

  const flush = (v: string) => {
    clearTimeout(timer.current);
    if (v === saved.current) return;
    saved.current = v;
    onSaveNote(v).catch(() => { saved.current = ''; });
  };
  useEffect(() => () => clearTimeout(timer.current), []);

  const q = encodeURIComponent(`${ex.name} técnica correcta`);
  return (
    <div className={`acc-wrap${open ? ' open' : ''}`}>
      <button type="button" className="acc" aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen(o => !o)}>
        Técnica, alternativa y notas
        <Icon name={open ? 'chevU' : 'chevD'} />
      </button>
      <div id={bodyId} className="acc-body" hidden={!open}>
        <dl>
          <div><dt className="eyebrow">Técnica</dt><dd>{ex.cue}</dd></div>
          <div><dt className="eyebrow" id={altId}>Alternativa</dt><dd ref={altRef} tabIndex={-1} aria-labelledby={altId}>{ex.alt}</dd></div>
          <div><dt className="eyebrow">Músculo principal</dt><dd>{ex.muscle}</dd></div>
        </dl>
        {ex.warn && (
          <div className="caution">
            <span className="eyebrow"><Icon name="alert" />Precaución</span>
            <p>{ex.warn}</p>
          </div>
        )}
        <a className="vid" href={`https://www.youtube.com/results?search_query=${q}`} target="_blank" rel="noopener noreferrer">
          <Icon name="play" />Ver vídeo de la técnica<span className="sr-only"> (se abre en otra pestaña)</span>
        </a>
        {showFeel && <FeelPicker id={feelId} value={feel} onChange={onFeel} />}
        <div className="field">
          <label htmlFor={noteId} className="eyebrow">Notas</label>
          <textarea id={noteId} className="inp" rows={3} value={text} placeholder="Ej.: asiento en posición 4"
            aria-describedby={`${noteId}-h`}
            onChange={e => { const v = e.target.value; setText(v); clearTimeout(timer.current); timer.current = setTimeout(() => flush(v), 800); }}
            onBlur={() => flush(text)} />
          <p id={`${noteId}-h`} className="note-hint">Se guarda sola. La verás la próxima vez.</p>
        </div>
      </div>
    </div>
  );
});
