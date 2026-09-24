/* Iniciar sesión y crear cuenta. Errores por campo con aria-invalid y
   error de envío con role="alert". */
import { useRef, useState, type FormEvent } from 'react';
import { Button } from '../components/Button';
import { TextField } from '../components/Fields';
import { Icon } from '../components/Icon';
import { BrandPlates } from '../components/TabBar';
import { APP_NAME } from '../config';
import { AuthError, isValidEmail, MIN_PASSWORD, normEmail } from '../services/auth/types';
import { useApp } from '../state/AppContext';

type Errors = Partial<Record<'email' | 'password' | 'password2' | 'form', string>>;

export function AuthView() {
  const { signIn, signUp, mode } = useApp();
  const [signup, setSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const pwRef = useRef<HTMLInputElement>(null);
  const pw2Ref = useRef<HTMLInputElement>(null);

  const switchMode = () => { setSignup(s => !s); setErrors({}); setPassword(''); setPassword2(''); };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const errs: Errors = {};
    const em = normEmail(email);
    if (signup) {
      if (!isValidEmail(em)) errs.email = 'Escribe un email válido, por ejemplo nombre@correo.com';
      if (password.length < MIN_PASSWORD) errs.password = `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`;
      if (password2 !== password) errs.password2 = 'Las contraseñas no coinciden.';
    } else {
      if (!em) errs.email = 'Escribe tu email.';
      if (!password) errs.password = 'Escribe tu contraseña.';
    }
    setErrors(errs);
    if (Object.keys(errs).length) {
      (errs.email ? emailRef : errs.password ? pwRef : pw2Ref).current?.focus();
      return;
    }
    setBusy(true);
    try {
      if (signup) await signUp(em, password); else await signIn(em, password);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Algo no ha funcionado. Inténtalo de nuevo.';
      const field = err instanceof AuthError ? err.field : undefined;
      setErrors(field ? { [field]: msg } : { form: msg });
      setBusy(false);
    }
  };

  return (
    <main className="auth">
      {signup ? (
        <button type="button" className="back" onClick={switchMode}><Icon name="chevL" />Iniciar sesión</button>
      ) : (
        <div className="stack-sm">
          <BrandPlates />
          <span className="eyebrow">{APP_NAME}</span>
        </div>
      )}
      <h1 className="h1">{signup ? 'Crear cuenta' : 'Iniciar sesión'}</h1>
      {signup && <p className="muted lead">Tu rutina, tus pesos y tu historial quedan guardados en tu cuenta.</p>}

      <form onSubmit={submit} noValidate aria-label={signup ? 'Crear cuenta' : 'Iniciar sesión'}>
        {errors.form && (
          <div className="alert" role="alert"><Icon name="alert" /><p>{errors.form}</p></div>
        )}
        <TextField ref={emailRef} label="Email" type="email" inputMode="email" autoComplete="email" placeholder="nombre@correo.com"
          value={email} onChange={e => setEmail(e.target.value)} error={errors.email} />
        <TextField ref={pwRef} label="Contraseña" reveal autoComplete={signup ? 'new-password' : 'current-password'}
          value={password} onChange={e => setPassword(e.target.value)} error={errors.password}
          hint={signup && !errors.password ? `Mínimo ${MIN_PASSWORD} caracteres` : undefined} />
        {signup && (
          <TextField ref={pw2Ref} label="Repite la contraseña" type="password" autoComplete="new-password"
            value={password2} onChange={e => setPassword2(e.target.value)} error={errors.password2} />
        )}
        <Button variant="primary" block type="submit" loading={busy}>{signup ? 'Crear cuenta' : 'Entrar'}</Button>
      </form>

      <p className="switch-mode">
        {signup ? '¿Ya tienes cuenta?' : '¿No tienes cuenta?'}
        <button type="button" className="btn btn-link" onClick={switchMode}>{signup ? 'Iniciar sesión' : 'Crear cuenta'}</button>
      </p>

      {mode === 'demo' && (
        <div className="note foot"><Icon name="info" /><p><b>Modo demo.</b> Los datos se guardan solo en este navegador y pueden perderse si lo borras. Usa una contraseña que no uses en otros sitios.</p></div>
      )}
    </main>
  );
}
