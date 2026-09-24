/* Aviso de sincronización: solo aparece sin conexión o con cambios por enviar. */
import { useApp } from '../state/AppContext';
import { Icon } from './Icon';

export function SyncBanner() {
  const { sync } = useApp();
  if (!sync) return null; // modo demo: todo es local, no hay cola
  const n = sync?.pending || 0;
  const pending = `${n} ${n === 1 ? 'cambio pendiente' : 'cambios pendientes'}`;
  let text = '';
  if (!sync.online) text = n ? `Sin conexión · ${pending} de enviar. Se guardan en este dispositivo.` : 'Sin conexión. Lo que registres se guarda en este dispositivo.';
  else if (n) text = `Sincronizando · ${pending}…`;
  return (
    <div className="sync-live" role="status" aria-live="polite">
      {text && <p className={`sync${!sync.online ? ' off' : ''}`}><Icon name={!sync.online ? 'info' : 'clock'} />{text}</p>}
    </div>
  );
}
