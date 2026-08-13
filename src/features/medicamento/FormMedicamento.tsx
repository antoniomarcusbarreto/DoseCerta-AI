import { useState, type FormEvent } from 'react';
import { Alerta } from '@/components/Alerta';
import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { Select } from '@/components/Select';
import { analisarDoses } from '@/domain/catalogo';
import type { FormaMedicamento, Frequencia, Medicamento } from '@/domain/tipos';

export type ValoresMedicamento = {
  nome: string;
  principioAtivo: string;
  fabricante: string | null;
  forma: FormaMedicamento;
  frequencia: Frequencia | null;
  dosesMg: number[];
  apresentacoes: string[];
  diasAposAbertura: number | null;
  nota: string | null;
};

type Props = {
  /** Medicamento a pré-preencher. Ausente = formulário em branco. */
  inicial?: Medicamento;
  rotuloEnvio: string;
  onEnviar: (valores: ValoresMedicamento) => Promise<void>;
  onCancelar: () => void;
};

const FORMAS = [
  { valor: 'caneta', rotulo: 'Caneta injetável' },
  { valor: 'oral', rotulo: 'Oral' },
];

const FREQUENCIAS = [
  { valor: '', rotulo: 'Não informar' },
  { valor: 'semanal', rotulo: 'Semanal' },
  { valor: 'diaria', rotulo: 'Diária' },
];

/** Texto vazio vira null, para o campo opcional não virar string vazia no banco. */
const ouNulo = (texto: string): string | null => texto.trim() || null;

/**
 * Cadastro e edição de um medicamento do catálogo.
 *
 * As doses aqui são as que EXISTEM na bula do produto. O app não indica
 * nenhuma e não monta plano de titulação — quem escolhe a dose é a prescrição.
 */
export function FormMedicamento({ inicial, rotuloEnvio, onEnviar, onCancelar }: Props) {
  const [nome, setNome] = useState(inicial?.nome ?? '');
  const [principioAtivo, setPrincipioAtivo] = useState(inicial?.principioAtivo ?? '');
  const [fabricante, setFabricante] = useState(inicial?.fabricante ?? '');
  const [forma, setForma] = useState<FormaMedicamento>(inicial?.forma ?? 'caneta');
  const [frequencia, setFrequencia] = useState<string>(inicial?.frequencia ?? '');
  // Guardado como texto, e não como número, para o usuário conseguir digitar
  // "0," no meio da edição sem o campo se reescrever sozinho.
  const [doses, setDoses] = useState<string[]>(() =>
    inicial?.dosesMg.length
      ? inicial.dosesMg.map((d) => String(d).replace('.', ','))
      : [''],
  );
  const [apresentacoes, setApresentacoes] = useState<string[]>(() =>
    inicial?.apresentacoes.length ? [...inicial.apresentacoes] : [''],
  );
  const [diasAposAbertura, setDiasAposAbertura] = useState(
    inicial?.diasAposAbertura !== null && inicial?.diasAposAbertura !== undefined
      ? String(inicial.diasAposAbertura)
      : '',
  );
  const [nota, setNota] = useState(inicial?.nota ?? '');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const valido = nome.trim().length > 0;

  function trocarEm(
    lista: string[],
    definir: (proxima: string[]) => void,
    indice: number,
    valor: string,
  ) {
    definir(lista.map((item, i) => (i === indice ? valor : item)));
  }

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (!valido) return;

    setErro(null);
    setSalvando(true);
    try {
      const dias = Number(diasAposAbertura);
      await onEnviar({
        nome: nome.trim(),
        principioAtivo: principioAtivo.trim().toLowerCase(),
        fabricante: ouNulo(fabricante),
        forma,
        frequencia: frequencia === '' ? null : (frequencia as Frequencia),
        dosesMg: analisarDoses(doses),
        apresentacoes: apresentacoes.map((a) => a.trim()).filter(Boolean),
        diasAposAbertura:
          diasAposAbertura.trim() && Number.isFinite(dias) && dias > 0 ? Math.round(dias) : null,
        nota: ouNulo(nota),
      });
    } catch (falha) {
      console.error('[DoseCerta] falha ao salvar medicamento:', falha);
      setErro('Não foi possível salvar agora. Verifique a conexão e tente de novo.');
      setSalvando(false);
    }
  }

  /** Uma lista de campos com "Remover" por linha e "Adicionar" no fim. */
  function repetidor(
    lista: string[],
    definir: (proxima: string[]) => void,
    rotulo: (indice: number) => string,
    rotuloAdicionar: string,
    extras: { inputMode?: 'decimal'; placeholder?: string } = {},
  ) {
    return (
      <div className="space-y-2">
        {lista.map((valor, indice) => (
          <div key={indice} className="flex items-end gap-2">
            <Field
              className="flex-1"
              rotulo={rotulo(indice)}
              inputMode={extras.inputMode}
              placeholder={extras.placeholder}
              value={valor}
              onChange={(e) => trocarEm(lista, definir, indice, e.target.value)}
            />
            {lista.length > 1 ? (
              <Button
                variante="fantasma"
                onClick={() => definir(lista.filter((_, i) => i !== indice))}
              >
                Remover
              </Button>
            ) : null}
          </div>
        ))}
        <Button variante="fantasma" onClick={() => definir([...lista, ''])}>
          {rotuloAdicionar}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <Field
        rotulo="Nome"
        placeholder="Ex.: Ozempic"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        required
      />

      <Field
        rotulo="Princípio ativo"
        placeholder="Ex.: semaglutida"
        value={principioAtivo}
        onChange={(e) => setPrincipioAtivo(e.target.value)}
      />

      <Field
        rotulo="Fabricante"
        placeholder="Ex.: Novo Nordisk"
        value={fabricante}
        onChange={(e) => setFabricante(e.target.value)}
      />

      <Select
        rotulo="Forma"
        opcoes={FORMAS}
        value={forma}
        onChange={(e) => setForma(e.target.value as FormaMedicamento)}
      />

      <Select
        rotulo="Frequência de bula"
        opcoes={FREQUENCIAS}
        value={frequencia}
        onChange={(e) => setFrequencia(e.target.value)}
      />

      <div>
        {repetidor(
          doses,
          setDoses,
          (i) => `Dose ${i + 1} (mg)`,
          'Adicionar dose',
          { inputMode: 'decimal', placeholder: 'Ex.: 0,5' },
        )}
        <p className="t-label mt-2 text-ink-muted">
          As doses que existem na bula do produto. Elas viram opções na hora de cadastrar o
          tratamento — o app não indica nenhuma. Pode deixar em branco.
        </p>
      </div>

      {repetidor(
        apresentacoes,
        setApresentacoes,
        (i) => `Apresentação ${i + 1}`,
        'Adicionar apresentação',
        { placeholder: 'Ex.: 1,34 mg/mL · 3 mL' },
      )}

      <div>
        <Field
          rotulo="Validade após a abertura (dias)"
          inputMode="numeric"
          placeholder="Ex.: 56"
          value={diasAposAbertura}
          onChange={(e) => setDiasAposAbertura(e.target.value)}
        />
        <p className="t-label mt-2 text-ink-muted">
          Prazo da bula depois de aberta — ou de tempo fora da geladeira, conforme o produto.
          Confirme na bula do seu: o valor sugerido aqui é editável.
        </p>
      </div>

      <Field
        rotulo="Observação"
        placeholder="Ex.: restrição de indicação, conservação"
        value={nota}
        onChange={(e) => setNota(e.target.value)}
      />

      {erro ? <Alerta tom="danger" titulo={erro} /> : null}

      <div className="flex gap-3 pt-1">
        <Button variante="secundaria" onClick={onCancelar} disabled={salvando}>
          Cancelar
        </Button>
        <Button type="submit" larguraTotal disabled={!valido || salvando}>
          {salvando ? 'Salvando…' : rotuloEnvio}
        </Button>
      </div>
    </form>
  );
}
