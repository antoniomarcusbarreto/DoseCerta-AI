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
import type { ItemRefeicaoIA, MacrosRefeicao, RegistroRefeicao } from '@/domain/tipos';
import { CardRefeicao } from '@/features/evolucao/CardRefeicao';
import { useDados } from '@/features/dados/DadosProvider';
import { useEvolucao } from '@/features/dados/DadosEvolucaoProvider';
import {
  atualizarItensRefeicaoPendente,
  confirmarRefeicao,
  criarRefeicaoEmAnalise,
  descartarRefeicaoPendente,
  excluirRefeicao,
  finalizarAnaliseRefeicao,
  marcarErroAnaliseRefeicao,
  uploadFotoRefeicao,
} from '@/features/dados/repositorio';
import { getFunctionsCliente } from '@/lib/firebase';
import { colRefeicoes, conversorRegistroRefeicao } from '@/lib/firestore';
import { useDocumento } from '@/lib/useConsulta';

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

/**
 * Tempo máximo de espera pela análise da IA no cliente — depois disso a tela
 * desiste e marca erro, em vez de travar. Fica ACIMA do timeout interno da
 * própria Cloud Function (20s foto / 12s texto): o relógio do cliente começa
 * a contar antes do cold start da function e (pra foto) do download do
 * Storage, então precisa de folga pra não estourar antes da function sequer
 * ter chance de responder com o erro certo.
 */
const TIMEOUT_ANALISE_FOTO_MS = 35_000;
const TIMEOUT_ANALISE_TEXTO_MS = 22_000;

type RespostaAnaliseRefeicao = { items: ItemRefeicaoIA[]; macros: MacrosRefeicao; aiFeedback: string };

/** Corre `promessa` contra um cronômetro: rejeita com `mensagem` se `ms` passarem antes dela resolver. */
function comTimeout<T>(promessa: Promise<T>, ms: number, mensagem: string): Promise<T> {
  return Promise.race([
    promessa,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(mensagem)), ms);
    }),
  ]);
}

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
  const [mostrarCampoTexto, setMostrarCampoTexto] = useState(false);
  const [descricaoTexto, setDescricaoTexto] = useState('');

  const { planos, refeicoesHoje: refeicoesDeHoje, erro: erroEvolucao } = useEvolucao();
  const planoAtivo = planos.find((p) => p.isActive) ?? null;

  const pendingMealDoc = useDocumento(
    uid && pendingMealId ? doc(colRefeicoes(uid), pendingMealId).withConverter(conversorRegistroRefeicao) : null,
  );
  const pendingMeal = pendingMealDoc.dados;

  const erroConsulta = erroEvolucao ?? pendingMealDoc.erro ?? null;

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

  type DietPlanGoals = { title: string; meals: { name: string; time: string; description: string }[] } | null;

  /**
   * Núcleo comum às duas origens (foto e texto): cria o rascunho já com
   * status `analyzing`, chama a Cloud Function correspondente com timeout, e
   * grava o resultado (ou o erro) no mesmo registro. Se `criarRefeicaoEmAnalise`
   * falhar (nenhum rascunho chegou a existir), relança pro chamador decidir a
   * mensagem — dali em diante, qualquer falha vira `status: 'error'` no
   * próprio documento em vez de se perder num alerta local.
   */
  async function processarAnalise(
    dadosIniciais: Pick<RegistroRefeicao, 'imageUrl' | 'storagePath' | 'description'>,
    chamarIA: () => Promise<RespostaAnaliseRefeicao>,
    timeoutMs: number,
  ): Promise<void> {
    if (!uid) return;
    let novoId: string | null = null;
    try {
      novoId = await criarRefeicaoEmAnalise(uid, dadosIniciais);
      setIsEditingMeal(false);
      setPendingMealId(novoId);

      const analise = await comTimeout(
        chamarIA(),
        timeoutMs,
        'A análise demorou demais. Tente novamente.',
      );

      await finalizarAnaliseRefeicao(uid, novoId, {
        items: analise.items,
        macros: analise.macros,
        aiFeedback: analise.aiFeedback,
      });
    } catch (falha) {
      console.error('[TelaScanner] falha ao analisar refeição', falha);
      if (!novoId) throw falha;
      const mensagem =
        falha instanceof Error ? falha.message : 'Não foi possível analisar a refeição. Tente novamente.';
      try {
        await marcarErroAnaliseRefeicao(uid, novoId, mensagem);
      } catch (falhaAoMarcar) {
        console.error('[TelaScanner] falha ao marcar erro de análise', falhaAoMarcar);
        setErro(mensagem);
      }
    }
  }

  async function handleFileUpload(evento: ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0] ?? null;
    evento.target.value = '';
    if (!arquivo || !uid) return;

    setErro(null);
    setIsAnalyzing(true);
    try {
      // Sobe a foto ANTES de criar o rascunho — se o upload falhar, ainda não
      // existe nenhum registro no Firestore pra marcar como erro.
      const { imageUrl, storagePath } = await uploadFotoRefeicao(uid, arquivo);

      await processarAnalise(
        { imageUrl, storagePath, description: null },
        async () => {
          const analisarRefeicaoIA = httpsCallable<
            { storagePath: string; dietPlanGoals: DietPlanGoals },
            RespostaAnaliseRefeicao
          >(getFunctionsCliente(), 'analisarRefeicaoIA');
          const { data } = await analisarRefeicaoIA({
            storagePath,
            dietPlanGoals: planoAtivo ? { title: planoAtivo.title, meals: planoAtivo.meals } : null,
          });
          return data;
        },
        TIMEOUT_ANALISE_FOTO_MS,
      );
    } catch (falha) {
      console.error('[TelaScanner] falha ao enviar foto', falha);
      setErro('Não foi possível enviar a foto. Tente novamente.');
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleAnalisarDescricao() {
    const descricao = descricaoTexto.trim();
    if (!descricao || !uid) return;

    setErro(null);
    setIsAnalyzing(true);
    try {
      await processarAnalise(
        { imageUrl: null, storagePath: null, description: descricao },
        async () => {
          const analisarDescricaoRefeicaoIA = httpsCallable<
            { descricao: string; dietPlanGoals: DietPlanGoals },
            RespostaAnaliseRefeicao
          >(getFunctionsCliente(), 'analisarDescricaoRefeicaoIA');
          const { data } = await analisarDescricaoRefeicaoIA({
            descricao,
            dietPlanGoals: planoAtivo ? { title: planoAtivo.title, meals: planoAtivo.meals } : null,
          });
          return data;
        },
        TIMEOUT_ANALISE_TEXTO_MS,
      );
      setDescricaoTexto('');
      setMostrarCampoTexto(false);
    } catch (falha) {
      console.error('[TelaScanner] falha ao enviar descrição', falha);
      setErro('Não foi possível enviar a descrição. Tente novamente.');
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

  function handleDeleteMeal(mealId: string, storagePath: string | null) {
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
          <div className="flex flex-col gap-3">
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

            {!mostrarCampoTexto ? (
              <Button
                type="button"
                variante="fantasma"
                larguraTotal
                disabled={!uid}
                onClick={() => setMostrarCampoTexto(true)}
              >
                ✍️ Digitar Refeição
              </Button>
            ) : (
              <div className="flex flex-col gap-2">
                <textarea
                  className="t-body w-full rounded-xl p-3"
                  style={{ background: 'var(--surface-sunken)', color: 'var(--ink)' }}
                  rows={3}
                  maxLength={1000}
                  placeholder="Ex: 150g de frango grelhado, arroz e uma salada de alface e tomate"
                  value={descricaoTexto}
                  onChange={(e) => setDescricaoTexto(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variante="fantasma"
                    onClick={() => {
                      setMostrarCampoTexto(false);
                      setDescricaoTexto('');
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    variante="secundaria"
                    larguraTotal
                    disabled={!descricaoTexto.trim()}
                    onClick={handleAnalisarDescricao}
                  >
                    Analisar Descrição
                  </Button>
                </div>
              </div>
            )}
          </div>
        </SheetCard>
      ) : null}

      {isAnalyzing || pendingMeal?.status === 'analyzing' ? (
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

      {pendingMeal?.status === 'error' ? (
        <SheetCard titulo="Falha na análise">
          <div className="flex flex-col gap-3">
            <Alerta
              tom="danger"
              titulo={pendingMeal.imageUrl ? 'Não foi possível analisar a imagem' : 'Não foi possível analisar a descrição'}
            >
              {pendingMeal.analysisError ?? 'Tente novamente.'}
            </Alerta>
            <Button type="button" variante="secundaria" larguraTotal onClick={handleDescartarMeal}>
              🗑️ Descartar e tentar de novo
            </Button>
          </div>
        </SheetCard>
      ) : null}

      {pendingMeal?.status === 'pending' ? (
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
              {pendingMeal.imageUrl ? (
                <img
                  src={pendingMeal.imageUrl}
                  alt="Foto do prato escaneado"
                  className="size-20 shrink-0 rounded-xl object-cover"
                />
              ) : (
                <div
                  className="flex size-20 shrink-0 items-center justify-center rounded-xl text-2xl"
                  style={{ background: 'var(--surface-sunken)' }}
                  title={pendingMeal.description ?? undefined}
                >
                  ✍️
                </div>
              )}
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
          {refeicoesDeHoje.length === 0 ? (
            <p className="t-label text-ink-muted">Nenhuma refeição registrada hoje.</p>
          ) : (
            <ul className="divide-y" style={{ borderColor: 'var(--border-hair)' }}>
              {refeicoesDeHoje.map((refeicao) => (
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
