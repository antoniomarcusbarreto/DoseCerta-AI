import { useState } from 'react';
import { Alerta } from '@/components/Alerta';
import { Button } from '@/components/Button';
import { HairlineChart, type PontoHairline } from '@/components/HairlineChart';
import { Hero } from '@/components/Hero';
import { Pagina } from '@/components/Pagina';
import { SheetCard } from '@/components/SheetCard';
import { descreverLocal } from '@/domain/aplicacao';
import { formatarData } from '@/domain/datas';
import { excluirAplicacao } from '@/features/dados/repositorio';
import { useDados } from '@/features/dados/DadosProvider';

export function TelaHistorico() {
  const { uid, protocolo, aplicacoes } = useDados();
  const [excluindo, setExcluindo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  if (!uid) return null;

  const aplicadas = aplicacoes.filter((a) => a.status === 'aplicada');

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

  const puladas = aplicacoes.length - aplicadas.length;
  const ultima = aplicadas[0] ?? null;

  return (
    <Pagina
      hero={
        <Hero
          titulo="Histórico"
          aside={
            serie.length >= 3 ? (
              <div className="mt-6 lg:mt-0">
                <HairlineChart pontos={serie} sobre="hero" maxRotulos={5} />
              </div>
            ) : null
          }
        >
          <div className="mt-6">
            <p className="t-caption text-on-hero-muted">Aplicações registradas</p>
            <p className="t-display mt-1.5 text-on-hero">{aplicadas.length}</p>
          </div>
        </Hero>
      }
      /* Exclusivo do desktop: no celular estes números já estão no herói e no
         subtítulo do card, e repetir só empurraria a lista para baixo. */
      lateral={
        <SheetCard className="hidden lg:block" titulo="Resumo">
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
      }
    >
      {erro ? (
        <SheetCard>
          <Alerta tom="danger" titulo={erro} />
        </SheetCard>
      ) : null}

      <SheetCard titulo="Todos os registros" subtitulo={`${aplicacoes.length} no total`}>
        {aplicacoes.length === 0 ? (
          <p className="t-body text-ink-muted">
            Nenhuma aplicação registrada ainda. Use o botão na tela inicial.
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
  );
}
