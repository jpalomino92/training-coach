/* Armazón: acceso → perfil inicial → las cinco pestañas.
   Navegación con estado simple (sin router): son 5 pestañas sin URLs profundas
   y el temporizador y los datos se comparten entre ellas. */
import { RestTimer } from './components/RestTimer';
import { SyncBanner } from './components/SyncBanner';
import { TabBar } from './components/TabBar';
import { Button } from './components/Button';
import { useDocumentTheme } from './hooks/useDocumentTheme';
import { AppProvider, useApp, useDay } from './state/AppContext';
import { TimerProvider } from './state/TimerContext';
import { AuthView } from './views/AuthView';
import { HistoryView } from './views/HistoryView';
import { OnboardingView } from './views/OnboardingView';
import { ProfileView } from './views/ProfileView';
import { ProgressView } from './views/ProgressView';
import { RoutineView } from './views/RoutineView';
import { TodayView } from './views/TodayView';
import type { Backend } from './services/backend';

function Toast() {
  const { toast } = useApp();
  return <div className="sr-only-live" role="status" aria-live="polite">{toast && <div className="toast">{toast}</div>}</div>;
}

function Main() {
  const { tab, setTab } = useApp();
  return (
    <>
      <TabBar current={tab} onSelect={setTab} />
      <div className="page">
        <SyncBanner />
        {tab === 'hoy' && <TodayView />}
        {tab === 'rutina' && <RoutineView />}
        {tab === 'progreso' && <ProgressView />}
        {tab === 'historial' && <HistoryView />}
        {tab === 'perfil' && <ProfileView />}
      </div>
      <RestTimer isToday={tab === 'hoy'} onOpen={() => setTab('hoy')} />
    </>
  );
}

function Screens() {
  const { status, bootError, profile, editingProfile } = useApp();
  const { day } = useDay();
  const inApp = status === 'ready' && !!profile && !editingProfile;
  // El color del día manda dentro de la app; en acceso y perfil inicial queda en azul
  useDocumentTheme(status === 'ready' && profile ? profile.theme : 'auto', inApp ? day.color : 'blue');
  if (status === 'loading') return <div className="boot" aria-busy="true"><span className="muted">Cargando…</span></div>;
  if (status === 'error') {
    return (
      <main className="boot">
        <h1 className="h2">No se pudo iniciar</h1>
        <p className="alert" role="alert">{bootError}</p>
        <Button variant="primary" onClick={() => location.reload()}>Reintentar</Button>
      </main>
    );
  }
  if (status === 'signedOut') return <AuthView />;
  if (!profile || editingProfile) return <OnboardingView />;
  return <Main />;
}

export function App({ backend }: { backend?: Backend }) {
  return (
    <AppProvider backend={backend}>
      <TimerProvider>
        <Screens />
        <Toast />
      </TimerProvider>
    </AppProvider>
  );
}
