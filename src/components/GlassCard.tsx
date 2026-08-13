import type { ReactNode } from 'react';

type GlassCardProps = {
  /** Linha de destaque (ex.: "-1,2 kg"). */
  destaque: ReactNode;
  /** Legenda abaixo do destaque. */
  legenda: string;
  onFechar?: () => void;
  className?: string;
  style?: React.CSSProperties;
};

/**
 * O tooltip em vidro fosco da referência. Translúcido + blur, borda clara.
 * Usado para deltas e detalhes do ponto tocado no gráfico.
 */
export function GlassCard({ destaque, legenda, onFechar, className = '', style }: GlassCardProps) {
  return (
    <div
      className={`inline-flex items-start gap-3 border px-4 py-3 text-on-hero ${className}`}
      style={{
        background: 'var(--surface-glass)',
        borderColor: 'var(--border-glass)',
        borderRadius: 'var(--r-glass)',
        boxShadow: 'var(--shadow-glass)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        ...style,
      }}
    >
      <div className="min-w-0">
        <p className="t-title">{destaque}</p>
        <p className="t-label mt-0.5 text-on-hero-muted">{legenda}</p>
      </div>
      {onFechar ? (
        <button
          type="button"
          aria-label="Fechar"
          onClick={onFechar}
          className="-m-2 grid size-11 shrink-0 place-items-center rounded-full text-on-hero-muted transition-colors hover:text-on-hero"
        >
          <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
            <path
              d="M6 6l12 12M18 6L6 18"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
            />
          </svg>
        </button>
      ) : null}
    </div>
  );
}
