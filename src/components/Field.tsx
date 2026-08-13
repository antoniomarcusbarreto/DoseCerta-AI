import { useId, type InputHTMLAttributes } from 'react';

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  rotulo: string;
  /** 'hero' = campo translúcido sobre o gradiente. */
  sobre?: 'card' | 'hero';
  erro?: string;
};

export function Field({ rotulo, sobre = 'card', erro, className = '', ...props }: FieldProps) {
  const id = useId();
  const idErro = `${id}-erro`;
  const emHero = sobre === 'hero';

  return (
    <div className={className}>
      <label htmlFor={id} className={`t-caption ${emHero ? 'text-on-hero-muted' : 'text-ink-muted'}`}>
        {rotulo}
      </label>
      <input
        id={id}
        aria-invalid={erro ? true : undefined}
        aria-describedby={erro ? idErro : undefined}
        /* Campo travado precisa parecer travado: sem a pista visual, a pessoa
           tenta digitar e conclui que o app está quebrado. */
        className={`mt-1.5 block min-h-11 w-full border px-4 t-body outline-none disabled:cursor-not-allowed disabled:opacity-55 ${
          emHero ? 'text-on-hero placeholder:text-on-hero-faint' : 'text-ink placeholder:text-ink-faint'
        }`}
        style={{
          borderRadius: 'var(--r-field)',
          background: emHero ? 'var(--surface-glass)' : 'var(--surface-sunken)',
          borderColor: erro ? 'var(--danger)' : emHero ? 'var(--border-glass)' : 'var(--border-hair)',
          backdropFilter: emHero ? 'blur(12px)' : undefined,
          WebkitBackdropFilter: emHero ? 'blur(12px)' : undefined,
        }}
        {...props}
      />
      {erro ? (
        <p id={idErro} className="t-label mt-1.5" style={{ color: 'var(--danger)' }}>
          {erro}
        </p>
      ) : null}
    </div>
  );
}
