/** Helpers de data em horário local. Nada aqui conhece Firebase nem React. */

export const UM_DIA_MS = 24 * 60 * 60 * 1000;

/** Meia-noite local do dia de `data`. */
export function inicioDoDia(data: Date): Date {
  const d = new Date(data);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Último instante local do dia de `data` — par de `inicioDoDia`. */
export function fimDoDia(data: Date): Date {
  const d = new Date(data);
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Identificador do dia de calendário local de `data`.
 *
 * Serve tanto para agrupar registros por dia nos gráficos quanto para detectar
 * a virada do dia: enquanto a chave não muda, "hoje" continua sendo o mesmo
 * dia. Deliberadamente montada a partir dos getters locais — `toISOString()`
 * converteria para UTC e trocaria o dia de quem registra à noite.
 */
export function chaveDoDia(data: Date): string {
  return `${data.getFullYear()}-${data.getMonth()}-${data.getDate()}`;
}

export function somarDias(data: Date, dias: number): Date {
  const d = new Date(data);
  d.setDate(d.getDate() + dias);
  return d;
}

/**
 * Diferença em dias de calendário, ignorando a hora.
 *
 * Contar por `(a - b) / 86400000` erra na virada do horário de verão, quando o
 * dia tem 23 ou 25 horas — e "faltam 2 dias" precisa bater com o calendário.
 */
export function diasEntre(de: Date, ate: Date): number {
  return Math.round((inicioDoDia(ate).getTime() - inicioDoDia(de).getTime()) / UM_DIA_MS);
}

/** Aplica um horário em minutos desde a meia-noite a uma data. */
export function comHorario(data: Date, minutos: number): Date {
  const d = inicioDoDia(data);
  d.setMinutes(minutos);
  return d;
}

export function minutosDoDia(data: Date): number {
  return data.getHours() * 60 + data.getMinutes();
}

/**
 * Próxima ocorrência de `diaSemana` a partir de `de`, inclusive o próprio dia.
 * Ancorar no dia da semana (e não em "+7 dias") impede a data de derivar ao
 * longo dos meses quando o usuário aplica com algumas horas de diferença.
 */
export function proximoDiaDaSemana(de: Date, diaSemana: number): Date {
  const delta = (diaSemana - de.getDay() + 7) % 7;
  return somarDias(inicioDoDia(de), delta);
}

export function formatarHorario(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

const NOMES_DIA = [
  'domingo',
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
];

export function nomeDiaSemana(dia: number): string {
  return NOMES_DIA[dia] ?? '';
}

function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/**
 * Procura o nome de um dia da semana (com ou sem "-feira") dentro de um texto livre.
 * Não há campo estruturado de dia da semana nos dados — só o texto digitado/extraído.
 */
export function identificarDiaSemana(texto: string): number | null {
  const normalizado = normalizarTexto(texto);
  for (let dia = 0; dia < NOMES_DIA.length; dia++) {
    const nome = normalizarTexto(NOMES_DIA[dia]);
    const semSufixo = nome.replace('-feira', '');
    if (normalizado.includes(nome) || normalizado.includes(semSufixo)) return dia;
  }
  return null;
}

/**
 * Ordena refeições por dia da semana (quando identificável no nome/descrição) e depois
 * por horário. Refeições sem dia reconhecível vão para o final, por horário entre si.
 * Retorna uma cópia — nunca muta o array recebido.
 */
export function ordenarRefeicoesPorDiaEHorario<
  T extends { name: string; time: string; description: string },
>(refeicoes: T[]): T[] {
  return [...refeicoes]
    .map((refeicao, indiceOriginal) => ({ refeicao, indiceOriginal }))
    .sort((a, b) => {
      const diaA = identificarDiaSemana(`${a.refeicao.name} ${a.refeicao.description}`);
      const diaB = identificarDiaSemana(`${b.refeicao.name} ${b.refeicao.description}`);
      const chaveA = diaA ?? 7;
      const chaveB = diaB ?? 7;
      if (chaveA !== chaveB) return chaveA - chaveB;
      if (a.refeicao.time !== b.refeicao.time) return a.refeicao.time.localeCompare(b.refeicao.time);
      return a.indiceOriginal - b.indiceOriginal;
    })
    .map(({ refeicao }) => refeicao);
}

export function formatarData(data: Date): string {
  return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}
