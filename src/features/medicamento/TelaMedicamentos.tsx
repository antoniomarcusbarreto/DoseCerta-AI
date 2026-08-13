import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alerta } from '@/components/Alerta';
import { Button } from '@/components/Button';
import { CircleButton } from '@/components/CircleButton';
import { Hero } from '@/components/Hero';
import { Pagina } from '@/components/Pagina';
import { SheetCard } from '@/components/SheetCard';
import { formatarDoses, usosDoMedicamento } from '@/domain/catalogo';
import { useDados } from '@/features/dados/DadosProvider';
import {
  atualizarMedicamento,
  criarMedicamento,
  excluirMedicamento,
  reporCatalogo,
} from '@/features/dados/repositorio';
import type { Medicamento } from '@/domain/tipos';
import { FormMedicamento } from './FormMedicamento';

type Modo =
  | { tipo: 'lista' }
  | { tipo: 'novo' }
  | { tipo: 'editar'; medicamento: Medicamento }
  | { tipo: 'excluir'; medicamento: Medicamento };

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

function descreverMedicamento(m: Medicamento): string {
  const partes = [m.principioAtivo, formatarDoses(m.dosesMg)].filter(Boolean);
  return partes.join(' · ');
}

/**
 * Catálogo de medicamentos da conta.
 *
 * A lista chega semeada com as canetas mais usadas, mas daí em diante é toda
 * do usuário: dá para editar qualquer uma, criar as suas e excluir o que não
 * usa. Excluir nunca é bloqueado — protocolo e caneta guardam o nome
 * denormalizado, então o histórico continua legível de qualquer jeito.
 */
export function TelaMedicamentos() {
  const { uid, medicamentos, medicamentosCarregando, protocolos, canetas } = useDados();
  const navegar = useNavigate();
  const [modo, setModo] = useState<Modo>({ tipo: 'lista' });
  const [excluindo, setExcluindo] = useState(false);
  const [repondo, setRepondo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (!uid) return null;

  async function comErro(acao: () => Promise<void>, mensagem: string) {
    setErro(null);
    try {
      await acao();
    } catch (falha) {
      console.error('[DoseCerta] falha no catálogo:', falha);
      setErro(mensagem);
    }
  }

  return (
    <Pagina
      /* Cadastrar/editar/excluir são tarefas únicas: a coluna estreita vale
         em qualquer tela. Só a lista se comporta como painel. */
      layout={modo.tipo === 'lista' ? 'painel' : 'foco'}
      hero={
        <Hero
          titulo="Medicamentos"
          esquerda={
            <CircleButton rotulo="Voltar" onClick={() => navegar('/ajustes')}>
              <IconeVoltar />
            </CircleButton>
          }
        >
          <div className="mt-6">
            <p className="t-caption text-on-hero-muted">No seu catálogo</p>
            <h2 className="t-stat mt-1.5 text-on-hero">
              {medicamentosCarregando ? '—' : medicamentos.length}
            </h2>
            <p className="t-body mt-2 text-on-hero-muted">
              Ficam disponíveis para escolher ao cadastrar o tratamento.
            </p>
          </div>
        </Hero>
      }
    >
      {erro ? (
        <SheetCard>
          <Alerta tom="danger" titulo={erro} />
        </SheetCard>
      ) : null}

      {modo.tipo === 'lista' ? (
        <SheetCard
          titulo="Seus medicamentos"
          acao={
            <Button variante="fantasma" onClick={() => setModo({ tipo: 'novo' })}>
              Adicionar
            </Button>
          }
        >
          {medicamentosCarregando && medicamentos.length === 0 ? (
            <p className="t-label text-ink-muted">Carregando…</p>
          ) : medicamentos.length === 0 ? (
            <div className="space-y-3">
              <p className="t-label text-ink-muted">
                Seu catálogo está vazio. Cadastre um medicamento ou reponha a lista original
                de canetas.
              </p>
              <Button larguraTotal onClick={() => setModo({ tipo: 'novo' })}>
                Cadastrar medicamento
              </Button>
              <Button
                variante="secundaria"
                larguraTotal
                disabled={repondo}
                onClick={() => {
                  setRepondo(true);
                  void comErro(
                    () => reporCatalogo(uid),
                    'Não foi possível repor a lista agora.',
                  ).finally(() => setRepondo(false));
                }}
              >
                {repondo ? 'Repondo…' : 'Repor a lista original'}
              </Button>
            </div>
          ) : (
            <ul className="divide-y" style={{ borderColor: 'var(--border-hair)' }}>
              {medicamentos.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="t-label text-ink">{m.nome}</p>
                    <p className="t-label mt-0.5 text-ink-muted">{descreverMedicamento(m)}</p>
                    {m.nota ? (
                      <p className="t-caption mt-0.5 text-ink-faint">{m.nota}</p>
                    ) : null}
                  </div>
                  <Button
                    variante="fantasma"
                    onClick={() => setModo({ tipo: 'editar', medicamento: m })}
                  >
                    Editar
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </SheetCard>
      ) : null}

      {modo.tipo === 'novo' ? (
        <SheetCard titulo="Novo medicamento">
          <FormMedicamento
            rotuloEnvio="Cadastrar"
            onCancelar={() => setModo({ tipo: 'lista' })}
            onEnviar={async (valores) => {
              await criarMedicamento(uid, { ...valores, catalogoId: null });
              setModo({ tipo: 'lista' });
            }}
          />
        </SheetCard>
      ) : null}

      {modo.tipo === 'editar' ? (
        <>
          <SheetCard titulo="Editar medicamento" subtitulo={modo.medicamento.nome}>
            <FormMedicamento
              inicial={modo.medicamento}
              rotuloEnvio="Salvar"
              onCancelar={() => setModo({ tipo: 'lista' })}
              onEnviar={async (valores) => {
                // `catalogoId` fica de fora do Partial de propósito: editar um
                // item semeado não apaga a proveniência dele.
                await atualizarMedicamento(uid, modo.medicamento.id, valores);
                setModo({ tipo: 'lista' });
              }}
            />
          </SheetCard>

          <SheetCard titulo="Excluir">
            <Button
              variante="secundaria"
              larguraTotal
              style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
              onClick={() => setModo({ tipo: 'excluir', medicamento: modo.medicamento })}
            >
              Excluir medicamento
            </Button>
          </SheetCard>
        </>
      ) : null}

      {modo.tipo === 'excluir'
        ? (() => {
            const alvo = modo.medicamento;
            const usos = usosDoMedicamento(alvo, protocolos, canetas);

            return (
              <SheetCard titulo="Excluir medicamento" subtitulo={alvo.nome}>
                <div className="space-y-4">
                  {usos.noProtocoloAtivo ? (
                    <Alerta tom="warn" titulo="Este medicamento está no seu tratamento em vigor">
                      Excluir aqui não altera o tratamento nem o histórico — só tira o item
                      desta lista, e ele deixa de aparecer para escolher.
                    </Alerta>
                  ) : usos.protocolos > 0 || usos.canetas > 0 ? (
                    <Alerta tom="warn" titulo="Este medicamento aparece em registros seus">
                      Excluir não altera nada do que já foi registrado — só tira o item desta
                      lista.
                    </Alerta>
                  ) : null}

                  <p className="t-label text-ink-muted">
                    {alvo.catalogoId
                      ? 'Este veio da lista original. Depois de excluído, ele não volta sozinho — mas dá para repor a lista inteira quando o catálogo ficar vazio.'
                      : 'Você cadastrou este medicamento. Depois de excluído, precisará cadastrá-lo de novo.'}
                  </p>

                  <div className="flex gap-3">
                    <Button
                      variante="secundaria"
                      disabled={excluindo}
                      onClick={() => setModo({ tipo: 'lista' })}
                    >
                      Cancelar
                    </Button>
                    <Button
                      variante="secundaria"
                      larguraTotal
                      disabled={excluindo}
                      style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
                      onClick={() => {
                        setExcluindo(true);
                        void comErro(
                          async () => {
                            await excluirMedicamento(uid, alvo.id);
                            setModo({ tipo: 'lista' });
                          },
                          'Não foi possível excluir agora. Verifique a conexão.',
                        ).finally(() => setExcluindo(false));
                      }}
                    >
                      {excluindo ? 'Excluindo…' : 'Excluir'}
                    </Button>
                  </div>
                </div>
              </SheetCard>
            );
          })()
        : null}
    </Pagina>
  );
}
