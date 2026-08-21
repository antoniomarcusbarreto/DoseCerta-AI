import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: 'primaria' | 'secundaria' | 'fantasma';
  /** 'hero' inverte as cores para funcionar sobre o gradiente. */
  sobre?: 'card' | 'hero';
  larguraTotal?: boolean;
  children: ReactNode;
};

export function Button({
  variante = 'primaria',
  sobre = 'card',
  larguraTotal = false,
  className = '',
  children,
  ...props
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-2 t-label disabled:opacity-45 disabled:pointer-events-none';

  let customClasses = '';
  let estilo: React.CSSProperties = {};

  if (variante === 'primaria') {
    if (sobre === 'hero') {
      customClasses =
        'shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all font-bold px-6 py-3 rounded-full';
      estilo = { background: 'var(--btn-primary-hero-bg)', color: 'var(--btn-primary-hero-text)' };
    } else {
      customClasses =
        'shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all font-semibold px-6 py-3 rounded-xl';
      estilo = { background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)' };
    }
  } else if (variante === 'secundaria') {
    customClasses = 'min-h-11 rounded-full px-6 transition-opacity hover:opacity-85';
    if (sobre === 'hero') {
      estilo = {
        background: 'var(--surface-glass)',
        color: 'var(--on-hero)',
        border: '1px solid var(--border-glass)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      };
    } else {
      estilo = {
        background: 'transparent',
        color: 'var(--ink)',
        border: '1px solid var(--border-hair)',
      };
    }
  } else {
    customClasses = 'min-h-11 rounded-full px-6 transition-opacity hover:opacity-85';
    estilo = {
      background: 'transparent',
      color: sobre === 'hero' ? 'var(--on-hero-muted)' : 'var(--ink-muted)',
    };
  }

  return (
    <button
      type="button"
      className={`${base} ${customClasses} ${larguraTotal ? 'w-full' : ''} ${className}`}
      style={Object.keys(estilo).length > 0 ? estilo : undefined}
      {...props}
    >
      {children}
    </button>
  );
}
