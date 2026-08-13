import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { doc } from 'firebase/firestore';
import { Alerta } from '@/components/Alerta';
import { Button } from '@/components/Button';
import { CircleButton } from '@/components/CircleButton';
import { Field } from '@/components/Field';
import { Hero } from '@/components/Hero';
import { Pagina } from '@/components/Pagina';
import { SheetCard } from '@/components/SheetCard';
import { useConfirm } from '@/contexts/ConfirmContext';
import type { ItemRefeicaoIA, MacrosRefeicao } from '@/domain/tipos';
import { CardRefeicao } from '@/features/evolucao/CardRefeicao';
import { useDados } from '@/features/dados/DadosProvider';
import {
  atualizarItensRefeicaoPendente,
  confirmarRefeicao,
  consultaPlanosAlimentares,
  consultaRefeicoesDeHojeConcluidas,
  criarRefeicaoPendente,
  descartarRefeicaoPendente,
  excluirRefeicao,
  uploadFotoRefeicao,
} from '@/features/dados/repositorio';
import { getFunctionsCliente } from '@/lib/firebase';
import { colRefeicoes, conversorRegistroRefeicao } from '@/lib/firestore';
import { useColecao, useDocumento } from '@/lib/useConsulta';

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

const OPCOES_PERCENTUAL: { rotulo: string; valor: number }[] = [
  { rotulo: 'Comi Tudo (100%)', valor: 1 },
  { rotulo: 'Comi Metade (50%)', valor: 0.5 },
  { rotulo: 'Comi Pouco (25%)', valor: 0.25 },
];

const CHAVE_PENDING_MEAL_DRAFT = 'pending_meal_draft';

type RespostaAnaliseRefeicao = { items: ItemRefeicaoIA[]; macros: MacrosRefeicao; aiFeedback: string };

export function TelaScanner() {
  const navegar = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const { uid } = useDados();
  const { askConfirm } = useConfirm();

  const [pendingMealId, setPendingMealId] = useState<string | null>(() =>
    localStorage.getItem(CHAVE_PENDING_MEAL_DRAFT),
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isEditingMeal, setIsEditingMeal] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [itensEmEdicao, setItensEmEdicao] = useState<ItemRefeicaoIA[]>([]);

  const planos = useColecao(
    uid ? consultaPlanosAlimentares(uid) : null,
    uid ? `${uid}/diet_plans` : null,
  );
  const planoAtivo = planos.dados.find((p) => p.isActive) ?? null;

  const pendingMealDoc = useDocumento(
    uid && pendingMealId ? doc(colRefeicoes(uid), pendingMealId).withConverter(conversorRegistroRefeicao) : null,
  );
  const pendingMeal = pendingMealDoc.dados;

  const refeicoesDeHoje = useColecao(
    uid ? consultaRefeicoesDeHojeConcluidas(uid) : null,
    uid ? `${uid}/meals-hoje` : null,
  );

  const erroConsulta = planos.erro ?? pendingMealDoc.erro ?? refeicoesDeHoje.erro ?? null;

  useEffect(() => {
    if (pendingMealId) {
      localStorage.setItem(CHAVE_PENDING_MEAL_DRAFT, pendingMealId);
    } else {
      localStorage.removeItem(CHAVE_PENDING_MEAL_DRAFT);
    }
  }, [pendingMealId]);

  // Rascunho aponta para um doc que não existe mais (excluído/nunca criado): limpa e volta ao início.
  useEffect(() => {
    if (pendingMealId && !pendingMealDoc.carregando && !pendingMealDoc.dados) {
      setPendingMealId(null);
    }
  }, [pendingMealId, pendingMealDoc.carregando, pendingMealDoc.dados]);

  useEffect(() => {
    if (pendingMeal) setItensEmEdicao(pendingMeal.items);
  }, [pendingMeal]);

  async function handleFileUpload(evento: ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0] ?? null;
    evento.target.value = '';
    if (!arquivo || !uid) return;

    setErro(null);
    setIsAnalyzing(true);
    try {
      const { imageUrl, storagePath } = await uploadFotoRefeicao(uid, arquivo);

      const analisarRefeicaoIA = httpsCallable<
        {
          storagePath: string;
          dietPlanGoals: { title: string; meals: { name: string; time: string; description: string }[] } | null;
        },
        RespostaAnaliseRefeicao
      >(getFunctionsCliente(), 'analisarRefeicaoIA');

      const { data: analise } = await analisarRefeicaoIA({
        storagePath,
        dietPlanGoals: planoAtivo ? { title: planoAtivo.title, meals: planoAtivo.meals } : null,
      });

      const novoId = await criarRefeicaoPendente(uid, {
        imageUrl,
        storagePath,
        items: analise.items,
        macros: analise.macros,
        aiFeedback: analise.aiFeedback,
      });

      setIsEditingMeal(false);
      setPendingMealId(novoId);
    } catch (falha) {
      console.error('[TelaScanner] falha ao analisar refeição', falha);
      setErro('Não foi possível analisar a foto. Tente novamente.');
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleConfirmMeal(percentual: number) {
    if (!uid || !pendingMealId || !pendingMeal) return;
    try {
      await confirmarRefeicao(uid, pendingMealId, percentual, pendingMeal.macros);
      setPendingMealId(null);
      setIsEditingMeal(false);
    } catch (falha) {
      console.error('[TelaScanner] falha ao confirmar refeição', falha);
      setErro('Não foi possível salvar a refeição. Tente novamente.');
    }
  }

  async function handleDescartarMeal() {
    if (!uid || !pendingMealId || !pendingMeal) return;
    try {
      await descartarRefeicaoPendente(uid, { id: pendingMealId, storagePath: pendingMeal.storagePath });
      setPendingMealId(null);
      setIsEditingMeal(false);
    } catch (falha) {
      console.error('[TelaScanner] falha ao descartar refeição', falha);
      setErro('Não foi possível descartar a refeição. Tente novamente.');
    }
  }

  function atualizarItemEmEdicao(indice: number, campo: keyof ItemRefeicaoIA, valor: string) {
    setItensEmEdicao((atual) =>
      atual.map((item, i) => (i === indice ? { ...item, [campo]: valor } : item)),
    );
  }

  async function concluirEdicaoItens() {
    if (uid && pendingMealId) {
      try {
        await atualizarItensRefeicaoPendente(uid, pendingMealId, itensEmEdicao);
      } catch (falha) {
        console.error('[TelaScanner] falha ao salvar itens editados', falha);
        setErro('Não foi possível salvar os itens editados. Tente novamente.');
        return;
      }
    }
    setIsEditingMeal(false);
  }

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
          console.error('[TelaScanner] falha ao excluir refeição', falha);
          setErro('Não foi possível excluir a refeição. Tente novamente.');
        }
      },
    });
  }

  return (
    <Pagina
      layout="foco"
      hero={
        <Hero
          titulo="Scanner de Refeições"
          esquerda={
            <CircleButton rotulo="Voltar" onClick={() => navegar('/evolucao')}>
              <IconeVoltar />
            </CircleButton>
          }
        >
          <div className="mt-6">
            <p className="t-caption text-on-hero-muted">Registros de Saúde</p>
            <h2 className="t-stat mt-1.5 text-on-hero">Refeições</h2>
          </div>
        </Hero>
      }
    >
      {erro ? <Alerta tom="danger" titulo="Ops">{erro}</Alerta> : null}
      {!erro && erroConsulta ? (
        <Alerta tom="danger" titulo="Não foi possível carregar seus dados">
          {erroConsulta.message}
        </Alerta>
      ) : null}

      {!isAnalyzing && !pendingMeal ? (
        <SheetCard titulo="Escanear prato">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={handleFileUpload}
          />
          <Button type="button" larguraTotal onClick={() => inputRef.current?.click()} disabled={!uid}>
            📸 Escanear Prato
          </Button>
        </SheetCard>
      ) : null}

      {isAnalyzing ? (
        <SheetCard titulo="Analisando">
          <div className="flex flex-col gap-3">
            <div className="h-32 w-full animate-pulse rounded-xl bg-sunken" />
            <div className="h-4 w-3/4 animate-pulse rounded-full bg-sunken" />
            <div className="h-4 w-full animate-pulse rounded-full bg-sunken" />
            <div className="h-4 w-2/3 animate-pulse rounded-full bg-sunken" />
            <p className="t-label mt-1 text-ink-muted">
              A Inteligência Artificial está analisando seu prato cruzando com sua dieta…
            </p>
          </div>
        </SheetCard>
      ) : null}

      {pendingMeal ? (
        <SheetCard
          titulo="Refeição identificada"
          acao={
            !isEditingMeal ? (
              <div className="flex gap-2">
                <Button type="button" variante="fantasma" onClick={() => setIsEditingMeal(true)}>
                  ✏️ Editar Itens
                </Button>
                <Button type="button" variante="fantasma" onClick={handleDescartarMeal}>
                  🗑️ Descartar
                </Button>
              </div>
            ) : null
          }
        >
          <div className="flex flex-col gap-4">
            <div className="flex gap-3">
              <img
                src={pendingMeal.imageUrl}
                alt="Foto do prato escaneado"
                className="size-20 shrink-0 rounded-xl object-cover"
              />
              {isEditingMeal ? (
                <div className="flex flex-1 flex-col gap-2">
                  {itensEmEdicao.map((item, indice) => (
                    <div key={indice} className="flex gap-2">
                      <Field
                        rotulo="Item"
                        value={item.name}
                        onChange={(e) => atualizarItemEmEdicao(indice, 'name', e.target.value)}
                        className="flex-1"
                      />
                      <Field
                        rotulo="Quantidade"
                        value={item.quantity}
                        onChange={(e) => atualizarItemEmEdicao(indice, 'quantity', e.target.value)}
                        className="w-24"
                      />
                    </div>
                  ))}
                  <Button type="button" variante="secundaria" onClick={concluirEdicaoItens}>
                    Concluir Edição
                  </Button>
                </div>
              ) : (
                <ul className="flex flex-col justify-center gap-0.5">
                  {pendingMeal.items.map((item, indice) => (
                    <li key={indice} className="t-label text-ink">
                      {item.name} <span className="text-ink-muted">({item.quantity})</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl p-3" style={{ background: 'var(--surface-sunken)' }}>
                <p className="t-caption text-ink-muted">Proteínas</p>
                <p className="t-title text-ink">{pendingMeal.macros.protein}g</p>
              </div>
              <div className="rounded-xl p-3" style={{ background: 'var(--surface-sunken)' }}>
                <p className="t-caption text-ink-muted">Carboidratos</p>
                <p className="t-title text-ink">{pendingMeal.macros.carbs}g</p>
              </div>
              <div className="rounded-xl p-3" style={{ background: 'var(--surface-sunken)' }}>
                <p className="t-caption text-ink-muted">Gorduras</p>
                <p className="t-title text-ink">{pendingMeal.macros.fat}g</p>
              </div>
              <div className="rounded-xl p-3" style={{ background: 'var(--surface-sunken)' }}>
                <p className="t-caption text-ink-muted">Kcal</p>
                <p className="t-title text-ink">{pendingMeal.macros.kcal}</p>
              </div>
            </div>

            <Alerta tom="ok" titulo="Feedback da IA">
              {pendingMeal.aiFeedback}
            </Alerta>

            <div className="flex flex-col gap-2">
              <div>
                <p className="t-label text-ink">Salvar no Histórico: O quanto você comeu?</p>
                <p className="t-caption text-ink-muted">
                  (Ao clicar, a refeição será salva no seu diário)
                </p>
              </div>
              {OPCOES_PERCENTUAL.map((opcao) => (
                <Button
                  key={opcao.rotulo}
                  type="button"
                  variante="secundaria"
                  larguraTotal
                  onClick={() => handleConfirmMeal(opcao.valor)}
                >
                  {opcao.rotulo}
                </Button>
              ))}
            </div>
          </div>
        </SheetCard>
      ) : null}

      <SheetCard titulo="Refeições de Hoje">
        <div className="flex flex-col gap-3">
          {refeicoesDeHoje.dados.length === 0 ? (
            <p className="t-label text-ink-muted">Nenhuma refeição registrada hoje.</p>
          ) : (
            <ul className="divide-y" style={{ borderColor: 'var(--border-hair)' }}>
              {refeicoesDeHoje.dados.map((refeicao) => (
                <CardRefeicao key={refeicao.id} refeicao={refeicao} onExcluir={handleDeleteMeal} />
              ))}
            </ul>
          )}

          <Button
            type="button"
            variante="fantasma"
            onClick={() => navegar('/evolucao/historico-refeicoes')}
          >
            Ver Histórico Completo
          </Button>
        </div>
      </SheetCard>
    </Pagina>
  );
}
