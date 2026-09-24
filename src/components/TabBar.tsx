/* Menú inferior (barra superior desde 900 px). */
import { APP_NAME } from '../config';
import type { Tab } from '../state/AppContext';
import { Icon } from './Icon';

export const TABS: { id: Tab; label: string }[] = [
  { id: 'hoy', label: 'Hoy' },
  { id: 'rutina', label: 'Rutina' },
  { id: 'progreso', label: 'Progreso' },
  { id: 'historial', label: 'Historial' },
  { id: 'perfil', label: 'Perfil' }
];

export function BrandPlates({ colors = ['red', 'blue', 'yellow', 'green', 'black'] }: { colors?: string[] }) {
  return (
    <span className="brand" aria-hidden="true">
      {colors.map(c => <i key={c} className="p" style={{ background: `var(--${c})` }} />)}
    </span>
  );
}

export function TabBar({ current, onSelect }: { current: Tab; onSelect(t: Tab): void }) {
  return (
    <nav className="tabbar" aria-label="Secciones">
      <div className="in">
        <span className="brand"><span className="plates"><BrandPlates colors={['red', 'blue']} /></span>{APP_NAME}</span>
        <ul className="items">
          {TABS.map(t => (
            <li key={t.id} style={{ display: 'contents' }}>
              <button type="button" className="tab" aria-current={current === t.id ? 'page' : undefined} onClick={() => onSelect(t.id)}>
                <span className="pill"><Icon name={t.id} /></span>
                {t.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
