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
import { useDados } from '@/features/dados/DadosProvider';

export function Home() {
  const { uid, protocolo, aplicacoes, canetaAtiva, status, erro } = useDados();
  const [registrando, setRegistrando] = useState(false);

  if (!uid || !protocolo) return null;

  const atrasada = status?.estado === 'atrasada';
  const conduta = atrasada ? condutaDoseEsquecida(protocolo, status.diasAtraso) : null;

  const rotuloProtocolo = [
    `${protocolo.medicamento} ${protocolo.doseAtualMg.toLocaleString('pt-BR')} mg`,
    protocolo.frequencia === 'semanal' && protocolo.diaSemana !== null
      ? nomeDiaSemana(protocolo.diaSemana)
      : 'diária',
    formatarHorario(protocolo.horarioMin),
  ].join(' · ');

  // Altura = dose: mostra a titulação subindo e uma dose pulada como falha.
  const historico: PontoHairline[] = [...aplicacoes]
    .sort((a, b) => a.dataHora.getTime() - b.dataHora.getTime())
    .slice(-12)
    .map((a, i, todas) => ({
      rotulo: formatarData(a.dataHora),
      valor: a.status === 'aplicada' ? a.doseMg : 0,
      detalhe:
        a.status === 'pulada'
          ? 'Pulada'
          : `${a.doseMg.toLocaleString('pt-BR')} mg${a.local ? ` — ${descreverLocal(a.local)}` : ''}`,
      destaque: i === todas.length - 1,
    }));

  const hero = (
    <Hero
      titulo={<span className="font-extrabold">Dose Certa<span className="text-teal-500">-AI</span></span>}
      tom={atrasada ? 'alerta' : 'padrao'}
      /* Com uma ou duas barras não há tendência para ler — só uma haste solta
         no meio do herói. O gráfico só entra quando diz algo. */
      aside={
        historico.length >= 3 ? (
          <div className="mt-6 lg:mt-0">
            <HairlineChart pontos={historico} sobre="hero" maxRotulos={5} />
          </div>
        ) : null
      }
      acoes={
        <div className="mt-6">
          <Button
            sobre="hero"
            larguraTotal
            /* No desktop a coluna do herói tem ~500px: uma pílula dessa
               largura vira uma barra. Aqui o botão volta ao tamanho do texto. */
            className="lg:w-auto"
            onClick={() => setRegistrando(true)}
          >
            Registrar aplicação
          </Button>
        </div>
      }
    >
      <div className="mt-8">
        {status?.estado === 'em_dia' ? (
          <StatBig
            rotulo={rotuloProtocolo}
            valor={status.diasAte}
            sufixo={status.diasAte === 1 ? 'dia' : 'dias'}
          />
        ) : status?.estado === 'pendente_hoje' ? (
          <StatBig rotulo={rotuloProtocolo} valor="Hoje" />
        ) : status ? (
          <StatBig
            rotulo={rotuloProtocolo}
            valor={status.diasAtraso}
            sufixo={status.diasAtraso === 1 ? 'dia de atraso' : 'dias de atraso'}
          />
        ) : null}
      </div>
    </Hero>
  );

  /*
   * Coluna de apoio do desktop. Sem ela a Home no caminho feliz teria um card
   * só, e a segunda coluna ficaria vazia — o que lê como layout quebrado. O
   * conteúdo é o protocolo em vigor, que hoje exige dois cliques para ver.
   */
  const lateral = (
    <SheetCard
      /* Exclusivo do desktop: no celular estes mesmos dados já estão no rótulo
         do herói, e o card seria repetição. */
      className="hidden lg:block"
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
  );

  return (
    <>
      <Pagina hero={hero} lateral={lateral}>
        {erro ? (
          <SheetCard>
            <Alerta tom="danger" titulo="Não foi possível ler seus dados">
              {erro.message}
            </Alerta>
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

        <SheetCard
          titulo="Últimas aplicações"
          subtitulo={`${aplicacoes.length} registro(s)`}
          acao={
            aplicacoes.length > 0 ? (
              <Link to="/historico">
                <Button variante="fantasma" className="px-0">
                  Ver tudo
                </Button>
              </Link>
            ) : null
          }
        >
          {aplicacoes.length === 0 ? (
            <p className="t-body text-ink-muted">
              Nenhuma aplicação registrada ainda. O primeiro registro aparece aqui.
            </p>
          ) : (
            <ul className="divide-y" style={{ borderColor: 'var(--border-hair)' }}>
              {aplicacoes.slice(0, 4).map((a) => (
                <li key={a.id} className="flex items-baseline justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="t-label text-ink">
                      {a.dataHora.toLocaleDateString('pt-BR')} ·{' '}
                      {a.doseMg.toLocaleString('pt-BR')} mg
                    </p>
                    {a.local ? (
                      <p className="t-label text-ink-muted">{descreverLocal(a.local)}</p>
                    ) : null}
                  </div>
                  <span className="t-caption shrink-0 text-ink-muted">
                    {a.status === 'aplicada' ? 'aplicada' : 'pulada'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SheetCard>
      </Pagina>

      {registrando ? (
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
