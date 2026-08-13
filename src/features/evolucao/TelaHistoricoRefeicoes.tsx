import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alerta } from '@/components/Alerta';
import { CircleButton } from '@/components/CircleButton';
import { Hero } from '@/components/Hero';
import { Pagina } from '@/components/Pagina';
import { SheetCard } from '@/components/SheetCard';
import { useConfirm } from '@/contexts/ConfirmContext';
import type { RegistroRefeicao } from '@/domain/tipos';
import { CardRefeicao } from '@/features/evolucao/CardRefeicao';
import { useDados } from '@/features/dados/DadosProvider';
import { consultaTodasRefeicoesConcluidas, excluirRefeicao } from '@/features/dados/repositorio';
import { useColecao } from '@/lib/useConsulta';

const IconeVoltar = () => (
  <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
    <path
      d="M14.5 5.5L8 12l6.5 6.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/** Agrupa refeições por data (dd/mm/aaaa), preservando a ordem de chegada (mais recente primeiro). */
function agruparPorData(refeicoes: RegistroRefeicao[]): [string, RegistroRefeicao[]][] {
  const grupos = new Map<string, RegistroRefeicao[]>();
  for (const refeicao of refeicoes) {
    const chave = refeicao.createdAt.toLocaleDateString('pt-BR');
    const grupo = grupos.get(chave);
    if (grupo) grupo.push(refeicao);
    else grupos.set(chave, [refeicao]);
  }
  return Array.from(grupos.entries());
}

export function TelaHistoricoRefeicoes() {
  const navegar = useNavigate();
  const { uid } = useDados();
  const { askConfirm } = useConfirm();
  const [erro, setErro] = useState<string | null>(null);

  const refeicoes = useColecao(
    uid ? consultaTodasRefeicoesConcluidas(uid) : null,
    uid ? `${uid}/meals-historico` : null,
  );

  function handleDeleteMeal(mealId: string, storagePath: string) {
    if (!uid) return;
    askConfirm({
      title: 'Excluir Refeição',
      message:
        'Tem certeza que deseja excluir este registro? Os macros dessa refeição serão removidos do seu histórico.',
      confirmText: 'Excluir',
      onConfirm: async () => {
        try {
          await excluirRefeicao(uid, { id: mealId, storagePath });
        } catch (falha) {
          console.error('[TelaHistoricoRefeicoes] falha ao excluir refeição', falha);
          setErro('Não foi possível excluir a refeição. Tente novamente.');
        }
      },
    });
  }

  const grupos = agruparPorData(refeicoes.dados);

  return (
    <Pagina
      layout="foco"
      hero={
        <Hero
          titulo="Histórico de Refeições"
          esquerda={
            <CircleButton rotulo="Voltar" onClick={() => navegar(-1)}>
              <IconeVoltar />
            </CircleButton>
          }
        >
          {null}
        </Hero>
      }
    >
      {erro ? <Alerta tom="danger" titulo="Ops">{erro}</Alerta> : null}
      {!erro && refeicoes.erro ? (
        <Alerta tom="danger" titulo="Não foi possível carregar seu histórico">
          {refeicoes.erro.message}
        </Alerta>
      ) : null}

      <SheetCard titulo="Todas as refeições" subtitulo={`${refeicoes.dados.length} no total`}>
        {refeicoes.dados.length === 0 ? (
          <p className="t-body text-ink-muted">Nenhuma refeição registrada ainda.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {grupos.map(([data, refeicoesDoDia]) => (
              <div key={data}>
                <p className="t-caption mb-1 text-ink-muted">{data}</p>
                <ul className="divide-y" style={{ borderColor: 'var(--border-hair)' }}>
                  {refeicoesDoDia.map((refeicao) => (
                    <CardRefeicao
                      key={refeicao.id}
                      refeicao={refeicao}
                      onExcluir={handleDeleteMeal}
                      mostrarData={false}
                    />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </SheetCard>
    </Pagina>
  );
}
