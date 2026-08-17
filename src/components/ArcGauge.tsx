import type { ReactNode } from 'react';

type ArcGaugeProps = {
  valor: number;
  max: number;
  /** O que aparece grande no centro. Por padrão, o próprio `valor`. Passe `''` para não mostrar nada. */
  exibicao?: ReactNode;
  /** Legenda abaixo do número. */
  legenda: string;
  /** Pílula pousada sobre o arco (ex.: "+7%", "3 de 4"). */
  badge?: string;
  /** Muda a cor do arco quando o estado pede atenção. */
  tom?: 'neutro' | 'ok' | 'warn' | 'danger';
  /**
   * Menor no celular, cresce a partir de `sm` — para caber 3 anéis lado a
   * lado numa tela estreita sem estourar o card nem forçar rolagem. `false`
   * preserva o tamanho fixo original (ex.: o medidor sozinho da caneta).
   */
  compacto?: boolean;
};

const RAIO = 78;
const CENTRO = 96;
const ESPESSURA = 3;
const GRAU_INICIAL = 160;
const GRAU_VARRIDO = 220;

function ponto(grau: number) {
  const rad = (grau * Math.PI) / 180;
  return { x: CENTRO + RAIO * Math.cos(rad), y: CENTRO + RAIO * Math.sin(rad) };
}

function arco(deGrau: number, ateGrau: number) {
  const inicio = ponto(deGrau);
  const fim = ponto(ateGrau);
  const maior = ateGrau - deGrau > 180 ? 1 : 0;
  return `M ${inicio.x} ${inicio.y} A ${RAIO} ${RAIO} 0 ${maior} 1 ${fim.x} ${fim.y}`;
}

const COR_TOM: Record<NonNullable<ArcGaugeProps['tom']>, string> = {
  neutro: 'var(--ink)',
  ok: 'var(--ok)',
  warn: 'var(--warn)',
  danger: 'var(--danger)',
};

/**
 * O medidor em arco da referência: traço fino, pílula pousada sobre o arco,
 * número grande no centro. Cabe bem em "doses restantes na caneta", onde a
 * escala é curta (0 a 4) e a leitura precisa ser instantânea — e também em
 * metas diárias, onde o arco completo (220°) já É a leitura de "meta batida".
 */
export function ArcGauge({
  valor,
  max,
  exibicao,
  legenda,
  badge,
  tom = 'neutro',
  compacto = false,
}: ArcGaugeProps) {
  const fracao = max > 0 ? Math.min(1, Math.max(0, valor / max)) : 0;
  const cor = COR_TOM[tom];

  return (
    <div
      className={`relative mx-auto w-full ${compacto ? 'max-w-[104px] sm:max-w-[192px]' : 'max-w-[192px]'}`}
    >
      <svg
        viewBox="0 0 192 150"
        className="w-full overflow-visible"
        role="img"
        aria-label={`${legenda}: ${valor} de ${max}`}
      >
        <path
          d={arco(GRAU_INICIAL, GRAU_INICIAL + GRAU_VARRIDO)}
          fill="none"
          stroke="var(--ink-faint)"
          strokeWidth={ESPESSURA}
          strokeLinecap="round"
          opacity={0.3}
        />
        {fracao > 0 ? (
          <path
            d={arco(GRAU_INICIAL, GRAU_INICIAL + GRAU_VARRIDO * fracao)}
            fill="none"
            stroke={cor}
            strokeWidth={ESPESSURA}
            strokeLinecap="round"
          />
        ) : null}
      </svg>

      {badge ? (
        <span
          className={`absolute left-1/2 top-1 -translate-x-1/2 rounded-full border text-ink ${
            compacto
              ? 'px-1.5 py-0.5 text-[9px] font-medium tracking-wide sm:px-3 sm:py-1.5 sm:text-[11px]'
              : 't-caption px-3 py-1.5'
          }`}
          style={{ borderColor: 'var(--border-hair)', background: 'var(--surface-card)' }}
        >
          {badge}
        </span>
      ) : null}

      <div className="absolute inset-x-0 bottom-2 text-center">
        <p
          className={
            compacto
              ? 'text-base leading-tight font-normal tracking-tight text-ink sm:text-3xl'
              : 't-stat text-ink'
          }
        >
          {exibicao ?? valor}
        </p>
        <p
          className={
            compacto
              ? 'mt-0.5 text-[9px] font-medium text-ink-muted sm:mt-1 sm:text-[13px]'
              : 't-label mt-1 text-ink-muted'
          }
        >
          {legenda}
        </p>
      </div>
    </div>
  );
}
