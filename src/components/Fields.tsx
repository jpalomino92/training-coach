/* Campos de formulario: texto (56 px) y numérico (64 px), con errores enlazados. */
import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { Icon } from './Icon';

export function FieldError({ id, children }: { id: string; children?: ReactNode }) {
  if (!children) return null;
  return <p id={id} className="err"><Icon name="alert" />{children}</p>;
}

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label: ReactNode;
  error?: string;
  hint?: string;
  narrow?: boolean;
  /** Añade el botón "Mostrar" / "Ocultar" para contraseñas. */
  reveal?: boolean;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, error, hint, narrow, reveal, type = 'text', className, id: idIn, ...rest }, ref
) {
  const auto = useId();
  const id = idIn || auto;
  const [shown, setShown] = useState(false);
  const described = [error ? `${id}-err` : '', hint ? `${id}-hint` : ''].filter(Boolean).join(' ') || undefined;
  const input = (
    <input
      ref={ref} id={id} className={['inp', narrow ? 'narrow' : '', className || ''].filter(Boolean).join(' ')}
      type={reveal ? (shown ? 'text' : 'password') : type}
      aria-invalid={error ? true : undefined} aria-describedby={described}
      {...rest}
    />
  );
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {reveal ? (
        <div className="pw">
          {input}
          <button type="button" className="btn btn-link" aria-pressed={shown} aria-controls={id} onClick={() => setShown(s => !s)}>
            {shown ? 'Ocultar' : 'Mostrar'}
          </button>
        </div>
      ) : input}
      <FieldError id={`${id}-err`}>{error}</FieldError>
      {hint && <p id={`${id}-hint`} className="hint">{hint}</p>}
    </div>
  );
});

interface NumberFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  label: string;
  value: string;
  onChange(v: string): void;
  error?: boolean;
  errorId?: string;
  decimal?: boolean;
}

/** Campo numérico grande. Al enfocar se selecciona todo el valor. */
export const NumberField = forwardRef<HTMLInputElement, NumberFieldProps>(function NumberField(
  { label, value, onChange, error, errorId, decimal, id: idIn, className, ...rest }, ref
) {
  const auto = useId();
  const id = idIn || auto;
  return (
    <div className="fl">
      <label htmlFor={id}>{label}</label>
      <NumInput ref={ref} id={id} value={value} onChange={onChange} error={error} errorId={errorId} decimal={decimal} className={className} {...rest} />
    </div>
  );
});

export const NumInput = forwardRef<HTMLInputElement, Omit<NumberFieldProps, 'label'>>(function NumInput(
  { value, onChange, error, errorId, decimal, className, ...rest }, ref
) {
  return (
    <input
      ref={ref} type="text" className={['num-in', className || ''].filter(Boolean).join(' ')}
      inputMode={decimal ? 'decimal' : 'numeric'} autoComplete="off" placeholder="—"
      value={value} onChange={e => onChange(e.target.value)} onFocus={e => e.currentTarget.select()}
      aria-invalid={error ? true : undefined} aria-describedby={error ? errorId : undefined}
      {...rest}
    />
  );
});
