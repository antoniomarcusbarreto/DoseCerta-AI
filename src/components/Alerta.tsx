import type { ReactNode } from 'react';

export type TomAlerta = 'ok' | 'warn' | 'danger';

type AlertaProps = {
  tom: TomAlerta;
  titulo: string;
  children?: ReactNode;
};

const ESTILO: Record<TomAlerta, { fundo: string; cor: string; rotuloIcone: string }> = {
  ok: { fundo: 'var(--ok-soft)', cor: 'var(--ok)', rotuloIcone: 'Tudo certo' },
  warn: { fundo: 'var(--warn-soft)', cor: 'var(--warn)', rotuloIcone: 'Atenção' },
  danger: { fundo: 'var(--danger-soft)', cor: 'var(--danger)', rotuloIcone: 'Alerta' },
};

const CAMINHO_ICONE: Record<TomAlerta, string> = {
  ok: 'M5 12.5l4.5 4.5L19 7.5',
  warn: 'M12 8v5M12 16.5v.5M12 3.5L2.5 20h19L12 3.5z',
  danger: 'M12 7v6M12 16.5v.5M12 2.5a9.5 9.5 0 100 19 9.5 9.5 0 000-19z',
};

/**
 * A referência é monocromática, mas caneta vencida e dose atrasada precisam
 * de cor. Aqui a cor nunca vem sozinha: sempre com ícone e texto, porque
 * cor isolada não é acessível para quem não a distingue.
 */
export function Alerta({ tom, titulo, children }: AlertaProps) {
  const { fundo, cor, rotuloIcone } = ESTILO[tom];

  return (
    <div
      className="flex items-start gap-3 p-4"
      style={{ background: fundo, borderRadius: 'var(--r-field)' }}
    >
      <svg viewBox="0 0 24 24" className="mt-0.5 size-5 shrink-0" role="img" aria-label={rotuloIcone}>
        <path
          d={CAMINHO_ICONE[tom]}
          fill="none"
          stroke={cor}
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className="min-w-0">
        <p className="t-label" style={{ color: cor }}>
          {titulo}
        </p>
        {children ? <div className="t-body mt-1 text-ink-muted">{children}</div> : null}
      </div>
    </div>
  );
}
