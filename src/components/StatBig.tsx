import type { ReactNode } from 'react';

type StatBigProps = {
  /** Rótulo pequeno e apagado acima do número. */
  rotulo: string;
  valor: ReactNode;
  /** Sufixo em escala menor, colado no valor (ex.: "kg", "dias"). */
  sufixo?: string;
  /** 'hero' = sobre o gradiente; 'card' = sobre superfície branca. */
  sobre?: 'hero' | 'card';
  /** 'display' é o número gigante da referência; 'stat' é a versão em card. */
  escala?: 'display' | 'stat';
};

export function StatBig({
  rotulo,
  valor,
  sufixo,
  sobre = 'hero',
  escala = 'display',
}: StatBigProps) {
  const corRotulo = sobre === 'hero' ? 'text-on-hero-muted' : 'text-ink-muted';
  const corValor = sobre === 'hero' ? 'text-on-hero' : 'text-ink';

  return (
    <div>
      <p className={`t-caption ${corRotulo}`}>{rotulo}</p>
      <p className={`mt-1.5 ${escala === 'display' ? 't-display' : 't-stat'} ${corValor}`}>
        {valor}
        {sufixo ? (
          <span className="ml-1.5 text-[0.32em] font-normal tracking-normal opacity-75">
            {sufixo}
          </span>
        ) : null}
      </p>
    </div>
  );
}
