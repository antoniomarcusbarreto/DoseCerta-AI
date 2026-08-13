import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alerta } from '@/components/Alerta';
import { Button } from '@/components/Button';
import { CircleButton } from '@/components/CircleButton';
import { Hero } from '@/components/Hero';
import { Pagina } from '@/components/Pagina';
import { SheetCard } from '@/components/SheetCard';
import { useDados } from '@/features/dados/DadosProvider';
import {
  consultaIntestinoRecentes,
  criarRegistroIntestino,
  excluirRegistroIntestino,
} from '@/features/dados/repositorio';
import { useColecao } from '@/lib/useConsulta';
import type { TipoEvacuacao } from '@/domain/tipos';

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

const OPCOES: { tipo: TipoEvacuacao; rotulo: string }[] = [
  { tipo: 'Ressecado', rotulo: '🪨 Ressecado' },
  { tipo: 'Normal', rotulo: '👍 Normal' },
  { tipo: 'Solto', rotulo: '💧 Solto' },
];

/** Dias corridos entre `data` e agora, arredondado para baixo. */
function diasDesde(data: Date): number {
  const ms = Date.now() - data.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export function TelaIntestino() {
  const navegar = useNavigate();
  const { uid } = useDados();

  const consulta = uid ? consultaIntestinoRecentes(uid) : null;
  const { dados: registros, carregando } = useColecao(
    consulta,
    uid ? `${uid}/bowel_logs/recentes` : null,
  );

  const [salvando, setSalvando] = useState<TipoEvacuacao | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  if (!uid) return null;

  const ultimoRegistro = registros[0] ?? null;
  const diasSemRegistro = ultimoRegistro ? diasDesde(ultimoRegistro.recordedAt) : null;
  const mostrarAlerta = !carregando && (!ultimoRegistro || diasSemRegistro! >= 3);

  async function registrar(tipo: TipoEvacuacao) {
    if (!uid) return;
    setErro(null);
    setSalvando(tipo);
    try {
      await criarRegistroIntestino(uid, { type: tipo, recordedAt: new Date() });
    } catch (falha) {
      console.error('[DoseCerta] falha ao registrar evacuação', falha);
      setErro('Não foi possível salvar o registro. Tente novamente.');
    } finally {
      setSalvando(null);
    }
  }

  async function excluir(registroId: string) {
    if (!uid) return;
    try {
      await excluirRegistroIntestino(uid, registroId);
    } catch (falha) {
      console.error('[DoseCerta] falha ao excluir registro de evacuação', falha);
      setErro('Não foi possível excluir o registro. Tente novamente.');
    }
  }

  return (
    <Pagina
      layout="foco"
      hero={
        <Hero
          titulo="Intestino e Digestão"
          esquerda={
            <CircleButton rotulo="Voltar" onClick={() => navegar('/evolucao')}>
              <IconeVoltar />
            </CircleButton>
          }
        >
          <div className="mt-6">
            <p className="t-caption text-on-hero-muted">Últimos registros</p>
            <h2 className="t-stat mt-1.5 text-on-hero">
              {registros.length} {registros.length === 1 ? 'registro' : 'registros'}
            </h2>
          </div>
        </Hero>
      }
    >
      {mostrarAlerta ? (
        <Alerta
          tom="warn"
          titulo={
            ultimoRegistro
              ? `Já fazem ${diasSemRegistro} dias desde o último registro`
              : 'Nenhum registro ainda'
          }
        >
          Considere aumentar o consumo de água e fibras.
        </Alerta>
      ) : null}

      <SheetCard titulo="Como foi hoje?">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-3">
            {OPCOES.map(({ tipo, rotulo }) => (
              <button
                key={tipo}
                type="button"
                disabled={salvando !== null}
                onClick={() => registrar(tipo)}
                className="t-label flex flex-col items-center justify-center gap-2 bg-card rounded-xl p-4 shadow-md transition-all active:scale-95 hover:-translate-y-0.5 disabled:opacity-45 disabled:pointer-events-none"
                style={{ border: '1px solid var(--border-hair)' }}
              >
                <span className="text-2xl">{rotulo.split(' ')[0]}</span>
                <span>{rotulo.split(' ').slice(1).join(' ')}</span>
              </button>
            ))}
          </div>

          {salvando ? <p className="t-label text-ink-muted">Salvando…</p> : null}
          {erro ? <Alerta tom="danger" titulo={erro} /> : null}
        </div>
      </SheetCard>

      <SheetCard titulo="Histórico recente">
        {carregando ? (
          <p className="t-label text-ink-muted">Carregando…</p>
        ) : registros.length === 0 ? (
          <p className="t-label text-ink-muted">Nenhum registro ainda.</p>
        ) : (
          <ul className="divide-y" style={{ borderColor: 'var(--border-hair)' }}>
            {registros.map((registro) => (
              <li key={registro.id} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="t-label text-ink">{registro.type}</p>
                  <p className="t-caption text-ink-muted">
                    {registro.recordedAt.toLocaleDateString('pt-BR')}{' '}
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
