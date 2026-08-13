import { useId, type SelectHTMLAttributes } from 'react';

export type OpcaoSelect = {
  valor: string;
  rotulo: string;
  desabilitada?: boolean;
};

type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> & {
  rotulo: string;
  opcoes: OpcaoSelect[];
  /** Primeira opção neutra, sem valor. Ausente = o select já começa escolhido. */
  placeholder?: string;
  /** 'hero' = campo translúcido sobre o gradiente. */
  sobre?: 'card' | 'hero';
  erro?: string;
};

export function Select({
  rotulo,
  opcoes,
  placeholder,
  sobre = 'card',
  erro,
  className = '',
  ...props
}: SelectProps) {
  const id = useId();
  const idErro = `${id}-erro`;
  const emHero = sobre === 'hero';

  return (
    <div className={className}>
      <label
        htmlFor={id}
        className={`t-caption ${emHero ? 'text-on-hero-muted' : 'text-ink-muted'}`}
      >
        {rotulo}
      </label>
      <select
        id={id}
        aria-invalid={erro ? true : undefined}
        aria-describedby={erro ? idErro : undefined}
        className={`mt-1.5 block min-h-11 w-full border px-4 t-body outline-none disabled:cursor-not-allowed disabled:opacity-55 ${
          emHero ? 'text-on-hero' : 'text-ink'
        }`}
        style={{
          borderRadius: 'var(--r-field)',
          background: emHero ? 'var(--surface-glass)' : 'var(--surface-sunken)',
          borderColor: erro
            ? 'var(--danger)'
            : emHero
              ? 'var(--border-glass)'
              : 'var(--border-hair)',
          backdropFilter: emHero ? 'blur(12px)' : undefined,
          WebkitBackdropFilter: emHero ? 'blur(12px)' : undefined,
        }}
        {...props}
      >
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {opcoes.map((opcao) => (
          <option key={opcao.valor} value={opcao.valor} disabled={opcao.desabilitada}>
            {opcao.rotulo}
          </option>
        ))}
      </select>
      {erro ? (
        <p id={idErro} className="t-label mt-1.5" style={{ color: 'var(--danger)' }}>
          {erro}
        </p>
      ) : null}
    </div>
  );
}
