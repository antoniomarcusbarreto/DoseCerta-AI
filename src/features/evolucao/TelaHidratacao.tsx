import { useEffect, useRef, useState, type FormEvent } from 'react';
import { getDocs } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { Alerta } from '@/components/Alerta';
import { Button } from '@/components/Button';
import { CircleButton } from '@/components/CircleButton';
import { Field } from '@/components/Field';
import { Hero } from '@/components/Hero';
import { Pagina } from '@/components/Pagina';
import { SheetCard } from '@/components/SheetCard';
import { useDados } from '@/features/dados/DadosProvider';
import {
  atualizarMetaHidratacao,
  consultaHidratacaoHoje,
  consultaHistoricoPeso,
  criarRegistroHidratacao,
  excluirRegistroHidratacao,
} from '@/features/dados/repositorio';
import { refUsuario } from '@/lib/firestore';
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

/** Usada só quando a conta não tem nenhum peso registrado ainda, para a tela não ficar sem meta nenhuma. */
const META_PADRAO_ML = 2000;
const ML_POR_KG = 35;

export function TelaHidratacao() {
  const navegar = useNavigate();
  const { uid } = useDados();

  const refUsuarioAtual = uid ? refUsuario(uid) : null;
  const { dados: usuario, carregando: carregandoMeta } = useDocumento(refUsuarioAtual);

  const consulta = uid ? consultaHidratacaoHoje(uid) : null;
  const { dados: registrosHoje, carregando: carregandoHistorico } = useColecao(
    consulta,
    uid ? `${uid}/hydration_logs/hoje` : null,
  );

  const meta = usuario?.hydration_goal ?? null;

  const [valorPersonalizado, setValorPersonalizado] = useState('');
  const [metaEmEdicao, setMetaEmEdicao] = useState('');
  const [salvandoMeta, setSalvandoMeta] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Evita recalcular/gravar a meta em toda re-renderização enquanto a escrita
  // ainda não voltou pelo snapshot.
  const metaCalculada = useRef(false);

  useEffect(() => {
    if (!uid || carregandoMeta || meta !== null || metaCalculada.current) return;
    metaCalculada.current = true;

    (async () => {
      try {
        const ultimoPeso = await getDocs(consultaHistoricoPeso(uid, 1));
        const peso = ultimoPeso.docs[0]?.data().weight ?? null;
        const metaSugerida = peso ? Math.round(peso * ML_POR_KG) : META_PADRAO_ML;
        await atualizarMetaHidratacao(uid, metaSugerida);
      } catch (falha) {
        console.error('[DoseCerta] falha ao calcular meta de hidratação', falha);
      }
    })();
  }, [uid, carregandoMeta, meta]);

  if (!uid) return null;

  const consumoHoje = registrosHoje.reduce((soma, r) => soma + r.amount_ml, 0);
  const progresso = meta ? Math.min(100, Math.round((consumoHoje / meta) * 100)) : 0;

  async function adicionar(amount_ml: number) {
    if (!uid || amount_ml <= 0) return;
    setErro(null);
    try {
      await criarRegistroHidratacao(uid, { amount_ml, recordedAt: new Date() });
    } catch (falha) {
      console.error('[DoseCerta] falha ao registrar hidratação', falha);
      setErro('Não foi possível salvar o registro. Tente novamente.');
    }
  }

  async function aoAdicionarPersonalizado(evento: FormEvent) {
    evento.preventDefault();
    const quantidade = Number(valorPersonalizado);
    if (!Number.isFinite(quantidade) || quantidade <= 0) {
      setErro('Informe uma quantidade válida.');
      return;
    }
    await adicionar(quantidade);
    setValorPersonalizado('');
  }

  async function excluir(registroId: string) {
    if (!uid) return;
    try {
      await excluirRegistroHidratacao(uid, registroId);
    } catch (falha) {
      console.error('[DoseCerta] falha ao excluir registro de hidratação', falha);
      setErro('Não foi possível excluir o registro. Tente novamente.');
    }
  }

  async function aoSalvarMeta(evento: FormEvent) {
    evento.preventDefault();
    if (!uid) return;
    const novaMeta = Number(metaEmEdicao);
    if (!Number.isFinite(novaMeta) || novaMeta <= 0) {
      setErro('Informe uma meta válida.');
      return;
    }
    setErro(null);
    setSalvandoMeta(true);
    try {
      await atualizarMetaHidratacao(uid, Math.round(novaMeta));
      setMetaEmEdicao('');
    } catch (falha) {
      console.error('[DoseCerta] falha ao salvar meta de hidratação', falha);
      setErro('Não foi possível salvar a meta. Tente novamente.');
    } finally {
      setSalvandoMeta(false);
    }
  }

  return (
    <Pagina
      layout="foco"
      hero={
        <Hero
          titulo="Hidratação"
          esquerda={
            <CircleButton rotulo="Voltar" onClick={() => navegar('/evolucao')}>
              <IconeVoltar />
            </CircleButton>
          }
        >
          <div className="mt-6">
            <p className="t-caption text-on-hero-muted">Consumo de hoje</p>
            <h2 className="t-stat mt-1.5 text-on-hero">
              {consumoHoje.toLocaleString('pt-BR')} ml
              {meta ? ` / ${meta.toLocaleString('pt-BR')} ml` : ''}
            </h2>
          </div>
        </Hero>
      }
    >
      <SheetCard titulo="Progresso">
        <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          <div
            className="h-full rounded-full bg-blue-500 transition-all"
            style={{ width: `${progresso}%` }}
          />
        </div>
        <p className="t-label mt-2 text-ink-muted">{progresso}% da meta diária</p>

        <form onSubmit={aoSalvarMeta} className="mt-4 flex items-end gap-2">
          <Field
            className="flex-1"
            rotulo="Editar meta (ml)"
            type="number"
            step="50"
            placeholder={meta ? String(meta) : ''}
            value={metaEmEdicao}
            onChange={(e) => setMetaEmEdicao(e.target.value)}
          />
          <Button type="submit" variante="secundaria" disabled={salvandoMeta}>
            {salvandoMeta ? 'Salvando…' : 'Salvar'}
          </Button>
        </form>
      </SheetCard>

      <SheetCard titulo="Registrar consumo">
        <div className="flex flex-col gap-4">
          <div className="flex gap-3">
            <Button type="button" larguraTotal onClick={() => adicionar(250)}>
              + 250ml (Copo)
            </Button>
            <Button type="button" larguraTotal onClick={() => adicionar(500)}>
              + 500ml (Garrafa)
            </Button>
          </div>

          <form onSubmit={aoAdicionarPersonalizado} className="flex items-end gap-2">
            <Field
              className="flex-1"
              rotulo="Valor personalizado (ml)"
              type="number"
              step="1"
              value={valorPersonalizado}
              onChange={(e) => setValorPersonalizado(e.target.value)}
            />
            <Button type="submit" variante="secundaria">
              Adicionar
            </Button>
          </form>

          {erro ? <Alerta tom="danger" titulo={erro} /> : null}
        </div>
      </SheetCard>

      <SheetCard titulo="Histórico de hoje">
        {carregandoHistorico ? (
          <p className="t-label text-ink-muted">Carregando…</p>
        ) : registrosHoje.length === 0 ? (
          <p className="t-label text-ink-muted">Nenhum registro hoje ainda.</p>
        ) : (
          <ul className="divide-y" style={{ borderColor: 'var(--border-hair)' }}>
            {registrosHoje.map((registro) => (
              <li key={registro.id} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="t-label text-ink">{registro.amount_ml.toLocaleString('pt-BR')} ml</p>
                  <p className="t-caption text-ink-muted">
                    {registro.recordedAt.toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                <Button type="button" variante="fantasma" onClick={() => excluir(registro.id)}>
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
