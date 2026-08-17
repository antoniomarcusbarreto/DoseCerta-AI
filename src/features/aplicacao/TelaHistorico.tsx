import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Alerta } from '@/components/Alerta';
import { Button } from '@/components/Button';
import { HairlineChart, type PontoHairline } from '@/components/HairlineChart';
import { Hero } from '@/components/Hero';
import { Pagina } from '@/components/Pagina';
import { SheetCard } from '@/components/SheetCard';
import { StatBig } from '@/components/StatBig';
import { condutaDoseEsquecida, descreverLocal } from '@/domain/aplicacao';
import { formatarData, formatarHorario, nomeDiaSemana } from '@/domain/datas';
import { FolhaRegistro } from '@/features/aplicacao/FolhaRegistro';
import { excluirAplicacao } from '@/features/dados/repositorio';
import { useDados } from '@/features/dados/DadosProvider';

/**
 * Central de gerenciamento da caneta: registrar, ver o tratamento em vigor e
 * o histórico completo. Herda o conteúdo que antes vivia espalhado na Home —
 * juntar tudo aqui deixa "Início" livre para ser o dashboard diário.
 */
export function TelaHistorico() {
  const { uid, protocolo, aplicacoes, canetaAtiva, status } = useDados();
  const [registrando, setRegistrando] = useState(false);
  const [excluindo, setExcluindo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  if (!uid) return null;

  const aplicadas = aplicacoes.filter((a) => a.status === 'aplicada');
  const puladas = aplicacoes.length - aplicadas.length;
  const ultima = aplicadas[0] ?? null;

  const atrasada = status?.estado === 'atrasada';
  const conduta = atrasada && protocolo ? condutaDoseEsquecida(protocolo, status.diasAtraso) : null;

  // Altura = dose: mostra a titulação subindo e uma dose pulada como falha.
  const serie: PontoHairline[] = [...aplicacoes]
    .sort((a, b) => a.dataHora.getTime() - b.dataHora.getTime())
    .slice(-16)
    .map((a) => ({
      rotulo: formatarData(a.dataHora),
      valor: a.status === 'aplicada' ? a.doseMg : 0,
      detalhe:
        a.status === 'pulada'
          ? 'Pulada'
          : `${a.doseMg.toLocaleString('pt-BR')} mg${a.local ? ` — ${descreverLocal(a.local)}` : ''}`,
    }));

  async function remover(id: string) {
    setErro(null);
    setExcluindo(id);
    try {
      await excluirAplicacao(
        uid!,
        id,
        protocolo,
        aplicacoes.filter((a) => a.id !== id),
      );
    } catch (falha) {
      console.error('[DoseCerta] falha ao excluir aplicação:', falha);
      setErro('Não foi possível excluir agora. Tente de novo.');
    } finally {
      setExcluindo(null);
    }
  }

  return (
    <>
      <Pagina
        hero={
          <Hero
            titulo="Aplicações"
            tom={atrasada ? 'alerta' : 'padrao'}
            aside={
              serie.length >= 3 ? (
                <div className="mt-6 lg:mt-0">
                  <HairlineChart pontos={serie} sobre="hero" maxRotulos={5} />
                </div>
              ) : null
            }
            acoes={
              protocolo ? (
                <div className="mt-6">
                  <Button
                    sobre="hero"
                    larguraTotal
                    className="lg:w-auto"
                    onClick={() => setRegistrando(true)}
                  >
                    Registrar aplicação
                  </Button>
                </div>
              ) : null
            }
          >
            <div className="mt-6">
              {status?.estado === 'em_dia' ? (
                <StatBig
                  rotulo="Dias para a próxima aplicação"
                  valor={status.diasAte}
                  sufixo={status.diasAte === 1 ? 'dia' : 'dias'}
                />
              ) : status?.estado === 'pendente_hoje' ? (
                <StatBig rotulo="Dias para a próxima aplicação" valor="Hoje" />
              ) : status ? (
                <StatBig
                  rotulo="Dias para a próxima aplicação"
                  valor={status.diasAtraso}
                  sufixo={status.diasAtraso === 1 ? 'dia de atraso' : 'dias de atraso'}
                />
              ) : null}
            </div>
          </Hero>
        }
        lateral={
          <>
            {protocolo ? (
              <SheetCard
                titulo="Seu tratamento"
                acao={
                  <Link to="/ajustes/tratamento">
                    <Button variante="fantasma" className="px-0">
                      Alterar
                    </Button>
                  </Link>
                }
              >
                <dl className="divide-y" style={{ borderColor: 'var(--border-hair)' }}>
                  {[
                    ['Medicamento', protocolo.medicamento],
                    ['Dose', `${protocolo.doseAtualMg.toLocaleString('pt-BR')} mg`],
                    [
                      'Frequência',
                      protocolo.frequencia === 'semanal' && protocolo.diaSemana !== null
                        ? `Semanal · ${nomeDiaSemana(protocolo.diaSemana)}`
                        : 'Diária',
                    ],
                    ['Horário', formatarHorario(protocolo.horarioMin)],
                    ['Janela para repor dose', `${protocolo.diasLimiteReposicao} dia(s)`],
                  ].map(([rotulo, valor]) => (
                    <div key={rotulo} className="flex items-baseline justify-between gap-4 py-3">
                      <dt className="t-label text-ink-muted">{rotulo}</dt>
                      <dd className="t-label text-right text-ink">{valor}</dd>
                    </div>
                  ))}
                </dl>
              </SheetCard>
            ) : null}

            <SheetCard titulo="Resumo">
              <dl className="divide-y" style={{ borderColor: 'var(--border-hair)' }}>
                {[
                  ['Aplicadas', String(aplicadas.length)],
                  ['Puladas', String(puladas)],
                  [
                    'Última aplicação',
                    ultima ? ultima.dataHora.toLocaleDateString('pt-BR') : 'Nenhuma ainda',
                  ],
                ].map(([rotulo, valor]) => (
                  <div key={rotulo} className="flex items-baseline justify-between gap-4 py-3">
                    <dt className="t-label text-ink-muted">{rotulo}</dt>
                    <dd className="t-label text-right text-ink">{valor}</dd>
                  </div>
                ))}
              </dl>
            </SheetCard>
          </>
        }
      >
        {erro ? (
          <SheetCard>
            <Alerta tom="danger" titulo={erro} />
          </SheetCard>
        ) : null}

        {conduta ? (
          <SheetCard titulo="Dose em atraso">
            <Alerta
              tom={conduta.acao === 'aplicar_agora' ? 'warn' : 'danger'}
              titulo={
                conduta.acao === 'aplicar_agora'
                  ? 'Ainda dá para aplicar'
                  : 'O habitual é não repor esta dose'
              }
            >
              {conduta.explicacao}
            </Alerta>
            <p className="t-label mt-3 text-ink-muted">
              Isto é apoio, não prescrição. Confirme com quem acompanha você.
            </p>
          </SheetCard>
        ) : null}

        <SheetCard titulo="Todos os registros" subtitulo={`${aplicacoes.length} no total`}>
          {aplicacoes.length === 0 ? (
            <p className="t-body text-ink-muted">
              Nenhuma aplicação registrada ainda. Use o botão "Registrar aplicação" acima.
            </p>
          ) : (
            <ul className="divide-y" style={{ borderColor: 'var(--border-hair)' }}>
              {aplicacoes.map((a) => (
                <li
                  key={a.id}
                  /* No desktop a linha vira grade de três faixas para os campos
                     alinharem entre si — com `justify-between` numa coluna de
                     700px a data e o botão acabam em pontas opostas de um vazio.
                     O botão continua sempre visível: revelar no hover apagaria a
                     ação para quem usa teclado ou toque. */
                  className="flex items-start justify-between gap-3 py-3 transition-colors hover:bg-sunken lg:grid lg:grid-cols-[9rem_minmax(0,1fr)_auto] lg:items-center lg:gap-4"
                >
                  {/* `lg:contents` dissolve este agrupador no desktop, e os dois
                      blocos internos viram faixas da grade. No celular ele
                      continua sendo o bloco de texto de sempre. */}
                  <div className="min-w-0 lg:contents">
                    <p className="t-label text-ink">
                      {a.dataHora.toLocaleDateString('pt-BR')} ·{' '}
                      {a.doseMg.toLocaleString('pt-BR')} mg
                    </p>
                    <div className="min-w-0">
                      <p className="t-label text-ink-muted">
                        {a.dataHora.toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                        {a.local ? ` · ${descreverLocal(a.local)}` : ''}
                        {a.status === 'pulada' ? ' · pulada' : ''}
                      </p>
                      {a.observacao ? (
                        <p className="t-label mt-1 text-ink-muted">{a.observacao}</p>
                      ) : null}
                    </div>
                  </div>
                  <Button
                    variante="fantasma"
                    className="shrink-0 px-0"
                    disabled={excluindo === a.id}
                    onClick={() => void remover(a.id)}
                  >
                    {excluindo === a.id ? '…' : 'Excluir'}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </SheetCard>
      </Pagina>

      {registrando && uid && protocolo ? (
        <FolhaRegistro
          uid={uid}
          protocolo={protocolo}
          aplicacoes={aplicacoes}
          canetaId={canetaAtiva?.id ?? null}
          onFechar={() => setRegistrando(false)}
        />
      ) : null}
    </>
  );
}
