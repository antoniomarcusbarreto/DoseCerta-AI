import { useState, type FormEvent } from 'react';
import { Alerta } from '@/components/Alerta';
import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { Select, type OpcaoSelect } from '@/components/Select';
import { acharPorNome } from '@/domain/catalogo';
import { minutosDoDia, nomeDiaSemana } from '@/domain/datas';
import type { DiaSemana, Frequencia, Medicamento, Protocolo } from '@/domain/tipos';

const DIAS: DiaSemana[] = [0, 1, 2, 3, 4, 5, 6];

/** Valores sentinela do seletor. Não colidem com id de documento do Firestore. */
const OUTRO = '__outro';
const OUTRA_DOSE = '__outra';

export type ValoresProtocolo = {
  /** Nome denormalizado — é o que a UI exibe, inclusive no histórico. */
  medicamento: string;
  /** Ligação fraca com o catálogo: pode apontar para nada sem quebrar a tela. */
  medicamentoId: string | null;
  doseAtualMg: number;
  frequencia: Frequencia;
  diaSemana: DiaSemana | null;
  horarioMin: number;
  diasLimiteReposicao: number;
};

type Props = {
  /** Protocolo a pré-preencher. Ausente = formulário em branco. */
  inicial?: Protocolo;
  /** Catálogo da conta. Vazio = o campo cai em texto livre. */
  medicamentos: Medicamento[];
  carregandoMedicamentos?: boolean;
  /** Campos de identidade do tratamento ficam travados ao só ajustar horário. */
  travarMedicacao?: boolean;
  rotuloEnvio: string;
  onEnviar: (valores: ValoresProtocolo) => Promise<void>;
  onCancelar?: () => void;
};

function paraHorario(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function deHorario(valor: string): number {
  const [h, m] = valor.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Qual opção do seletor representa o protocolo que está sendo editado.
 *
 * A ordem importa para não reinterpretar em silêncio o que a pessoa digitou
 * antes do catálogo existir: casa por id, depois por nome exato, e só então
 * desiste e preserva o texto original em "Outro".
 */
function escolhaInicial(inicial: Protocolo | undefined, medicamentos: Medicamento[]): string {
  if (!inicial) return '';

  if (inicial.medicamentoId && medicamentos.some((m) => m.id === inicial.medicamentoId)) {
    return inicial.medicamentoId;
  }

  const porNome = acharPorNome(medicamentos, inicial.medicamento);
  if (porNome) return porNome.id;

  return inicial.medicamento.trim() ? OUTRO : '';
}

/** 0.25 → "0,25" — a mesma forma que o campo de texto livre usa. */
const paraCampoDose = (dose: number): string => String(dose).replace('.', ',');

/**
 * O campo de dose já começa em texto livre?
 *
 * Sim quando o protocolo em edição usa uma dose que não está na lista do
 * produto — fracionada, manipulada, ajustada. Sem isso o select abriria em
 * "Selecione a dose" com um valor gravado, parecendo que o dado se perdeu.
 */
function doseForaDaLista(
  inicial: Protocolo | undefined,
  medicamentos: Medicamento[],
  escolha: string,
): boolean {
  if (!inicial) return false;
  const selecionado = medicamentos.find((m) => m.id === escolha);
  if (!selecionado || selecionado.dosesMg.length === 0) return false;
  return !selecionado.dosesMg.includes(inicial.doseAtualMg);
}

/**
 * Formulário de protocolo, compartilhado pelo onboarding, pela mudança de
 * dose e pelo ajuste de horário.
 *
 * Nenhum valor clínico é sugerido pelo app: dose, frequência e janela de
 * reposição vêm da prescrição.
 */
export function FormProtocolo({
  inicial,
  medicamentos,
  carregandoMedicamentos = false,
  travarMedicacao = false,
  rotuloEnvio,
  onEnviar,
  onCancelar,
}: Props) {
  const [escolha, setEscolha] = useState(() => escolhaInicial(inicial, medicamentos));
  const [nomeLivre, setNomeLivre] = useState(inicial?.medicamento ?? '');
  const [dose, setDose] = useState(inicial ? paraCampoDose(inicial.doseAtualMg) : '');
  const [doseLivre, setDoseLivre] = useState(() =>
    doseForaDaLista(inicial, medicamentos, escolhaInicial(inicial, medicamentos)),
  );
  const [frequencia, setFrequencia] = useState<Frequencia>(inicial?.frequencia ?? 'semanal');
  const [diaSemana, setDiaSemana] = useState<DiaSemana>(inicial?.diaSemana ?? 4);
  const [horario, setHorario] = useState(
    paraHorario(inicial?.horarioMin ?? minutosDoDia(new Date())),
  );
  const [diasLimite, setDiasLimite] = useState(String(inicial?.diasLimiteReposicao ?? 2));
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const selecionado = medicamentos.find((m) => m.id === escolha) ?? null;
  const medicamento = selecionado ? selecionado.nome : escolha === OUTRO ? nomeLivre : '';

  // O select de dose só aparece quando há uma lista de bula para oferecer.
  const usarSelectDeDose = !doseLivre && (selecionado?.dosesMg.length ?? 0) > 0;

  // Mesma expressão de antes: o select grava a dose já como texto pt-BR, então
  // existe uma única via de parse e a validação não precisou mudar.
  const doseNumero = Number(dose.replace(',', '.'));
  const valido = medicamento.trim().length > 0 && doseNumero > 0;

  const opcoesMedicamento: OpcaoSelect[] = carregandoMedicamentos && medicamentos.length === 0
    ? [{ valor: '', rotulo: 'Carregando medicamentos…', desabilitada: true }]
    : [
        ...medicamentos.map((m) => ({ valor: m.id, rotulo: m.nome })),
        { valor: OUTRO, rotulo: 'Outro (digitar)' },
      ];

  const opcoesDose: OpcaoSelect[] = [
    ...(selecionado?.dosesMg ?? []).map((d) => ({
      valor: paraCampoDose(d),
      rotulo: `${d.toLocaleString('pt-BR')} mg`,
    })),
    { valor: OUTRA_DOSE, rotulo: 'Outra dose…' },
  ];

  function trocarMedicamento(valor: string) {
    setEscolha(valor);
    // A dose é zerada de propósito: manter 2,4 mg do Wegovy ao trocar para o
    // Victoza deixaria um valor perigoso pré-preenchido no campo.
    setDose('');
    setDoseLivre(false);

    const novo = medicamentos.find((m) => m.id === valor);
    // Frequência só muda por ação explícita e quando o produto tem uma de
    // bula. É atributo do registro, mesma família de "quais doses existem" —
    // e o botão continua editável logo abaixo.
    if (novo?.frequencia) setFrequencia(novo.frequencia);
  }

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (!valido) return;

    setErro(null);
    setSalvando(true);
    try {
      await onEnviar({
        medicamento: medicamento.trim(),
        medicamentoId: selecionado?.id ?? null,
        doseAtualMg: doseNumero,
        frequencia,
        diaSemana: frequencia === 'semanal' ? diaSemana : null,
        horarioMin: deHorario(horario),
        diasLimiteReposicao: Math.max(0, Number(diasLimite) || 0),
      });
    } catch (falha) {
      console.error('[DoseCerta] falha ao salvar protocolo:', falha);
      setErro('Não foi possível salvar agora. Verifique a conexão e tente de novo.');
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <div>
        <Select
          rotulo="Medicamento"
          placeholder="Selecione o medicamento"
          opcoes={opcoesMedicamento}
          value={escolha}
          onChange={(e) => trocarMedicamento(e.target.value)}
          disabled={travarMedicacao}
        />
        {selecionado ? (
          <p className="t-label mt-2 text-ink-muted">
            {[selecionado.principioAtivo, selecionado.fabricante].filter(Boolean).join(' · ')}
            {selecionado.nota ? ` — ${selecionado.nota}` : ''}
          </p>
        ) : null}
      </div>

      {escolha === OUTRO ? (
        <Field
          rotulo="Nome do medicamento"
          placeholder="Ex.: Semaglutida"
          value={nomeLivre}
          onChange={(e) => setNomeLivre(e.target.value)}
          disabled={travarMedicacao}
          required
        />
      ) : null}

      <div>
        {usarSelectDeDose ? (
          <Select
            rotulo="Dose (mg)"
            placeholder="Selecione a dose"
            opcoes={opcoesDose}
            value={dose}
            onChange={(e) => {
              if (e.target.value === OUTRA_DOSE) {
                setDoseLivre(true);
                setDose('');
                return;
              }
              setDose(e.target.value);
            }}
            disabled={travarMedicacao}
          />
        ) : (
          <Field
            rotulo="Dose (mg)"
            placeholder="Ex.: 0,5"
            inputMode="decimal"
            value={dose}
            onChange={(e) => setDose(e.target.value)}
            disabled={travarMedicacao}
            required
          />
        )}
        <p className="t-label mt-2 text-ink-muted">
          As doses listadas são as que existem na bula do produto. O app não indica nenhuma —
          siga a prescrição.
        </p>
      </div>

      {travarMedicacao ? (
        <p className="t-label -mt-2 text-ink-muted">
          Medicamento e dose ficam travados aqui: mudá-los é um degrau novo do tratamento, não um
          ajuste. Use <strong className="font-medium text-ink">Mudar a dose</strong> para isso.
        </p>
      ) : null}

      <div>
        <p className="t-caption text-ink-muted">Frequência</p>
        <div className="mt-1.5 flex gap-2">
          {(['semanal', 'diaria'] as Frequencia[]).map((opcao) => (
            <button
              key={opcao}
              type="button"
              onClick={() => setFrequencia(opcao)}
              aria-pressed={frequencia === opcao}
              className="t-label min-h-11 flex-1 rounded-full border px-4"
              style={{
                borderColor: frequencia === opcao ? 'var(--ink)' : 'var(--border-hair)',
                background: frequencia === opcao ? 'var(--ink)' : 'transparent',
                color: frequencia === opcao ? 'var(--surface-card)' : 'var(--ink)',
              }}
            >
              {opcao === 'semanal' ? 'Semanal' : 'Diária'}
            </button>
          ))}
        </div>
      </div>

      {frequencia === 'semanal' ? (
        <Select
          rotulo="Dia da aplicação"
          opcoes={DIAS.map((dia) => ({ valor: String(dia), rotulo: nomeDiaSemana(dia) }))}
          value={String(diaSemana)}
          onChange={(e) => setDiaSemana(Number(e.target.value) as DiaSemana)}
        />
      ) : null}

      <Field
        rotulo="Horário habitual"
        type="time"
        value={horario}
        onChange={(e) => setHorario(e.target.value)}
      />

      <div>
        <Field
          rotulo="Janela para repor dose esquecida (dias)"
          inputMode="numeric"
          value={diasLimite}
          onChange={(e) => setDiasLimite(e.target.value)}
        />
        <p className="t-label mt-2 text-ink-muted">
          Quantos dias de atraso ainda permitem aplicar a dose. Esse número varia por produto —
          confirme na bula ou com quem prescreveu.
        </p>
      </div>

      {erro ? <Alerta tom="danger" titulo={erro} /> : null}

      <div className="flex gap-3 pt-1">
        {onCancelar ? (
          <Button variante="secundaria" onClick={onCancelar} disabled={salvando}>
            Cancelar
          </Button>
        ) : null}
        <Button type="submit" larguraTotal disabled={!valido || salvando}>
          {salvando ? 'Salvando…' : rotuloEnvio}
        </Button>
      </div>
    </form>
  );
}
