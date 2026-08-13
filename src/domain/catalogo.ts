import type {
  Caneta,
  FormaMedicamento,
  Frequencia,
  Medicamento,
  Protocolo,
} from './tipos';

/**
 * Catálogo embutido de canetas GLP-1 e as regras puras que o cercam.
 *
 * As doses aqui são as REGISTRADAS na Anvisa / bula de cada produto. O app as
 * lista como opções factuais: nenhuma é marcada como recomendada e nenhum
 * plano de titulação é montado a partir delas. Escolher a dose é da
 * prescrição, não do software.
 *
 * Regra para evoluir o catálogo:
 * - NUNCA mude o `slug` de uma entrada já publicada — ele é o id do documento
 *   no Firestore, e trocá-lo criaria um duplicado na conta de quem já semeou.
 * - NUNCA mude a `versao` de uma entrada já publicada.
 * - Entradas novas entram com `versao: CATALOGO_VERSAO + 1`, e o
 *   `CATALOGO_VERSAO` sobe junto. Só elas serão semeadas em quem já usa o app,
 *   então nada que o usuário excluiu volta.
 */

export const CATALOGO_VERSAO = 1;

export type EntradaCatalogo = {
  /** Id do documento no Firestore. Estável para sempre. */
  slug: string;
  /** Versão do catálogo em que esta entrada apareceu. */
  versao: number;
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

/** Restrição de indicação comum aos similares de semaglutida de jul/2026. */
const SO_DM2 = 'Registro na Anvisa indicado apenas para diabetes tipo 2.';

export const CATALOGO: EntradaCatalogo[] = [
  /* ---- Semaglutida semanal --------------------------------------------- */
  {
    slug: 'ozempic',
    versao: 1,
    nome: 'Ozempic',
    principioAtivo: 'semaglutida',
    fabricante: 'Novo Nordisk',
    forma: 'caneta',
    frequencia: 'semanal',
    dosesMg: [0.25, 0.5, 1, 2],
    apresentacoes: [
      '1,34 mg/mL (0,25 e 0,5 mg por dose)',
      '1,34 mg/mL · 3 mL (1 mg por dose)',
      '2,68 mg/mL (2 mg por dose)',
    ],
    diasAposAbertura: 56,
    nota: null,
  },
  {
    slug: 'wegovy',
    versao: 1,
    nome: 'Wegovy',
    principioAtivo: 'semaglutida',
    fabricante: 'Novo Nordisk',
    forma: 'caneta',
    frequencia: 'semanal',
    dosesMg: [0.25, 0.5, 1, 1.7, 2.4],
    apresentacoes: ['0,68 mg/mL', '1,34 mg/mL', '2,27 mg/mL', '3,2 mg/mL'],
    diasAposAbertura: 56,
    nota: 'Cada caneta entrega 4 doses da mesma concentração.',
  },
  {
    slug: 'poviztra',
    versao: 1,
    nome: 'Poviztra',
    principioAtivo: 'semaglutida',
    fabricante: 'Novo Nordisk',
    forma: 'caneta',
    frequencia: 'semanal',
    dosesMg: [0.25, 0.5, 1, 2],
    apresentacoes: ['1,34 mg/mL', '2,68 mg/mL'],
    diasAposAbertura: 56,
    nota: null,
  },
  {
    slug: 'extensior',
    versao: 1,
    nome: 'Extensior',
    principioAtivo: 'semaglutida',
    fabricante: 'Novo Nordisk',
    forma: 'caneta',
    frequencia: 'semanal',
    dosesMg: [0.25, 0.5, 1, 2],
    apresentacoes: ['1,34 mg/mL', '2,68 mg/mL'],
    diasAposAbertura: 56,
    nota: null,
  },

  /* ---- Similares de semaglutida registrados na Anvisa em jul/2026 -------
   * Todos a 1,34 mg/mL, registrados por comparação com o Ozempic. As doses
   * saem dessa concentração, não da leitura de cinco bulas — confira na bula
   * do seu produto e ajuste aqui pela tela de Medicamentos se divergir.
   */
  {
    slug: 'zempneo',
    versao: 1,
    nome: 'Zempneo',
    principioAtivo: 'semaglutida',
    fabricante: 'Brainfarma',
    forma: 'caneta',
    frequencia: 'semanal',
    dosesMg: [0.25, 0.5, 1],
    apresentacoes: ['1,34 mg/mL'],
    diasAposAbertura: 56,
    nota: SO_DM2,
  },
  {
    slug: 'semavy',
    versao: 1,
    nome: 'Semavy',
    principioAtivo: 'semaglutida',
    fabricante: 'Cosmed',
    forma: 'caneta',
    frequencia: 'semanal',
    dosesMg: [0.25, 0.5, 1],
    apresentacoes: ['1,34 mg/mL'],
    diasAposAbertura: 56,
    nota: SO_DM2,
  },
  {
    slug: 'orsema',
    versao: 1,
    nome: 'Orsema',
    principioAtivo: 'semaglutida',
    fabricante: 'Ranbaxy',
    forma: 'caneta',
    frequencia: 'semanal',
    dosesMg: [0.25, 0.5, 1],
    apresentacoes: ['1,34 mg/mL'],
    diasAposAbertura: 56,
    nota: SO_DM2,
  },
  {
    slug: 'seemasun',
    versao: 1,
    nome: 'Seemasun',
    principioAtivo: 'semaglutida',
    fabricante: 'Sun Farmacêutica',
    forma: 'caneta',
    frequencia: 'semanal',
    dosesMg: [0.25, 0.5, 1],
    apresentacoes: ['1,34 mg/mL'],
    diasAposAbertura: 56,
    nota: SO_DM2,
  },
  {
    slug: 'owozy',
    versao: 1,
    nome: 'Owozy',
    principioAtivo: 'semaglutida',
    fabricante: 'Ávita Care',
    forma: 'caneta',
    frequencia: 'semanal',
    dosesMg: [0.25, 0.5, 1],
    apresentacoes: ['1,34 mg/mL'],
    diasAposAbertura: 56,
    nota: SO_DM2,
  },

  /* ---- Tirzepatida semanal --------------------------------------------- */
  {
    slug: 'mounjaro',
    versao: 1,
    nome: 'Mounjaro',
    principioAtivo: 'tirzepatida',
    fabricante: 'Eli Lilly',
    forma: 'caneta',
    frequencia: 'semanal',
    dosesMg: [2.5, 5, 7.5, 10, 12.5, 15],
    apresentacoes: ['Caneta de 0,5 mL por dose'],
    diasAposAbertura: 21,
    nota: 'Prazo de 21 dias conta o tempo fora da geladeira, não desde a abertura.',
  },

  /* ---- Liraglutida diária ---------------------------------------------- */
  {
    slug: 'saxenda',
    versao: 1,
    nome: 'Saxenda',
    principioAtivo: 'liraglutida',
    fabricante: 'Novo Nordisk',
    forma: 'caneta',
    frequencia: 'diaria',
    dosesMg: [0.6, 1.2, 1.8, 2.4, 3],
    apresentacoes: ['6 mg/mL · 3 mL'],
    diasAposAbertura: 28,
    nota: 'Bula: 4 semanas após o primeiro uso.',
  },
  {
    slug: 'victoza',
    versao: 1,
    nome: 'Victoza',
    principioAtivo: 'liraglutida',
    fabricante: 'Novo Nordisk',
    forma: 'caneta',
    frequencia: 'diaria',
    dosesMg: [0.6, 1.2, 1.8],
    apresentacoes: ['6 mg/mL · 3 mL'],
    diasAposAbertura: 30,
    nota: null,
  },
  {
    slug: 'olire',
    versao: 1,
    nome: 'Olire',
    principioAtivo: 'liraglutida',
    fabricante: null,
    forma: 'caneta',
    frequencia: 'diaria',
    dosesMg: [0.6, 1.2, 1.8],
    // Sem número de bula confirmado: melhor em branco do que afirmar errado.
    diasAposAbertura: null,
    apresentacoes: ['6 mg/mL · 3 mL'],
    nota: 'Genérico de liraglutida. Confirme na bula as doses e a validade após a abertura.',
  },

  /* ---- Dulaglutida semanal --------------------------------------------- */
  {
    slug: 'trulicity',
    versao: 1,
    nome: 'Trulicity',
    principioAtivo: 'dulaglutida',
    fabricante: 'Eli Lilly',
    forma: 'caneta',
    frequencia: 'semanal',
    dosesMg: [0.75, 1.5, 3, 4.5],
    apresentacoes: ['Caneta de dose única'],
    diasAposAbertura: 14,
    nota: 'Caneta de dose única. Os 14 dias contam o tempo fora da geladeira.',
  },

  /* ---- Oral ------------------------------------------------------------ */
  {
    slug: 'rybelsus',
    versao: 1,
    nome: 'Rybelsus',
    principioAtivo: 'semaglutida',
    fabricante: 'Novo Nordisk',
    forma: 'oral',
    frequencia: 'diaria',
    dosesMg: [3, 7, 14],
    apresentacoes: ['Comprimido 3 mg', 'Comprimido 7 mg', 'Comprimido 14 mg'],
    diasAposAbertura: null,
    nota: 'Comprimido, não caneta.',
  },
];

/* ---- Semente ------------------------------------------------------------ */

/**
 * Entradas que esta conta ainda não recebeu.
 *
 * É a base da idempotência: com o marcador em dia devolve lista vazia, então
 * a semente não roda de novo e não ressuscita nada que o usuário excluiu.
 */
export function entradasPendentes(versaoAplicada: number): EntradaCatalogo[] {
  return CATALOGO.filter((entrada) => entrada.versao > versaoAplicada);
}

/** Converte uma entrada do catálogo no documento que vai para o Firestore. */
export function paraMedicamento(
  entrada: EntradaCatalogo,
): Omit<Medicamento, 'id' | 'criadoEm'> {
  return {
    nome: entrada.nome,
    principioAtivo: entrada.principioAtivo,
    fabricante: entrada.fabricante,
    forma: entrada.forma,
    frequencia: entrada.frequencia,
    dosesMg: entrada.dosesMg,
    apresentacoes: entrada.apresentacoes,
    diasAposAbertura: entrada.diasAposAbertura,
    nota: entrada.nota,
    catalogoId: entrada.slug,
  };
}

/* ---- Busca e ordenação -------------------------------------------------- */

/** Minúsculo, sem acento e sem espaço sobrando — para comparar nomes. */
export function normalizarNome(nome: string): string {
  return nome
    .normalize('NFD')
    // Faixa dos diacríticos combinantes que o NFD acabou de separar.
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Acha o medicamento pelo nome.
 *
 * Casa SÓ por nome, nunca por princípio ativo: cinco produtos do catálogo são
 * semaglutida, então casar por princípio escolheria um deles no chute e
 * reescreveria em silêncio o que o usuário tinha digitado.
 */
export function acharPorNome(
  medicamentos: Medicamento[],
  nome: string,
): Medicamento | null {
  const alvo = normalizarNome(nome);
  if (!alvo) return null;
  return medicamentos.find((m) => normalizarNome(m.nome) === alvo) ?? null;
}

/**
 * Ordem de exibição da lista.
 *
 * Feito aqui e não com `orderBy` no Firestore porque a ordenação de lá é por
 * byte: "Ávita" iria parar depois de "Zempneo".
 */
export function ordenarMedicamentos(medicamentos: Medicamento[]): Medicamento[] {
  return [...medicamentos].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

/* ---- Doses -------------------------------------------------------------- */

/**
 * Lê as doses digitadas no formulário.
 *
 * Aceita vírgula (pt-BR) e ponto, descarta vazio, texto e valores ≤ 0, remove
 * repetidos e devolve em ordem crescente.
 */
export function analisarDoses(entradas: string[]): number[] {
  const vistos = new Set<number>();
  for (const bruto of entradas) {
    const numero = Number(String(bruto).replace(',', '.').trim());
    if (Number.isFinite(numero) && numero > 0) vistos.add(numero);
  }
  return [...vistos].sort((a, b) => a - b);
}

/** "0,25 · 0,5 · 1 · 2 mg" — como a lista mostra as doses de um medicamento. */
export function formatarDoses(dosesMg: number[]): string {
  if (dosesMg.length === 0) return 'Sem doses cadastradas';
  return `${dosesMg.map((d) => d.toLocaleString('pt-BR')).join(' · ')} mg`;
}

/* ---- Uso ---------------------------------------------------------------- */

export type UsosMedicamento = {
  protocolos: number;
  canetas: number;
  noProtocoloAtivo: boolean;
};

/**
 * Onde este medicamento já aparece nos registros da conta.
 *
 * Casa por `medicamentoId` e também por nome, porque protocolos criados antes
 * do catálogo existir só têm o nome. Serve para avisar antes de excluir —
 * nunca para bloquear: nada quebra, já que protocolo e caneta guardam o nome
 * denormalizado.
 */
export function usosDoMedicamento(
  medicamento: Medicamento,
  protocolos: Protocolo[],
  canetas: Caneta[],
): UsosMedicamento {
  const nome = normalizarNome(medicamento.nome);
  const casa = (id: string | null, rotulo: string) =>
    id === medicamento.id || normalizarNome(rotulo) === nome;

  const usados = protocolos.filter((p) => casa(p.medicamentoId, p.medicamento));

  return {
    protocolos: usados.length,
    canetas: canetas.filter((c) => normalizarNome(c.medicamento) === nome).length,
    noProtocoloAtivo: usados.some((p) => p.ativo),
  };
}
