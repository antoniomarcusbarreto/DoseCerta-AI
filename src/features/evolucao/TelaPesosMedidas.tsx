import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alerta } from '@/components/Alerta';
import { Button } from '@/components/Button';
import { CircleButton } from '@/components/CircleButton';
import { Field } from '@/components/Field';
import { Hero } from '@/components/Hero';
import { Pagina } from '@/components/Pagina';
import { SheetCard } from '@/components/SheetCard';
import { calcularImc, deltaPeso } from '@/domain/medidas';
import { useDados } from '@/features/dados/DadosProvider';
import { atualizarAltura, consultaHistoricoPeso, criarRegistroPeso } from '@/features/dados/repositorio';
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

  const refUsuarioAtual = uid ? refUsuario(uid) : null;
  const { dados: usuario, carregando: carregandoAltura } = useDocumento(refUsuarioAtual);

  const consulta = uid ? consultaHistoricoPeso(uid, 5) : null;
  const { dados: historico, carregando: carregandoHistorico } = useColecao(
    consulta,
    uid ? `${uid}/weight_history` : null,
  );

  const alturaSalva = usuario?.height ?? null;
  const precisaAltura = !carregandoAltura && alturaSalva === null;

  const [peso, setPeso] = useState('');
  const [cintura, setCintura] = useState('');
  const [altura, setAltura] = useState('');
  const [notas, setNotas] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

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
    if (precisaAltura && (!Number.isFinite(alturaM) || alturaM <= 0)) {
      setErro('Informe a altura.');
      return;
    }

    setSalvando(true);
    try {
      if (precisaAltura) {
        await atualizarAltura(uid, alturaM);
      }
      await criarRegistroPeso(uid, {
        weight: pesoNum,
        waist: cintura ? Number(cintura) : null,
        recordedAt: new Date(),
        notes: notas || null,
      });
      setPeso('');
      setCintura('');
      setAltura('');
      setNotas('');
    } catch (falha) {
      console.error('[DoseCerta] falha ao registrar peso', falha);
      setErro('Não foi possível salvar o registro. Tente novamente.');
    } finally {
      setSalvando(false);
    }
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

          <Button type="submit" larguraTotal disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar registro'}
          </Button>
        </form>
      </SheetCard>

      <SheetCard titulo="Últimos registros">
        {carregandoHistorico ? (
          <p className="t-label text-ink-muted">Carregando…</p>
        ) : historico.length === 0 ? (
          <p className="t-label text-ink-muted">Nenhum registro ainda.</p>
        ) : (
          <ul className="divide-y" style={{ borderColor: 'var(--border-hair)' }}>
            {historico.map((registro) => (
              <li key={registro.id} className="flex items-baseline justify-between gap-4 py-3">
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
              </li>
            ))}
          </ul>
        )}
      </SheetCard>
    </Pagina>
  );
}
