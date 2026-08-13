import type { ReactNode } from 'react';

type SheetCardProps = {
  titulo?: string;
  subtitulo?: string;
  /** Ação no canto superior direito (link "ver tudo", botão pequeno). */
  acao?: ReactNode;
  /**
   * 'solta' é o card branco padrão; 'topo' encosta na seção anterior e
   * arredonda só as quinas de cima — o card que sobe por cima do herói.
   */
  variante?: 'solta' | 'topo';
  className?: string;
  children: ReactNode;
};

export function SheetCard({
  titulo,
  subtitulo,
  acao,
  variante = 'solta',
  className = '',
  children,
}: SheetCardProps) {
  return (
    <section
      /* O padding cresce um degrau no desktop: 20px num card de 700px deixa o
         conteúdo colado na borda e o card com cara de esticado. */
      className={`bg-card p-5 lg:p-6 ${className}`}
      style={{
        borderRadius:
          variante === 'topo'
            ? 'var(--r-card) var(--r-card) 0 0'
            : 'var(--r-card)',
        boxShadow: variante === 'topo' ? 'none' : 'var(--shadow-card)',
      }}
    >
      {titulo || acao ? (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {titulo ? <h2 className="t-title text-ink">{titulo}</h2> : null}
            {subtitulo ? <p className="t-label mt-0.5 text-ink-muted">{subtitulo}</p> : null}
          </div>
          {acao ? <div className="shrink-0">{acao}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
