import { comHorario, diasEntre, inicioDoDia, proximoDiaDaSemana, somarDias } from './datas';
import type {
  Aplicacao,
  LadoAplicacao,
  LocalAplicacao,
  Protocolo,
  RegiaoAplicacao,
} from './tipos';

/**
 * Regras de aplicação. Funções puras, sem React e sem Firebase — é o que
 * permite testar a conduta clínica sem subir nada.
 */

/** Aplicações de fato realizadas, da mais recente para a mais antiga. */
export function ordenarPorDataDesc(aplicacoes: Aplicacao[]): Aplicacao[] {
  return [...aplicacoes].sort((a, b) => b.dataHora.getTime() - a.dataHora.getTime());
}

export function ultimaAplicada(aplicacoes: Aplicacao[]): Aplicacao | null {
  const aplicadas = ordenarPorDataDesc(aplicacoes).filter((a) => a.status === 'aplicada');
  return aplicadas[0] ?? null;
}

/**
 * Data/hora da próxima aplicação prevista.
 *
 * Semanal ancora no `diaSemana` do protocolo em vez de somar 7 dias à última
 * aplicação: somar faria o dia derivar ao longo dos meses toda vez que a
 * pessoa aplicasse algumas horas mais tarde.
 */
export function proximaAplicacao(
  protocolo: Protocolo,
  aplicacoes: Aplicacao[],
  agora: Date = new Date(),
): Date {
  const ultima = ultimaAplicada(aplicacoes);

  if (protocolo.frequencia === 'diaria') {
    const base = ultima ? somarDias(ultima.dataHora, 1) : agora;
    const alvo = comHorario(base, protocolo.horarioMin);
    return alvo.getTime() < agora.getTime() && !ultima
      ? comHorario(somarDias(agora, 1), protocolo.horarioMin)
      : alvo;
  }

  const dia = protocolo.diaSemana ?? (ultima ?? { dataHora: protocolo.iniciadoEm }).dataHora.getDay();

  // Sem histórico: a próxima ocorrência do dia-alvo a partir de hoje.
  if (!ultima) {
    const candidato = comHorario(proximoDiaDaSemana(agora, dia), protocolo.horarioMin);
    return candidato.getTime() >= agora.getTime()
      ? candidato
      : comHorario(somarDias(candidato, 7), protocolo.horarioMin);
  }

  // Com histórico: primeira ocorrência do dia-alvo estritamente após a última
  // aplicação. O `+1` evita devolver o próprio dia em que já se aplicou.
  const aposUltima = somarDias(inicioDoDia(ultima.dataHora), 1);
  return comHorario(proximoDiaDaSemana(aposUltima, dia), protocolo.horarioMin);
}

export type StatusDoDia =
  | { estado: 'em_dia'; diasAte: number; proxima: Date }
  | { estado: 'pendente_hoje'; proxima: Date }
  | { estado: 'atrasada'; diasAtraso: number; proxima: Date };

export function statusDoDia(
  protocolo: Protocolo,
  aplicacoes: Aplicacao[],
  agora: Date = new Date(),
): StatusDoDia {
  const proxima = proximaAplicacao(protocolo, aplicacoes, agora);
  const delta = diasEntre(agora, proxima);

  if (delta > 0) return { estado: 'em_dia', diasAte: delta, proxima };
  if (delta === 0) return { estado: 'pendente_hoje', proxima };
  return { estado: 'atrasada', diasAtraso: -delta, proxima };
}

export type Conduta = {
  acao: 'aplicar_agora' | 'pular_para_proxima';
  /** Texto exibido ao usuário. Sempre acompanhado do aviso médico na UI. */
  explicacao: string;
  /** Quando `pular_para_proxima`, a data para a qual seguir. */
  proxima: Date;
};

/**
 * Conduta para dose esquecida.
 *
 * O limite NÃO é constante: depende do produto e vem da prescrição/bula, por
 * isso mora em `protocolo.diasLimiteReposicao`. Hardcodar um número aqui seria
 * embutir uma decisão clínica no código.
 */
export function condutaDoseEsquecida(
  protocolo: Protocolo,
  diasAtraso: number,
  agora: Date = new Date(),
): Conduta {
  const proximaRegular = comHorario(
    proximoDiaDaSemana(somarDias(agora, 1), protocolo.diaSemana ?? agora.getDay()),
    protocolo.horarioMin,
  );

  if (diasAtraso <= protocolo.diasLimiteReposicao) {
    return {
      acao: 'aplicar_agora',
      explicacao: `Ainda dentro da janela de ${protocolo.diasLimiteReposicao} dias definida no seu protocolo. Aplique assim que possível e mantenha o dia habitual na próxima semana.`,
      proxima: proximaRegular,
    };
  }

  return {
    acao: 'pular_para_proxima',
    explicacao: `Passou da janela de ${protocolo.diasLimiteReposicao} dias do seu protocolo. O habitual é não repor a dose e retomar no próximo dia previsto.`,
    proxima: proximaRegular,
  };
}

const REGIOES: RegiaoAplicacao[] = ['abdomen', 'coxa', 'braco'];
const LADOS: LadoAplicacao[] = ['esq', 'dir'];

/** Todos os pontos do rodízio, na ordem em que devem ser percorridos. */
export const PONTOS_RODIZIO: LocalAplicacao[] = REGIOES.flatMap((regiao) =>
  LADOS.map((lado) => ({ regiao, lado })),
);

export function mesmoLocal(a: LocalAplicacao, b: LocalAplicacao): boolean {
  return a.regiao === b.regiao && a.lado === b.lado;
}

/**
 * Próximo ponto do rodízio. Aplicar sempre no mesmo lugar causa lipodistrofia
 * e altera a absorção, então o app sugere o ponto seguinte ao último usado.
 */
export function proximoLocal(aplicacoes: Aplicacao[]): LocalAplicacao {
  const ultimoComLocal = ordenarPorDataDesc(aplicacoes).find((a) => a.local !== null);
  if (!ultimoComLocal?.local) return PONTOS_RODIZIO[0];

  const indice = PONTOS_RODIZIO.findIndex((ponto) => mesmoLocal(ponto, ultimoComLocal.local!));
  if (indice === -1) return PONTOS_RODIZIO[0];

  return PONTOS_RODIZIO[(indice + 1) % PONTOS_RODIZIO.length];
}

const NOME_REGIAO: Record<RegiaoAplicacao, string> = {
  abdomen: 'Abdômen',
  coxa: 'Coxa',
  braco: 'Braço',
};

const NOME_LADO: Record<LadoAplicacao, string> = { esq: 'esquerdo(a)', dir: 'direito(a)' };

export function descreverLocal(local: LocalAplicacao): string {
  return `${NOME_REGIAO[local.regiao]} ${NOME_LADO[local.lado]}`;
}
