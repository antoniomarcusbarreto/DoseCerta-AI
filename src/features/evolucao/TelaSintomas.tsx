import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alerta } from '@/components/Alerta';
import { Button } from '@/components/Button';
import { CircleButton } from '@/components/CircleButton';
import { Field } from '@/components/Field';
import { Hero } from '@/components/Hero';
import { Pagina } from '@/components/Pagina';
import { SheetCard } from '@/components/SheetCard';
import { useDados } from '@/features/dados/DadosProvider';
import { useEvolucao } from '@/features/dados/DadosEvolucaoProvider';
import { criarRegistroSintoma, excluirRegistroSintoma } from '@/features/dados/repositorio';
import type { IntensidadeSintoma } from '@/domain/tipos';

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

const SINTOMAS_PREDEFINIDOS = [
  'Náusea',
  'Dor de Cabeça',
  'Cansaço',
  'Azia/Refluxo',
  'Intestino Preso',
  'Diarreia',
  'Dor no local da injeção',
  'Outro',
];

const INTENSIDADES: IntensidadeSintoma[] = ['Leve', 'Moderada', 'Forte'];

export function TelaSintomas() {
  const navegar = useNavigate();
  const { uid } = useDados();

  const { sintomas: registros, sintomasCarregando: carregando } = useEvolucao();

  const [sintomaSelecionado, setSintomaSelecionado] = useState<string | null>(null);
  const [sintomaOutro, setSintomaOutro] = useState('');
  const [intensidade, setIntensidade] = useState<IntensidadeSintoma | null>(null);
  const [notas, setNotas] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (!uid) return null;

  const sintomaFinal =
    sintomaSelecionado === 'Outro' ? sintomaOutro.trim() : (sintomaSelecionado ?? '');

  function selecionarSintoma(item: string) {
    setSintomaSelecionado(item);
    setIntensidade(null);
    if (item !== 'Outro') setSintomaOutro('');
  }

  async function salvar() {
    if (!uid || !sintomaFinal || !intensidade) {
      setErro('Selecione um sintoma e uma intensidade.');
      return;
    }
    setErro(null);
    setSalvando(true);
    try {
      await criarRegistroSintoma(uid, {
        symptom: sintomaFinal,
        intensity: intensidade,
        recordedAt: new Date(),
        notes: notas.trim() || null,
      });
      setSintomaSelecionado(null);
      setSintomaOutro('');
      setIntensidade(null);
      setNotas('');
    } catch (falha) {
      console.error('[DoseCerta] falha ao registrar sintoma', falha);
      setErro('Não foi possível salvar o registro. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(registroId: string) {
    if (!uid) return;
    try {
      await excluirRegistroSintoma(uid, registroId);
    } catch (falha) {
      console.error('[DoseCerta] falha ao excluir registro de sintoma', falha);
      setErro('Não foi possível excluir o registro. Tente novamente.');
    }
  }

  return (
    <Pagina
      layout="foco"
      hero={
        <Hero
          titulo="Sintomas"
          esquerda={
            <CircleButton rotulo="Voltar" onClick={() => navegar('/evolucao')}>
              <IconeVoltar />
            </CircleButton>
          }
        >
          <div className="mt-6">
            <p className="t-caption text-on-hero-muted">Últimos 7 dias</p>
            <h2 className="t-stat mt-1.5 text-on-hero">
              {registros.length} {registros.length === 1 ? 'registro' : 'registros'}
            </h2>
          </div>
        </Hero>
      }
    >
      <SheetCard titulo="Registrar sintoma">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {SINTOMAS_PREDEFINIDOS.map((item) => {
              const ativo = sintomaSelecionado === item;
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => selecionarSintoma(item)}
                  className={`t-label rounded-full px-4 py-2 transition-colors ${
                    ativo ? 'bg-rose-500 text-white' : 'bg-card text-ink'
                  }`}
                  style={ativo ? undefined : { border: '1px solid var(--border-hair)' }}
                >
                  {item}
                </button>
              );
            })}
          </div>

          {sintomaSelecionado === 'Outro' ? (
            <Field
              rotulo="Qual sintoma?"
              value={sintomaOutro}
              onChange={(e) => setSintomaOutro(e.target.value)}
            />
          ) : null}

          <div>
            <p className="t-caption text-ink-muted">Intensidade</p>
            <div className="mt-1.5 flex gap-2">
              {INTENSIDADES.map((nivel) => {
                const ativo = intensidade === nivel;
                return (
                  <button
                    key={nivel}
                    type="button"
                    disabled={!sintomaFinal}
                    onClick={() => setIntensidade(nivel)}
                    className={`t-label flex-1 rounded-full px-4 py-2 transition-colors disabled:opacity-45 disabled:pointer-events-none ${
                      ativo ? 'bg-rose-500 text-white' : 'bg-card text-ink'
                    }`}
                    style={ativo ? undefined : { border: '1px solid var(--border-hair)' }}
                  >
                    {nivel}
                  </button>
                );
              })}
            </div>
          </div>

          <Field
            rotulo="Observações (opcional)"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
          />

          <Button
            type="button"
            larguraTotal
            disabled={salvando || !sintomaFinal || !intensidade}
            onClick={salvar}
          >
            {salvando ? 'Salvando…' : 'Salvar'}
          </Button>

          {erro ? <Alerta tom="danger" titulo={erro} /> : null}
        </div>
      </SheetCard>

      <SheetCard titulo="Últimos 7 dias">
        {carregando ? (
          <p className="t-label text-ink-muted">Carregando…</p>
        ) : registros.length === 0 ? (
          <p className="t-label text-ink-muted">Nenhum sintoma registrado nos últimos 7 dias.</p>
        ) : (
          <ul className="divide-y" style={{ borderColor: 'var(--border-hair)' }}>
            {registros.map((registro) => (
              <li key={registro.id} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="t-label text-ink">
                    {registro.symptom} · {registro.intensity}
                  </p>
                  <p className="t-caption text-ink-muted">
                    {registro.recordedAt.toLocaleDateString('pt-BR')}{' '}
                    {registro.recordedAt.toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                  {registro.notes ? (
                    <p className="t-caption mt-0.5 text-ink-muted">{registro.notes}</p>
                  ) : null}
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
