import { useId, useState } from 'react';
import { GlassCard } from './GlassCard';

export type PontoHairline = {
  /** Rótulo do eixo X. Nem todos são exibidos — o gráfico dilui. */
  rotulo: string;
  valor: number;
  /** Texto do tooltip ao tocar a barra. Sem ele, o toque não abre nada. */
  detalhe?: string;
  /** Marca a barra como o ponto atual/mais relevante. */
  destaque?: boolean;
};

type HairlineChartProps = {
  pontos: PontoHairline[];
  /** 'hero' = barras brancas sobre o gradiente; 'card' = escuras sobre branco. */
  sobre?: 'hero' | 'card';
  /** Valores das linhas de grade horizontais, na unidade dos dados. */
  grade?: number[];
  formatarEixoY?: (valor: number) => string;
  altura?: number;
  /** Quantos rótulos do eixo X exibir, no máximo. */
  maxRotulos?: number;
  /**
   * Piso do domínio. Para contagens, 0 está certo. Para séries como peso,
   * ancorar em 0 achata tudo — 89 e 98 kg viram barras quase idênticas.
   * Passe `base="auto"` para o gráfico enquadrar a própria faixa dos dados.
   */
  base?: number | 'auto';
};

const LARGURA_BARRA = 1.5;
/** Faixa à esquerda reservada aos rótulos do eixo Y, para não colidir com as barras. */
const PAD_EIXO_Y = 34;

/**
 * O gráfico em fio de cabelo da referência: barras de 1,5px com ponta
 * arredondada, gridlines quase invisíveis, rótulos de eixo minúsculos.
 *
 * As barras são finas de propósito, então cada uma ganha uma faixa de toque
 * invisível e larga por cima — o alvo interativo não é o fio.
 */
export function HairlineChart({
  pontos,
  sobre = 'hero',
  grade = [],
  formatarEixoY = (v) => String(v),
  altura = 190,
  maxRotulos = 6,
  base = 0,
}: HairlineChartProps) {
  const [selecionado, setSelecionado] = useState<number | null>(null);
  const idGrafico = useId();

  if (pontos.length === 0) {
    return (
      <p className={`t-label py-8 text-center ${sobre === 'hero' ? 'text-on-hero-muted' : 'text-ink-muted'}`}>
        Sem dados ainda.
      </p>
    );
  }

  const corBarra = sobre === 'hero' ? 'var(--on-hero)' : 'var(--ink)';
  const corGrade = sobre === 'hero' ? 'var(--on-hero-faint)' : 'var(--ink-faint)';
  const classeEixo = sobre === 'hero' ? 'text-on-hero-muted' : 'text-ink-muted';

  const valores = pontos.map((p) => p.valor);
  const menorValor = Math.min(...valores);
  const maiorValor = Math.max(...valores, ...grade);

  // 'auto' abre uma folga de 8% abaixo do menor valor, para a barra mais baixa
  // ainda ser visível em vez de sumir na linha de base.
  const piso =
    base === 'auto' ? menorValor - Math.max((maiorValor - menorValor) * 0.08, 0.01) : base;
  const teto = Math.max(maiorValor, piso + 1e-6);

  const alturaBarras = altura - 22; // reserva a faixa dos rótulos do eixo X
  const alturaDe = (valor: number) =>
    Math.max(LARGURA_BARRA, ((valor - piso) / (teto - piso)) * alturaBarras);

  const passoRotulo = Math.max(1, Math.ceil(pontos.length / maxRotulos));
  const ponto = selecionado === null ? null : pontos[selecionado];
  const padEsquerda = grade.length > 0 ? PAD_EIXO_Y : 0;

  return (
    /*
     * O teto de 560px é estrutural, não estético: as barras têm largura FIXA
     * de 1,5px dentro de wrappers `flex-1`, então largura livre não engrossa a
     * barra — só multiplica o vão entre elas, e o gráfico vira uma cerca de
     * fios soltos. Com o cap, a densidade no desktop fica igual à do celular.
     * Não tem efeito abaixo de 560px, então o celular não vê diferença.
     */
    <div className="relative max-w-[560px]">
      {/* Rótulos do eixo Y, ancorados na altura da respectiva linha de grade. */}
      {grade.map((valor) => (
        <span
          key={`${idGrafico}-eixo-${valor}`}
          className={`t-caption pointer-events-none absolute left-0 z-10 ${classeEixo}`}
          /* +22 sobe acima da faixa de rótulos do eixo X; −7 centra na linha. */
          style={{ bottom: alturaDe(valor) + 22 - 7 }}
        >
          {formatarEixoY(valor)}
        </span>
      ))}

      <div
        role="group"
        aria-label="Gráfico de barras"
        className="relative flex items-end"
        style={{ height: alturaBarras, paddingLeft: padEsquerda }}
      >
        {/* Grade: linhas de 1px em cor de ornamento, nunca em cor de texto. */}
        {grade.map((valor) => (
          <div
            key={`${idGrafico}-grade-${valor}`}
            aria-hidden="true"
            className="pointer-events-none absolute right-0 h-px"
            style={{ left: padEsquerda, bottom: alturaDe(valor), background: corGrade, opacity: 0.35 }}
          />
        ))}

        {pontos.map((p, i) => {
          const alturaPx = alturaDe(p.valor);
          const ativo = selecionado === i;
          const interativo = Boolean(p.detalhe);

          const barra = (
            <span
              aria-hidden="true"
              className="block rounded-full transition-opacity"
              style={{
                width: LARGURA_BARRA,
                height: alturaPx,
                background: corBarra,
                opacity: p.destaque || ativo ? 1 : 0.55,
              }}
            />
          );

          if (!interativo) {
            return (
              <div key={`${idGrafico}-${i}`} className="flex flex-1 justify-center">
                {barra}
              </div>
            );
          }

          return (
            <button
              key={`${idGrafico}-${i}`}
              type="button"
              aria-label={`${p.rotulo}: ${p.detalhe}`}
              aria-pressed={ativo}
              onClick={() => setSelecionado(ativo ? null : i)}
              className="flex flex-1 cursor-pointer justify-center self-stretch items-end"
            >
              {barra}
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex" style={{ paddingLeft: padEsquerda }}>
        {pontos.map((p, i) => (
          <span
            key={`${idGrafico}-rot-${i}`}
            className={`t-caption flex-1 text-center ${classeEixo}`}
            style={{ visibility: i % passoRotulo === 0 ? 'visible' : 'hidden' }}
          >
            {p.rotulo}
          </span>
        ))}
      </div>

      {ponto?.detalhe ? (
        <div
          className="pointer-events-none absolute inset-x-0 top-2 flex justify-end px-2"
          role="status"
        >
          <GlassCard
            className="pointer-events-auto max-w-[62%]"
            destaque={ponto.rotulo}
            legenda={ponto.detalhe}
            onFechar={() => setSelecionado(null)}
          />
        </div>
      ) : null}
    </div>
  );
}
