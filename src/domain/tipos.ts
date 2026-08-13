/**
 * Modelo de domínio do DoseCerta.
 *
 * Estes tipos usam `Date` — a conversão de/para `Timestamp` do Firestore fica
 * inteiramente nos converters de `src/lib/firestore.ts`. Nada acima desta
 * camada deve conhecer tipos do Firebase.
 */

export type Frequencia = 'semanal' | 'diaria';

/** 0 = domingo … 6 = sábado, igual a `Date#getDay`. */
export type DiaSemana = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type RegiaoAplicacao = 'abdomen' | 'coxa' | 'braco';
export type LadoAplicacao = 'esq' | 'dir';

export type LocalAplicacao = {
  regiao: RegiaoAplicacao;
  lado: LadoAplicacao;
};

export type StatusAplicacao = 'aplicada' | 'pulada';

export type Perfil = {
  nome: string;
  alturaCm: number | null;
  criadoEm: Date;
};

export type FormaMedicamento = 'caneta' | 'oral';

/**
 * Um medicamento do catálogo da conta.
 *
 * `dosesMg` são as doses que EXISTEM na bula do produto — opções factuais,
 * não recomendação. O app nunca marca uma como indicada nem monta plano de
 * titulação a partir daqui: isso é da prescrição.
 */
export type Medicamento = {
  id: string;
  /** Nome comercial, ou o rótulo que o usuário preferir. Ex.: "Ozempic". */
  nome: string;
  /** Princípio ativo em minúsculas, ex. "semaglutida". Vazio se desconhecido. */
  principioAtivo: string;
  fabricante: string | null;
  forma: FormaMedicamento;
  /** Frequência de bula do produto — fato do produto, não conduta. */
  frequencia: Frequencia | null;
  /** Doses de bula em mg, crescentes e sem repetição. Pode ser vazio. */
  dosesMg: number[];
  /** Apresentações comerciais, rótulo livre. Ex.: "1,34 mg/mL · 3 mL". */
  apresentacoes: string[];
  /**
   * Prazo de uso após a abertura — ou fora da geladeira, conforme o produto —
   * em dias, como está na bula. Sempre editável: é sugestão, não trava.
   */
  diasAposAbertura: number | null;
  /** Observação factual: restrição de indicação, condição de armazenamento. */
  nota: string | null;
  /**
   * Slug da entrada do catálogo embutido que criou este doc — é também o id
   * do documento. null quando o usuário criou o medicamento na mão.
   */
  catalogoId: string | null;
  criadoEm: Date;
};

/** Qual versão do catálogo embutido já foi semeada nesta conta. */
export type SementeCatalogo = {
  versao: number;
  semeadoEm: Date | null;
};

/** Um degrau do plano de titulação: manter `doseMg` por `semanas` semanas. */
export type DegrauTitulacao = {
  doseMg: number;
  semanas: number;
};

export type Protocolo = {
  id: string;
  /** Princípio ativo ou nome comercial, como o usuário informou. */
  medicamento: string;
  /**
   * Doc de `medicamentos` escolhido. null em protocolos antigos e quando o
   * nome foi digitado à mão. O `medicamento` acima segue sendo a fonte da
   * verdade para exibição — é o que mantém o histórico legível depois que o
   * medicamento é excluído ou renomeado.
   */
  medicamentoId: string | null;
  doseAtualMg: number;
  frequencia: Frequencia;
  /** Só faz sentido em `frequencia: 'semanal'`. */
  diaSemana: DiaSemana | null;
  /** Horário-alvo no dia, em minutos desde a meia-noite. */
  horarioMin: number;
  planoTitulacao: DegrauTitulacao[];
  /**
   * Quantos dias de atraso ainda permitem repor a dose. Varia por produto e
   * sai da bula/prescrição — por isso é campo do protocolo, não constante.
   */
  diasLimiteReposicao: number;
  iniciadoEm: Date;
  ativo: boolean;
  criadoEm: Date;
};

export type Aplicacao = {
  id: string;
  protocoloId: string;
  dataHora: Date;
  doseMg: number;
  local: LocalAplicacao | null;
  canetaId: string | null;
  status: StatusAplicacao;
  observacao: string | null;
  criadoEm: Date;
};

export type Caneta = {
  id: string;
  medicamento: string;
  /** Rótulo livre da apresentação, ex. "1,0 mg/dose". Vem de `Medicamento.apresentacoes`. */
  apresentacao: string;
  lote: string | null;
  validadeFabricante: Date | null;
  abertaEm: Date | null;
  /** Prazo de uso após a abertura, em dias. Vem da bula do produto. */
  diasAposAbertura: number | null;
  dosesTotais: number;
  dosesUsadas: number;
  precoPago: number | null;
  ativa: boolean;
  criadoEm: Date;
};

export type Medida = {
  id: string;
  data: Date;
  pesoKg: number | null;
  cinturaCm: number | null;
};

/**
 * Um registro de peso/medidas do histórico da conta.
 *
 * Nomes de campo em inglês por decisão explícita do usuário — este registro
 * é intencionalmente independente de `Medida`/`Perfil.alturaCm`, que já
 * existiam prontos no projeto mas não foram reaproveitados aqui.
 */
export type RegistroPeso = {
  id: string;
  weight: number;
  waist: number | null;
  recordedAt: Date;
  notes: string | null;
};

/** Um registro de consumo de água do dia. Nomes de campo em inglês, mesmo critério de `RegistroPeso`. */
export type RegistroHidratacao = {
  id: string;
  amount_ml: number;
  recordedAt: Date;
};

export type IntensidadeSintoma = 'Leve' | 'Moderada' | 'Forte';

/** Um registro de sintoma avulso (não confundir com `Efeito`, schema diferente). */
export type RegistroSintoma = {
  id: string;
  symptom: string;
  intensity: IntensidadeSintoma;
  recordedAt: Date;
  notes: string | null;
};

export type TipoEvacuacao = 'Ressecado' | 'Normal' | 'Solto';

/** Um registro rápido de evacuação, usado no alerta de constipação da tela de Evolução. */
export type RegistroIntestino = {
  id: string;
  type: TipoEvacuacao;
  recordedAt: Date;
};

export type TipoEfeito = 'nausea' | 'constipacao' | 'refluxo' | 'fadiga' | 'cefaleia' | 'outro';

export type Efeito = {
  id: string;
  data: Date;
  tipo: TipoEfeito;
  /** 1 (leve) a 5 (intenso). */
  intensidade: 1 | 2 | 3 | 4 | 5;
  observacao: string | null;
};

/**
 * Doc único e denormalizado com a próxima aplicação prevista.
 *
 * Existe só para a Cloud Function de lembretes conseguir varrer todos os
 * usuários com UMA `collectionGroup` query, em vez de percorrer conta a conta.
 * É sempre derivado do protocolo + última aplicação — nunca a fonte da verdade.
 */
export type Agenda = {
  proximaEm: Date | null;
  notificadaEm: Date | null;
  protocoloId: string | null;
};

export type AnguloFoto = 'Frente' | 'Perfil' | 'Costas';

/** Uma foto de progresso da Galeria de Evolução. Nomes de campo em inglês, mesmo critério dos "Registro*" de Evolução. */
export type RegistroFoto = {
  id: string;
  imageUrl: string;
  storagePath: string;
  angle: AnguloFoto;
  recordedAt: Date;
};

export type ItemRefeicaoIA = { name: string; quantity: string };

export type MacrosRefeicao = { protein: number; carbs: number; fat: number; kcal: number };

export type StatusRefeicao = 'pending' | 'completed';

/** Uma refeição escaneada via foto e analisada pela IA (Gemini Vision). */
export type RegistroRefeicao = {
  id: string;
  imageUrl: string;
  storagePath: string;
  items: ItemRefeicaoIA[];
  macros: MacrosRefeicao;
  aiFeedback: string;
  status: StatusRefeicao;
  consumedPercentage: number | null;
  createdAt: Date;
};

export type Refeicao = { id: string; name: string; time: string; description: string };

/** Um plano alimentar da conta. Nomes de campo em inglês, mesmo critério dos "Registro*" de Evolução. */
export type PlanoAlimentar = {
  id: string;
  title: string;
  isActive: boolean;
  meals: Refeicao[];
  createdAt: Date;
};
