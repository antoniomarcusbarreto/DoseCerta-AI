import { useState } from 'react';
import { Alerta } from '@/components/Alerta';
import type { RegistroRefeicao } from '@/domain/tipos';

const IconeLixeira = () => (
  <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
    <path
      d="M5 7h14M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-9 0 1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const IconeChevron = ({ aberto }: { aberto: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    className={`size-4 shrink-0 transition-transform duration-200 ${aberto ? 'rotate-180' : ''}`}
    aria-hidden="true"
  >
    <path
      d="M6 9l6 6 6-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

type CardRefeicaoProps = {
  refeicao: RegistroRefeicao;
  onExcluir: (mealId: string, storagePath: string | null) => void;
  /** Mostra a data na legenda — desligue quando o card já está sob um cabeçalho de data. */
  mostrarData?: boolean;
};

/**
 * A IA sempre estima os macros e as quantidades para o prato inteiro (100%);
 * `consumedPercentage` é o quanto disso a pessoa realmente comeu, então todo
 * número exibido precisa ser escalado por ele — senão o histórico mostra a
 * ingestão do prato, não a da pessoa.
 */
function escalarQuantidade(quantidade: string, fator: number): string {
  const match = quantidade.match(/^(\d+(?:[.,]\d+)?)(.*)$/);
  if (!match) return quantidade;
  const valorOriginal = Number(match[1].replace(',', '.'));
  if (Number.isNaN(valorOriginal)) return quantidade;
  return `${Math.round(valorOriginal * fator)}${match[2]}`;
}

/**
 * Card de refeição expansível: colapsado mostra o resumo (itens, kcal, %),
 * expandido revela os mesmos macros e feedback da IA vistos na tela de
 * análise, sem exigir uma navegação extra pra reler o que já foi escaneado.
 */
export function CardRefeicao({ refeicao, onExcluir, mostrarData = true }: CardRefeicaoProps) {
  const [expandido, setExpandido] = useState(false);

  // Fator real de ingestão: 1 (100%), 0.5 (50%), 0.25 (25%) ou qualquer outro
  // valor salvo em `consumedPercentage` — nunca fixo, sempre o que está no documento.
  const fator = refeicao.consumedPercentage ?? 1;
  const macrosReais = {
    protein: Math.round(refeicao.macros.protein * fator),
    carbs: Math.round(refeicao.macros.carbs * fator),
    fat: Math.round(refeicao.macros.fat * fator),
    kcal: Math.round(refeicao.macros.kcal * fator),
  };

  return (
    <li className="py-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          onClick={() => setExpandido((atual) => !atual)}
          aria-expanded={expandido}
        >
          {refeicao.imageUrl ? (
            <img
              src={refeicao.imageUrl}
              alt="Miniatura da refeição"
              className="size-12 shrink-0 rounded-lg object-cover"
            />
          ) : (
            <div
              className="flex size-12 shrink-0 items-center justify-center rounded-lg text-lg"
              style={{ background: 'var(--surface-sunken)' }}
              title={refeicao.description ?? undefined}
            >
              ✍️
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="t-label truncate text-ink">
              {refeicao.items.map((item) => item.name).join(', ')}
            </p>
            <p className="t-caption text-ink-muted">
              {macrosReais.kcal} kcal · {Math.round(fator * 100)}%
              {mostrarData ? ` · ${refeicao.createdAt.toLocaleDateString('pt-BR')}` : ''}
            </p>
          </div>
          <span className="text-ink-muted">
            <IconeChevron aberto={expandido} />
          </span>
        </button>
        <button
          type="button"
          aria-label="Excluir refeição"
          className="shrink-0 rounded-full p-1.5"
          style={{ color: 'var(--danger)' }}
          onClick={() => onExcluir(refeicao.id, refeicao.storagePath)}
        >
          <IconeLixeira />
        </button>
      </div>

      <div
        className="grid transition-[grid-template-rows] duration-300 ease-in-out"
        style={{ gridTemplateRows: expandido ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div className="mt-3 flex flex-col gap-3 pl-[3.75rem]">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-xl p-3" style={{ background: 'var(--surface-sunken)' }}>
                <p className="t-caption text-ink-muted">Proteínas</p>
                <p className="t-title text-ink">{macrosReais.protein}g</p>
              </div>
              <div className="rounded-xl p-3" style={{ background: 'var(--surface-sunken)' }}>
                <p className="t-caption text-ink-muted">Carboidratos</p>
                <p className="t-title text-ink">{macrosReais.carbs}g</p>
              </div>
              <div className="rounded-xl p-3" style={{ background: 'var(--surface-sunken)' }}>
                <p className="t-caption text-ink-muted">Gorduras</p>
                <p className="t-title text-ink">{macrosReais.fat}g</p>
              </div>
              <div className="rounded-xl p-3" style={{ background: 'var(--surface-sunken)' }}>
                <p className="t-caption text-ink-muted">Kcal</p>
                <p className="t-title text-ink">{macrosReais.kcal}</p>
              </div>
            </div>

            <ul className="flex flex-col gap-0.5">
              {refeicao.items.map((item, indice) => (
                <li key={indice} className="t-label text-ink">
                  {item.name} <span className="text-ink-muted">({escalarQuantidade(item.quantity, fator)})</span>
                </li>
              ))}
            </ul>

            {refeicao.aiFeedback ? (
              <Alerta tom="ok" titulo="Feedback da IA">
                {refeicao.aiFeedback}
              </Alerta>
            ) : null}
          </div>
        </div>
      </div>
    </li>
  );
}
