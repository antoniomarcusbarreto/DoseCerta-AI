import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { Alerta } from '@/components/Alerta';
import { Button } from '@/components/Button';
import { CircleButton } from '@/components/CircleButton';
import { Field } from '@/components/Field';
import { Hero } from '@/components/Hero';
import { Pagina } from '@/components/Pagina';
import { SheetCard } from '@/components/SheetCard';
import { ordenarRefeicoesPorDiaEHorario } from '@/domain/datas';
import type { Refeicao } from '@/domain/tipos';
import { useDados } from '@/features/dados/DadosProvider';
import {
  atualizarPlanoAlimentar,
  consultaPlanosAlimentares,
  criarPlanoAlimentar,
  excluirPlanoAlimentar,
} from '@/features/dados/repositorio';
import { getFunctionsCliente } from '@/lib/firebase';
import { useColecao } from '@/lib/useConsulta';

const EXTENSOES_ACEITAS_IA = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

type RespostaImportarDietaIA = { title: string; meals: Refeicao[] };

function arquivoParaBase64(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => {
      const resultado = leitor.result as string;
      resolve(resultado.split(',')[1] ?? '');
    };
    leitor.onerror = () => reject(leitor.error);
    leitor.readAsDataURL(arquivo);
  });
}

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

function novaRefeicaoVazia(): Refeicao {
  return { id: crypto.randomUUID(), name: '', time: '', description: '' };
}

export function TelaDieta() {
  const navegar = useNavigate();
  const { uid } = useDados();

  const consulta = uid ? consultaPlanosAlimentares(uid) : null;
  const { dados: planos, carregando } = useColecao(consulta, uid ? `${uid}/diet_plans` : null);

  const [isCreatingPlan, setIsCreatingPlan] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [ativarPlano, setAtivarPlano] = useState(true);
  const [refeicoes, setRefeicoes] = useState<Refeicao[]>([novaRefeicaoVazia()]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [arquivoIA, setArquivoIA] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [editandoRefeicaoId, setEditandoRefeicaoId] = useState<string | null>(null);
  const [refeicaoEmEdicao, setRefeicaoEmEdicao] = useState<Refeicao | null>(null);
  const [mostrandoNovaRefeicao, setMostrandoNovaRefeicao] = useState(false);
  const [novaRefeicaoDraft, setNovaRefeicaoDraft] = useState<Refeicao>(novaRefeicaoVazia());
  const [salvandoRefeicaoId, setSalvandoRefeicaoId] = useState<string | 'nova' | null>(null);
  const [erroRefeicoes, setErroRefeicoes] = useState<string | null>(null);

  if (!uid) return null;

  const planoAtivo = planos.find((p) => p.isActive) ?? null;
  const planosInativos = planos.filter((p) => !p.isActive);

  function adicionarRefeicao() {
    setRefeicoes((atual) => [...atual, novaRefeicaoVazia()]);
  }

  function atualizarRefeicao(id: string, campo: keyof Omit<Refeicao, 'id'>, valor: string) {
    setRefeicoes((atual) => atual.map((r) => (r.id === id ? { ...r, [campo]: valor } : r)));
  }

  function removerRefeicao(id: string) {
    setRefeicoes((atual) => (atual.length > 1 ? atual.filter((r) => r.id !== id) : atual));
  }

  function resetarForm() {
    setTitulo('');
    setAtivarPlano(true);
    setRefeicoes([novaRefeicaoVazia()]);
    setArquivoIA(null);
  }

  async function handleAIImport(file: File) {
    if (!EXTENSOES_ACEITAS_IA.has(file.type)) {
      setErro('Envie um arquivo .pdf ou .docx para a importação por IA.');
      return;
    }

    setErro(null);
    setIsAnalyzing(true);
    try {
      const fileBase64 = await arquivoParaBase64(file);
      const importarDietaIA = httpsCallable<
        { fileBase64: string; mimeType: string; fileName: string },
        RespostaImportarDietaIA
      >(getFunctionsCliente(), 'importarDietaIA');

      const { data: extraido } = await importarDietaIA({
        fileBase64,
        mimeType: file.type,
        fileName: file.name,
      });

      setTitulo(extraido.title);
      setRefeicoes(extraido.meals.map((refeicao) => ({ ...refeicao, id: crypto.randomUUID() })));
    } catch (falha) {
      console.error('[DoseCerta] falha ao importar dieta via IA', falha);
      setErro('Não foi possível importar o arquivo. Tente novamente ou preencha manualmente.');
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function salvar(evento: FormEvent) {
    evento.preventDefault();
    if (!uid) return;
    setErro(null);

    if (!titulo.trim()) {
      setErro('Informe um nome para o plano.');
      return;
    }
    const refeicoesValidas = refeicoes.filter((r) => r.name.trim());
    if (refeicoesValidas.length === 0) {
      setErro('Adicione ao menos uma refeição.');
      return;
    }

    setSalvando(true);
    try {
      await criarPlanoAlimentar(uid, {
        title: titulo.trim(),
        isActive: ativarPlano,
        meals: refeicoesValidas,
      });
      resetarForm();
      setIsCreatingPlan(false);
    } catch (falha) {
      console.error('[DoseCerta] falha ao criar plano alimentar', falha);
      setErro('Não foi possível salvar o plano. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(planoId: string) {
    if (!uid) return;
    try {
      await excluirPlanoAlimentar(uid, planoId);
    } catch (falha) {
      console.error('[DoseCerta] falha ao excluir plano alimentar', falha);
      setErro('Não foi possível excluir o plano. Tente novamente.');
    }
  }

  async function removerRefeicaoDoPlanoAtivo(refeicaoId: string) {
    if (!uid || !planoAtivo) return;
    setErroRefeicoes(null);
    setSalvandoRefeicaoId(refeicaoId);
    try {
      await atualizarPlanoAlimentar(uid, planoAtivo.id, {
        meals: planoAtivo.meals.filter((m) => m.id !== refeicaoId),
      });
    } catch (falha) {
      console.error('[DoseCerta] falha ao remover refeição', falha);
      setErroRefeicoes('Não foi possível remover a refeição. Tente novamente.');
    } finally {
      setSalvandoRefeicaoId(null);
    }
  }

  function iniciarEdicaoRefeicao(refeicao: Refeicao) {
    setEditandoRefeicaoId(refeicao.id);
    setRefeicaoEmEdicao({ ...refeicao });
  }

  function cancelarEdicaoRefeicao() {
    setEditandoRefeicaoId(null);
    setRefeicaoEmEdicao(null);
  }

  async function salvarEdicaoRefeicao() {
    if (!uid || !planoAtivo || !refeicaoEmEdicao) return;
    setErroRefeicoes(null);
    setSalvandoRefeicaoId(refeicaoEmEdicao.id);
    try {
      await atualizarPlanoAlimentar(uid, planoAtivo.id, {
        meals: planoAtivo.meals.map((m) => (m.id === refeicaoEmEdicao.id ? refeicaoEmEdicao : m)),
      });
      setEditandoRefeicaoId(null);
      setRefeicaoEmEdicao(null);
    } catch (falha) {
      console.error('[DoseCerta] falha ao salvar refeição', falha);
      setErroRefeicoes('Não foi possível salvar a refeição. Tente novamente.');
    } finally {
      setSalvandoRefeicaoId(null);
    }
  }

  async function adicionarRefeicaoAoPlanoAtivo() {
    if (!uid || !planoAtivo) return;
    if (!novaRefeicaoDraft.name.trim()) {
      setErroRefeicoes('Informe um nome para a refeição.');
      return;
    }
    setErroRefeicoes(null);
    setSalvandoRefeicaoId('nova');
    try {
      await atualizarPlanoAlimentar(uid, planoAtivo.id, {
        meals: [...planoAtivo.meals, { ...novaRefeicaoDraft, id: crypto.randomUUID() }],
      });
      setMostrandoNovaRefeicao(false);
      setNovaRefeicaoDraft(novaRefeicaoVazia());
    } catch (falha) {
      console.error('[DoseCerta] falha ao adicionar refeição', falha);
      setErroRefeicoes('Não foi possível adicionar a refeição. Tente novamente.');
    } finally {
      setSalvandoRefeicaoId(null);
    }
  }

  return (
    <Pagina
      layout="foco"
      hero={
        <Hero
          titulo="Plano Alimentar"
          esquerda={
            <CircleButton rotulo="Voltar" onClick={() => navegar('/evolucao')}>
              <IconeVoltar />
            </CircleButton>
          }
        >
          <div className="mt-6">
            <p className="t-caption text-on-hero-muted">Plano ativo</p>
            <h2 className="t-stat mt-1.5 text-on-hero">{planoAtivo?.title ?? 'Nenhum'}</h2>
          </div>
        </Hero>
      }
    >
      <SheetCard
        titulo="Plano Ativo"
        acao={
          <Button
            variante="secundaria"
            onClick={() => setIsCreatingPlan((v) => !v)}
          >
            {isCreatingPlan ? 'Cancelar' : 'Criar Novo Plano'}
          </Button>
        }
      >
        {isCreatingPlan ? null : carregando ? (
          <p className="t-label text-ink-muted">Carregando…</p>
        ) : planoAtivo ? (
          <div className="flex flex-col gap-3">
            <p className="t-title text-ink">{planoAtivo.title}</p>
            <ul className="divide-y" style={{ borderColor: 'var(--border-hair)' }}>
              {ordenarRefeicoesPorDiaEHorario(planoAtivo.meals).map((refeicao) =>
                editandoRefeicaoId === refeicao.id && refeicaoEmEdicao ? (
                  <li key={refeicao.id} className="flex flex-col gap-2 py-3">
                    <Field
                      rotulo="Nome"
                      value={refeicaoEmEdicao.name}
                      onChange={(e) =>
                        setRefeicaoEmEdicao({ ...refeicaoEmEdicao, name: e.target.value })
                      }
                    />
                    <Field
                      rotulo="Horário"
                      type="time"
                      value={refeicaoEmEdicao.time}
                      onChange={(e) =>
                        setRefeicaoEmEdicao({ ...refeicaoEmEdicao, time: e.target.value })
                      }
                    />
                    <Field
                      rotulo="Descrição"
                      value={refeicaoEmEdicao.description}
                      onChange={(e) =>
                        setRefeicaoEmEdicao({ ...refeicaoEmEdicao, description: e.target.value })
                      }
                    />
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        onClick={salvarEdicaoRefeicao}
                        disabled={salvandoRefeicaoId === refeicao.id}
                      >
                        {salvandoRefeicaoId === refeicao.id ? 'Salvando…' : 'Salvar'}
                      </Button>
                      <Button type="button" variante="fantasma" onClick={cancelarEdicaoRefeicao}>
                        Cancelar
                      </Button>
                    </div>
                  </li>
                ) : (
                  <li key={refeicao.id} className="flex items-center justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <p className="t-label text-ink">
                        {refeicao.name} · {refeicao.time}
                      </p>
                      {refeicao.description ? (
                        <p className="t-caption mt-0.5 text-ink-muted">{refeicao.description}</p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button
                        type="button"
                        variante="secundaria"
                        onClick={() => iniciarEdicaoRefeicao(refeicao)}
                      >
                        Editar
                      </Button>
                      <Button
                        type="button"
                        variante="fantasma"
                        disabled={salvandoRefeicaoId === refeicao.id}
                        onClick={() => removerRefeicaoDoPlanoAtivo(refeicao.id)}
                      >
                        {salvandoRefeicaoId === refeicao.id ? 'Excluindo…' : 'Excluir'}
                      </Button>
                    </div>
                  </li>
                ),
              )}
            </ul>

            {mostrandoNovaRefeicao ? (
              <div
                className="flex flex-col gap-2 border p-3"
                style={{ borderColor: 'var(--border-hair)', borderRadius: 'var(--r-field)' }}
              >
                <Field
                  rotulo="Nome"
                  value={novaRefeicaoDraft.name}
                  onChange={(e) => setNovaRefeicaoDraft({ ...novaRefeicaoDraft, name: e.target.value })}
                />
                <Field
                  rotulo="Horário"
                  type="time"
                  value={novaRefeicaoDraft.time}
                  onChange={(e) => setNovaRefeicaoDraft({ ...novaRefeicaoDraft, time: e.target.value })}
                />
                <Field
                  rotulo="Descrição"
                  value={novaRefeicaoDraft.description}
                  onChange={(e) =>
                    setNovaRefeicaoDraft({ ...novaRefeicaoDraft, description: e.target.value })
                  }
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    onClick={adicionarRefeicaoAoPlanoAtivo}
                    disabled={salvandoRefeicaoId === 'nova'}
                  >
                    {salvandoRefeicaoId === 'nova' ? 'Salvando…' : 'Salvar'}
                  </Button>
                  <Button
                    type="button"
                    variante="fantasma"
                    onClick={() => {
                      setMostrandoNovaRefeicao(false);
                      setNovaRefeicaoDraft(novaRefeicaoVazia());
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <Button type="button" variante="secundaria" onClick={() => setMostrandoNovaRefeicao(true)}>
                + Adicionar Refeição ao Plano
              </Button>
            )}

            {erroRefeicoes ? <Alerta tom="danger" titulo={erroRefeicoes} /> : null}
          </div>
        ) : (
          <p className="t-label text-ink-muted">Nenhum plano ativo no momento.</p>
        )}
      </SheetCard>

      {isCreatingPlan ? (
        <SheetCard titulo="Novo plano">
          <form onSubmit={salvar} className="flex flex-col gap-4">
            <div
              className="flex flex-col gap-2 border p-3"
              style={{ borderColor: 'var(--border-hair)', borderRadius: 'var(--r-field)' }}
            >
              <p className="t-caption text-ink-muted">Importar Dieta (IA)</p>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="file"
                  accept=".pdf,.docx"
                  onChange={(e) => setArquivoIA(e.target.files?.[0] ?? null)}
                  disabled={isAnalyzing}
                  className="t-label text-ink-muted"
                />
                <Button
                  type="button"
                  variante="secundaria"
                  disabled={!arquivoIA || isAnalyzing}
                  onClick={() => arquivoIA && handleAIImport(arquivoIA)}
                >
                  {isAnalyzing ? 'Analisando…' : 'Importar Dieta (IA)'}
                </Button>
              </div>
            </div>

            <Field rotulo="Nome do plano" value={titulo} onChange={(e) => setTitulo(e.target.value)} required />

            <label className="flex items-center gap-2 t-label text-ink">
              <input
                type="checkbox"
                checked={ativarPlano}
                onChange={(e) => setAtivarPlano(e.target.checked)}
                className="size-4"
              />
              Definir como Plano Ativo
            </label>

            <div className="flex flex-col gap-3">
              <p className="t-caption text-ink-muted">Refeições</p>
              {refeicoes.map((refeicao, indice) => (
                <div
                  key={refeicao.id}
                  className="flex flex-col gap-2 border p-3"
                  style={{ borderColor: 'var(--border-hair)', borderRadius: 'var(--r-field)' }}
                >
                  <Field
                    rotulo="Nome"
                    value={refeicao.name}
                    onChange={(e) => atualizarRefeicao(refeicao.id, 'name', e.target.value)}
                  />
                  <Field
                    rotulo="Horário"
                    type="time"
                    value={refeicao.time}
                    onChange={(e) => atualizarRefeicao(refeicao.id, 'time', e.target.value)}
                  />
                  <Field
                    rotulo="Descrição"
                    value={refeicao.description}
                    onChange={(e) => atualizarRefeicao(refeicao.id, 'description', e.target.value)}
                  />
                  {refeicoes.length > 1 ? (
                    <Button type="button" variante="fantasma" onClick={() => removerRefeicao(refeicao.id)}>
                      Remover refeição {indice + 1}
                    </Button>
                  ) : null}
                </div>
              ))}
              <Button type="button" variante="secundaria" onClick={adicionarRefeicao}>
                Adicionar Refeição
              </Button>
            </div>

            {erro ? <Alerta tom="danger" titulo={erro} /> : null}

            <Button type="submit" larguraTotal disabled={salvando}>
              {salvando ? 'Salvando…' : 'Salvar plano'}
            </Button>
          </form>
        </SheetCard>
      ) : null}

      <SheetCard titulo="Planos Anteriores/Inativos">
        {planosInativos.length === 0 ? (
          <p className="t-label text-ink-muted">Nenhum plano anterior.</p>
        ) : (
          <ul className="divide-y" style={{ borderColor: 'var(--border-hair)' }}>
            {planosInativos.map((plano) => (
              <li key={plano.id} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="t-label text-ink">{plano.title}</p>
                  <p className="t-caption text-ink-muted">
                    {plano.meals.length} {plano.meals.length === 1 ? 'refeição' : 'refeições'} ·{' '}
                    {plano.createdAt.toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <Button type="button" variante="fantasma" onClick={() => excluir(plano.id)}>
                  Excluir
                </Button>
              </li>
            ))}
          </ul>
        )}
      </SheetCard>
    </Pagina>
  );
}
