import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alerta } from '@/components/Alerta';
import { Button } from '@/components/Button';
import { CircleButton } from '@/components/CircleButton';
import { Field } from '@/components/Field';
import { Hero } from '@/components/Hero';
import { Pagina } from '@/components/Pagina';
import { SheetCard } from '@/components/SheetCard';
import { useConfirm } from '@/contexts/ConfirmContext';
import { calcularMetaHidratacao } from '@/domain/hidratacao';
import { calcularImc, deltaPeso } from '@/domain/medidas';
import type { RegistroPeso } from '@/domain/tipos';
import { useDados } from '@/features/dados/DadosProvider';
import { useEvolucao } from '@/features/dados/DadosEvolucaoProvider';
import {
  atualizarAltura,
  atualizarMetaHidratacao,
  atualizarRegistroPeso,
  criarRegistroPeso,
  excluirRegistroPeso,
} from '@/features/dados/repositorio';
import { refUsuario } from '@/lib/firestore';
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

const IconeEditar = () => (
  <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
    <path
      d="M4 20h4L18.5 9.5a2.121 2.121 0 0 0-3-3L5 17v3Z M14.5 8l2 2"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const IconeExcluir = () => (
  <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
    <path
      d="M5 7h14M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0-.8 12.2A2 2 0 0 1 14.2 21H9.8a2 2 0 0 1-2-1.8L7 7m3 4v6m4-6v6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/** Arredonda para 1 casa decimal, evitando o drift de float de 70.1 + 0.1. */
function arredondar1Casa(valor: number): number {
  return Math.round(valor * 10) / 10;
}

/**
 * Registro de peso e medidas.
 *
 * Altura é progressive profiling: só pede uma vez, na primeira ausência do
 * campo `height` no doc raiz do usuário — depois disso fica escondida e só
 * entra em cálculo em background.
 */
export function TelaPesosMedidas() {
  const navegar = useNavigate();
  const { uid } = useDados();
  const { askConfirm } = useConfirm();

  const refUsuarioAtual = uid ? refUsuario(uid) : null;
  const { dados: usuario, carregando: carregandoAltura } = useDocumento(refUsuarioAtual);

  const { historicoPeso, historicoPesoCarregando: carregandoHistorico } = useEvolucao();
  // O provider já busca as 30 últimas pesagens (ordenadas do mais recente ao
  // mais antigo) para o gráfico de evolução; esta lista só mostra as 5 mais
  // recentes, então reaproveita o mesmo listener em vez de abrir outro.
  const historico = historicoPeso.slice(0, 5);

  const alturaSalva = usuario?.height ?? null;
  const precisaAltura = !carregandoAltura && alturaSalva === null;

  const [peso, setPeso] = useState('');
  const [cintura, setCintura] = useState('');
  const [altura, setAltura] = useState('');
  const [notas, setNotas] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sugestaoMetaAgua, setSugestaoMetaAgua] = useState<number | null>(null);
  const [registroEmEdicao, setRegistroEmEdicao] = useState<RegistroPeso | null>(null);

  if (!uid) return null;

  const pesoNum = Number(peso);
  const alturaM = precisaAltura ? Number(altura) : (alturaSalva ?? 0);
  const imc = pesoNum > 0 && alturaM > 0 ? calcularImc(pesoNum, alturaM) : null;

  const ultimoPeso = historico[0]?.weight ?? null;
  const delta = ultimoPeso !== null && pesoNum > 0 ? deltaPeso(pesoNum, ultimoPeso) : null;

  function ajustarPeso(passo: number) {
    setPeso((atual) => arredondar1Casa(Number(atual || '0') + passo).toString());
  }

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault();
    if (!uid) return;
    setErro(null);

    if (!Number.isFinite(pesoNum) || pesoNum <= 0) {
      setErro('Informe um peso válido.');
      return;
    }
    if (!registroEmEdicao && precisaAltura && (!Number.isFinite(alturaM) || alturaM <= 0)) {
      setErro('Informe a altura.');
      return;
    }

    setSalvando(true);
    try {
      if (!registroEmEdicao && precisaAltura) {
        await atualizarAltura(uid, alturaM);
      }

      const camposRegistro = {
        weight: pesoNum,
        waist: cintura ? Number(cintura) : null,
        notes: notas || null,
      };

      if (registroEmEdicao) {
        await atualizarRegistroPeso(uid, registroEmEdicao.id, camposRegistro);
        setRegistroEmEdicao(null);
      } else {
        await criarRegistroPeso(uid, { ...camposRegistro, recordedAt: new Date() });
      }

      setPeso('');
      setCintura('');
      setAltura('');
      setNotas('');

      const metaSugerida = calcularMetaHidratacao(pesoNum);
      if (metaSugerida !== (usuario?.hydration_goal ?? null)) {
        if (usuario?.metaEditadaManualmente) {
          // Meta foi curada pela pessoa (possível orientação médica): só sugere, não sobrescreve.
          setSugestaoMetaAgua(metaSugerida);
        } else {
          await atualizarMetaHidratacao(uid, metaSugerida, false);
        }
      }
    } catch (falha) {
      console.error('[DoseCerta] falha ao registrar peso', falha);
      setErro(
        registroEmEdicao
          ? 'Não foi possível atualizar o registro. Tente novamente.'
          : 'Não foi possível salvar o registro. Tente novamente.',
      );
    } finally {
      setSalvando(false);
    }
  }

  async function aceitarRecalculoMetaAgua() {
    if (!uid || sugestaoMetaAgua === null) return;
    try {
      await atualizarMetaHidratacao(uid, sugestaoMetaAgua, false);
      setSugestaoMetaAgua(null);
    } catch (falha) {
      console.error('[DoseCerta] falha ao recalcular meta de hidratação', falha);
      setErro('Não foi possível atualizar a meta de água. Tente novamente.');
    }
  }

  function iniciarEdicao(registro: RegistroPeso) {
    setErro(null);
    setRegistroEmEdicao(registro);
    setPeso(registro.weight.toString());
    setCintura(registro.waist !== null ? registro.waist.toString() : '');
    setNotas(registro.notes ?? '');
  }

  function cancelarEdicao() {
    setRegistroEmEdicao(null);
    setPeso('');
    setCintura('');
    setNotas('');
    setErro(null);
  }

  function confirmarExclusao(registro: RegistroPeso) {
    askConfirm({
      title: 'Excluir registro',
      message: `Excluir o registro de ${registro.weight.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg de ${registro.recordedAt.toLocaleDateString('pt-BR')}? Essa ação não pode ser desfeita.`,
      confirmText: 'Excluir',
      onConfirm: async () => {
        if (!uid) return;
        try {
          await excluirRegistroPeso(uid, registro.id);
          if (registroEmEdicao?.id === registro.id) {
            cancelarEdicao();
          }
        } catch (falha) {
          console.error('[DoseCerta] falha ao excluir registro de peso', falha);
          setErro('Não foi possível excluir o registro. Tente novamente.');
        }
      },
    });
  }

  return (
    <Pagina
      layout="foco"
      hero={
        <Hero
          titulo="Peso e Medidas"
          esquerda={
            <CircleButton rotulo="Voltar" onClick={() => navegar('/evolucao')}>
              <IconeVoltar />
            </CircleButton>
          }
        >
          <div className="mt-6">
            <p className="t-caption text-on-hero-muted">Registro de hoje</p>
            <h2 className="t-stat mt-1.5 text-on-hero">
              {imc !== null ? `IMC ${imc.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}` : '—'}
            </h2>
            {delta !== null ? (
              <p className="t-body mt-2 text-on-hero-muted">
                {delta === 0
                  ? 'Sem alteração desde o último registro'
                  : delta > 0
                    ? `Ganhou ${Math.abs(delta).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}kg`
                    : `Perdeu ${Math.abs(delta).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}kg`}
              </p>
            ) : null}
          </div>
        </Hero>
      }
    >
      <SheetCard titulo="Novo registro">
        <form onSubmit={aoEnviar} className="flex flex-col gap-4">
          {precisaAltura ? (
            <Field
              rotulo="Altura (m)"
              type="number"
              step="0.01"
              placeholder="1,75"
              required
              value={altura}
              onChange={(e) => setAltura(e.target.value)}
            />
          ) : null}

          <div className="flex items-end gap-2">
            <Field
              className="flex-1"
              rotulo="Peso (kg)"
              type="number"
              step="0.1"
              required
              value={peso}
              onChange={(e) => setPeso(e.target.value)}
            />
            <Button type="button" variante="secundaria" onClick={() => ajustarPeso(-0.1)}>
              -0.1
            </Button>
            <Button type="button" variante="secundaria" onClick={() => ajustarPeso(0.1)}>
              +0.1
            </Button>
          </div>

          <Field
            rotulo="Cintura (cm)"
            type="number"
            step="0.1"
            value={cintura}
            onChange={(e) => setCintura(e.target.value)}
          />

          <Field
            rotulo="Notas"
            type="text"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
          />

          {erro ? <Alerta tom="danger" titulo={erro} /> : null}

          <div className="flex gap-2">
            <Button type="submit" larguraTotal disabled={salvando}>
              {registroEmEdicao
                ? salvando
                  ? 'Atualizando…'
                  : 'Atualizar registro'
                : salvando
                  ? 'Salvando…'
                  : 'Salvar registro'}
            </Button>
            {registroEmEdicao ? (
              <Button type="button" variante="fantasma" onClick={cancelarEdicao}>
                Cancelar
              </Button>
            ) : null}
          </div>
        </form>

        {sugestaoMetaAgua !== null ? (
          <div className="mt-4">
            <Alerta tom="warn" titulo="Seu peso mudou. Deseja recalcular sua meta de água?">
              <p>
                Nova meta sugerida: {sugestaoMetaAgua.toLocaleString('pt-BR')} ml/dia. Sua meta atual
                foi definida manualmente e não será alterada sem sua confirmação.
              </p>
              <div className="mt-3 flex gap-2">
                <Button type="button" variante="secundaria" onClick={aceitarRecalculoMetaAgua}>
                  Recalcular
                </Button>
                <Button type="button" variante="fantasma" onClick={() => setSugestaoMetaAgua(null)}>
                  Manter minha meta
                </Button>
              </div>
            </Alerta>
          </div>
        ) : null}
      </SheetCard>

      <SheetCard titulo="Últimos registros">
        {carregandoHistorico ? (
          <p className="t-label text-ink-muted">Carregando…</p>
        ) : historico.length === 0 ? (
          <p className="t-label text-ink-muted">Nenhum registro ainda.</p>
        ) : (
          <ul className="divide-y" style={{ borderColor: 'var(--border-hair)' }}>
            {historico.map((registro) => (
              <li
                key={registro.id}
                className="grid grid-cols-[1fr_auto_auto] items-center gap-3 py-3"
              >
                <div className="min-w-0">
                  <p className="t-label text-ink">
                    {registro.weight.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg
                    {registro.waist !== null
                      ? ` · cintura ${registro.waist.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} cm`
                      : ''}
                  </p>
                  {registro.notes ? (
                    <p className="t-label text-ink-muted">{registro.notes}</p>
                  ) : null}
                </div>
                <span className="t-caption shrink-0 text-ink-muted">
                  {registro.recordedAt.toLocaleDateString('pt-BR')}
                </span>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    aria-label="Editar registro"
                    onClick={() => iniciarEdicao(registro)}
                    className="flex size-11 items-center justify-center rounded-full text-ink-muted transition-opacity hover:opacity-70"
                  >
                    <IconeEditar />
                  </button>
                  <button
                    type="button"
                    aria-label="Excluir registro"
                    onClick={() => confirmarExclusao(registro)}
                    className="flex size-11 items-center justify-center rounded-full text-ink-muted transition-opacity hover:opacity-70"
                  >
                    <IconeExcluir />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SheetCard>
    </Pagina>
  );
}
