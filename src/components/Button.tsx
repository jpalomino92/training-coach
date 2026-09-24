/* Botón del sistema de diseño.
   Deshabilitado = aria-disabled (sigue siendo enfocable) y el motivo en aria-describedby.
   Cargando = "Un momento…", spinner y aria-busy; no admite un segundo toque. */
import { forwardRef, useId, type ButtonHTMLAttributes, type MouseEvent, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

type Variant = 'primary' | 'secondary' | 'danger' | 'link';

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'disabled'> {
  variant?: Variant;
  small?: boolean;
  block?: boolean;
  loading?: boolean;
  icon?: IconName;
  iconRight?: IconName;
  /** Si se indica, el botón queda deshabilitado y este texto explica el motivo. */
  disabledReason?: string | null;
  /** Si true, el motivo se muestra debajo del botón (si no, solo para lectores de pantalla). */
  showReason?: boolean;
  children: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'secondary', small, block, loading, icon, iconRight, disabledReason, showReason, className, onClick, children, type = 'button', ...rest }, ref
) {
  const reasonId = useId();
  const disabled = !!disabledReason;
  const cls = ['btn', `btn-${variant}`, small ? 'btn-sm' : '', block ? 'btn-block' : '', className || ''].filter(Boolean).join(' ');
  const handle = (e: MouseEvent<HTMLButtonElement>) => {
    if (loading || disabled) { e.preventDefault(); return; }
    onClick?.(e);
  };
  const btn = (
    <button
      ref={ref} type={type} className={cls} onClick={handle}
      aria-disabled={disabled || undefined} aria-busy={loading || undefined}
      aria-describedby={disabled ? reasonId : rest['aria-describedby']}
      {...rest}
    >
      {loading ? <><span className="spinner" aria-hidden="true" />Un momento…</> : <>{icon && <Icon name={icon} />}{children}{iconRight && <Icon name={iconRight} />}</>}
    </button>
  );
  if (!disabled) return btn;
  return (
    <>
      {btn}
      <span id={reasonId} className={showReason ? 'hint tc' : 'sr-only'}>{disabledReason}</span>
    </>
  );
});
