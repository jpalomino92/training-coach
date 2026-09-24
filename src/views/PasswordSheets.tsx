/* Cambiar la contraseña desde Perfil (exige la actual). */
import { useState, type FormEvent } from 'react';
import { Button } from '../components/Button';
import { TextField } from '../components/Fields';
import { Icon } from '../components/Icon';
import { Sheet } from '../components/Sheet';
import { AuthError, MIN_PASSWORD } from '../services/auth/types';
import { useApp } from '../state/AppContext';

type Errors = Partial<Record<'current' | 'next' | 'repeat' | 'form', string>>;

function check(next: string, repeat: string): Errors {
  const e: Errors = {};
  if (next.length < MIN_PASSWORD) e.next = `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`;
  if (repeat !== next) e.repeat = 'Las contraseñas no coinciden.';
  return e;
}

export function ChangePasswordSheet({ onClose }: { onClose(): void }) {
  const { changePassword, showToast } = useApp();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs = { ...(current ? {} : { current: 'Escribe tu contraseña actual.' }), ...check(next, repeat) };
    setErrors(errs);
    if (Object.keys(errs).length || busy) return;
    setBusy(true);
    try {
      await changePassword(current, next);
      showToast('Contraseña cambiada.');
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo cambiar la contraseña.';
      setErrors(err instanceof AuthError && err.field === 'password' ? { current: msg } : { form: msg });
      setBusy(false);
    }
  };

  return (
    <Sheet title="Cambiar contraseña" onClose={onClose}>
      <form className="stack" onSubmit={submit} noValidate aria-label="Cambiar contraseña">
        {errors.form && <div className="alert" role="alert"><Icon name="alert" /><p>{errors.form}</p></div>}
        <TextField label="Contraseña actual" reveal autoComplete="current-password" value={current} onChange={e => setCurrent(e.target.value)} error={errors.current} data-autofocus />
        <TextField label="Contraseña nueva" reveal autoComplete="new-password" value={next} onChange={e => setNext(e.target.value)} error={errors.next} hint={errors.next ? undefined : `Mínimo ${MIN_PASSWORD} caracteres`} />
        <TextField label="Repite la contraseña nueva" type="password" autoComplete="new-password" value={repeat} onChange={e => setRepeat(e.target.value)} error={errors.repeat} />
        <Button variant="primary" block type="submit" loading={busy}>Guardar contraseña</Button>
      </form>
    </Sheet>
  );
}
