import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alerta } from '@/components/Alerta';
import { Button } from '@/components/Button';
import { CircleButton } from '@/components/CircleButton';
import { Hero } from '@/components/Hero';
import { Pagina } from '@/components/Pagina';
import { SheetCard } from '@/components/SheetCard';
import { formatarHorario, nomeDiaSemana } from '@/domain/datas';
import { atualizarProtocolo, criarProtocolo, sincronizarAgenda } from '@/features/dados/repositorio';
import { useDados } from '@/features/dados/DadosProvider';
import type { Protocolo } from '@/domain/tipos';
import { FormProtocolo } from './FormProtocolo';

type Modo = 'ver' | 'ajustar' | 'mudar_dose';

function descreverEsquema(p: Protocolo): string {
  const quando =
    p.frequencia === 'semanal' && p.diaSemana !== null
      ? `toda ${nomeDiaSemana(p.diaSemana)}`
      : 'todo dia';
  return `${quando}, às ${formatarHorario(p.horarioMin)}`;
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

/**
 * Ver e alterar o tratamento.
 *
 * A distinção que a tela sustenta: mudar de dose é um degrau de titulação e
 * cria um protocolo novo, arquivando o anterior — assim as aplicações antigas
 * continuam apontando para o que valia na época, e dá para cruzar a data da
 * mudança com peso e efeito colateral. Já ajustar horário ou dia da semana não
 * é degrau nenhum, então edita no lugar.
 */
export function TelaTratamento() {
  const { uid, protocolo, protocolos, aplicacoes, medicamentos, medicamentosCarregando } =
    useDados();
  const navegar = useNavigate();
  const [modo, setModo] = useState<Modo>('ver');

  if (!uid || !protocolo) return null;

  const arquivados = protocolos.filter((p) => !p.ativo);

  return (
    <Pagina
      /* Editar é tarefa única: o formulário fica na coluna estreita em
         qualquer tela, porque espalhar seis campos por 1120px piora. */
      layout={modo === 'ver' ? 'painel' : 'foco'}
      hero={
        <Hero
          titulo="Tratamento"
          esquerda={
            <CircleButton rotulo="Voltar" onClick={() => navegar('/ajustes')}>
              <IconeVoltar />
            </CircleButton>
          }
        >
          <div className="mt-6">
            <p className="t-caption text-on-hero-muted">Em vigor</p>
            <h2 className="t-stat mt-1.5 text-on-hero">
              {protocolo.medicamento} {protocolo.doseAtualMg.toLocaleString('pt-BR')} mg
            </h2>
            <p className="t-body mt-2 text-on-hero-muted">{descreverEsquema(protocolo)}</p>
          </div>
        </Hero>
      }
      /* "Degraus anteriores" já era o último bloco da tela, então mandá-lo
         para a coluna de apoio não muda o empilhamento do celular. */
      lateral={
        modo === 'ver' && arquivados.length > 0 ? (
          <SheetCard titulo="Degraus anteriores" subtitulo={`${arquivados.length} arquivado(s)`}>
            <ul className="divide-y" style={{ borderColor: 'var(--border-hair)' }}>
              {arquivados.map((p) => (
                <li key={p.id} className="flex items-baseline justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="t-label text-ink">
                      {p.medicamento} {p.doseAtualMg.toLocaleString('pt-BR')} mg
                    </p>
                    <p className="t-label text-ink-muted">{descreverEsquema(p)}</p>
                  </div>
                  <span className="t-caption shrink-0 text-ink-muted">
                    {p.criadoEm.toLocaleDateString('pt-BR')}
                  </span>
                </li>
              ))}
            </ul>
          </SheetCard>
        ) : null
      }
    >
      {modo === 'ver' ? (
        <>
          <SheetCard titulo="Detalhes">
            <dl className="divide-y" style={{ borderColor: 'var(--border-hair)' }}>
              {[
                ['Medicamento', protocolo.medicamento],
                ['Dose', `${protocolo.doseAtualMg.toLocaleString('pt-BR')} mg`],
                [
                  'Frequência',
                  protocolo.frequencia === 'semanal'
                    ? `Semanal · ${nomeDiaSemana(protocolo.diaSemana ?? 0)}`
                    : 'Diária',
                ],
                ['Horário', formatarHorario(protocolo.horarioMin)],
                ['Janela para repor dose', `${protocolo.diasLimiteReposicao} dia(s)`],
                ['Iniciado em', protocolo.iniciadoEm.toLocaleDateString('pt-BR')],
              ].map(([rotulo, valor]) => (
                <div key={rotulo} className="flex items-baseline justify-between gap-4 py-3">
                  <dt className="t-label text-ink-muted">{rotulo}</dt>
                  <dd className="t-label text-right text-ink">{valor}</dd>
                </div>
              ))}
            </dl>
          </SheetCard>

          <SheetCard titulo="Alterar">
            <div className="space-y-3">
              <Button larguraTotal onClick={() => setModo('mudar_dose')}>
                Mudar a dose
              </Button>
              <p className="t-label text-ink-muted">
                Cria um novo degrau do tratamento e arquiva o atual. O histórico de aplicações
                continua apontando para a dose que valia em cada época.
              </p>

              <Button variante="secundaria" larguraTotal onClick={() => setModo('ajustar')}>
                Ajustar dia e horário
              </Button>
              <p className="t-label text-ink-muted">
                Corrige o esquema no protocolo atual, sem criar um degrau novo.
              </p>
            </div>
          </SheetCard>

        </>
      ) : null}

      {modo === 'mudar_dose' ? (
        <SheetCard titulo="Mudar a dose" subtitulo="Cria um novo degrau do tratamento">
          <Alerta tom="warn" titulo="Só mude a dose conforme a prescrição">
            O app registra a mudança, não a indica.
          </Alerta>
          <div className="mt-4">
            <FormProtocolo
              inicial={protocolo}
              medicamentos={medicamentos}
              carregandoMedicamentos={medicamentosCarregando}
              rotuloEnvio="Registrar novo degrau"
              onCancelar={() => setModo('ver')}
              onEnviar={async (valores) => {
                await criarProtocolo(
                  uid,
                  { ...valores, planoTitulacao: [], iniciadoEm: new Date() },
                  // O histórico entra no cálculo: sem ele a agenda marcaria a
                  // próxima ocorrência do dia-alvo mesmo tendo havido
                  // aplicação ontem, encurtando o intervalo.
                  aplicacoes,
                );
                setModo('ver');
              }}
            />
          </div>
        </SheetCard>
      ) : null}

      {modo === 'ajustar' ? (
        <SheetCard titulo="Ajustar dia e horário" subtitulo="Sem criar um degrau novo">
          <FormProtocolo
            inicial={protocolo}
            medicamentos={medicamentos}
            carregandoMedicamentos={medicamentosCarregando}
            travarMedicacao
            rotuloEnvio="Salvar ajuste"
            onCancelar={() => setModo('ver')}
            onEnviar={async (valores) => {
              const atualizado: Protocolo = {
                ...protocolo,
                frequencia: valores.frequencia,
                diaSemana: valores.diaSemana,
                horarioMin: valores.horarioMin,
                diasLimiteReposicao: valores.diasLimiteReposicao,
              };
              await atualizarProtocolo(uid, protocolo.id, {
                frequencia: atualizado.frequencia,
                diaSemana: atualizado.diaSemana,
                horarioMin: atualizado.horarioMin,
                diasLimiteReposicao: atualizado.diasLimiteReposicao,
              });
              // Mudar o dia ou o horário move a próxima dose: sem
              // ressincronizar, o lembrete dispararia na data velha.
              await sincronizarAgenda(uid, atualizado, aplicacoes);
              setModo('ver');
            }}
          />
        </SheetCard>
      ) : null}
    </Pagina>
  );
}
