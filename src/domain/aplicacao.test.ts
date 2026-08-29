import { describe, expect, it } from 'vitest';
import {
  condutaDoseEsquecida,
  descreverLocal,
  PONTOS_RODIZIO,
  proximaAplicacao,
  proximoLocal,
  statusDoDia,
  ultimaAplicada,
} from './aplicacao';
import { diasEntre } from './datas';
import type { Aplicacao, Protocolo } from './tipos';

const QUINTA = 4;

function protocolo(sobrescrever: Partial<Protocolo> = {}): Protocolo {
  return {
    id: 'p1',
    medicamento: 'Semaglutida',
    medicamentoId: null,
    doseAtualMg: 1,
    frequencia: 'semanal',
    diaSemana: QUINTA,
    horarioMin: 8 * 60,
    planoTitulacao: [],
    diasLimiteReposicao: 2,
    iniciadoEm: new Date(2026, 4, 7),
    ativo: true,
    criadoEm: new Date(2026, 4, 7),
    ...sobrescrever,
  };
}

function aplicacao(dataHora: Date, sobrescrever: Partial<Aplicacao> = {}): Aplicacao {
  return {
    id: `a-${dataHora.toISOString()}`,
    protocoloId: 'p1',
    dataHora,
    doseMg: 1,
    local: null,
    canetaId: null,
    status: 'aplicada',
    observacao: null,
    criadoEm: dataHora,
    ...sobrescrever,
  };
}

describe('proximaAplicacao — semanal', () => {
  it('sem histórico, cai na próxima ocorrência do dia-alvo', () => {
    // Segunda, 01/06/2026.
    const agora = new Date(2026, 5, 1, 10, 0);
    const proxima = proximaAplicacao(protocolo(), [], agora);

    expect(proxima.getDay()).toBe(QUINTA);
    expect(diasEntre(agora, proxima)).toBe(3);
    expect(proxima.getHours()).toBe(8);
  });

  it('no próprio dia-alvo antes do horário, marca para hoje', () => {
    const quinta = new Date(2026, 5, 4, 6, 0);
    const proxima = proximaAplicacao(protocolo(), [], quinta);

    expect(diasEntre(quinta, proxima)).toBe(0);
  });

  it('ancora no dia da semana em vez de somar 7 dias à última aplicação', () => {
    // Aplicou na quinta às 22h; sem âncora, a próxima escorregaria para sexta.
    const ultima = new Date(2026, 5, 4, 22, 30);
    const proxima = proximaAplicacao(protocolo(), [aplicacao(ultima)], new Date(2026, 5, 5, 9, 0));

    expect(proxima.getDay()).toBe(QUINTA);
    expect(diasEntre(ultima, proxima)).toBe(7);
  });

  it('não devolve o mesmo dia em que já se aplicou', () => {
    const hoje = new Date(2026, 5, 4, 8, 30);
    const proxima = proximaAplicacao(protocolo(), [aplicacao(hoje)], new Date(2026, 5, 4, 9, 0));

    expect(diasEntre(hoje, proxima)).toBe(7);
  });

  it('quando a última aplicação foge do diaSemana cadastrado, ancora nela, não no cadastro', () => {
    // Protocolo cadastrado pra quinta, mas ela aplicou na sexta (antecipou/atrasou um dia).
    const sexta = new Date(2026, 5, 5, 10, 15);
    const proxima = proximaAplicacao(protocolo(), [aplicacao(sexta)], new Date(2026, 5, 6, 9, 0));

    // Sem a correção, a próxima quinta cairia no dia seguinte à aplicação (sábado),
    // marcando atraso um dia depois de ter acabado de aplicar.
    expect(proxima.getDay()).toBe(5);
    expect(diasEntre(sexta, proxima)).toBe(7);
  });

  it('ignora doses puladas ao calcular a partir da última aplicada', () => {
    const aplicadaEm = new Date(2026, 5, 4, 8, 0);
    const pulada = aplicacao(new Date(2026, 5, 11, 8, 0), { status: 'pulada' });
    const proxima = proximaAplicacao(
      protocolo(),
      [aplicacao(aplicadaEm), pulada],
      new Date(2026, 5, 12, 9, 0),
    );

    expect(diasEntre(aplicadaEm, proxima)).toBe(7);
  });
});

describe('proximaAplicacao — diária', () => {
  it('marca para o dia seguinte à última aplicação', () => {
    const p = protocolo({ frequencia: 'diaria', diaSemana: null, horarioMin: 20 * 60 });
    const ultima = new Date(2026, 5, 4, 20, 5);
    const proxima = proximaAplicacao(p, [aplicacao(ultima)], new Date(2026, 5, 4, 21, 0));

    expect(diasEntre(ultima, proxima)).toBe(1);
    expect(proxima.getHours()).toBe(20);
  });
});

describe('statusDoDia', () => {
  const p = protocolo();

  it('classifica como em dia quando ainda faltam dias', () => {
    const status = statusDoDia(p, [aplicacao(new Date(2026, 5, 4, 8, 0))], new Date(2026, 5, 8, 9, 0));

    expect(status.estado).toBe('em_dia');
    if (status.estado === 'em_dia') expect(status.diasAte).toBe(3);
  });

  it('classifica como pendente no próprio dia', () => {
    const status = statusDoDia(p, [aplicacao(new Date(2026, 5, 4, 8, 0))], new Date(2026, 5, 11, 7, 0));

    expect(status.estado).toBe('pendente_hoje');
  });

  it('classifica como atrasada e conta os dias', () => {
    const status = statusDoDia(p, [aplicacao(new Date(2026, 5, 4, 8, 0))], new Date(2026, 5, 14, 9, 0));

    expect(status.estado).toBe('atrasada');
    if (status.estado === 'atrasada') expect(status.diasAtraso).toBe(3);
  });
});

describe('condutaDoseEsquecida', () => {
  it('manda aplicar dentro da janela do protocolo', () => {
    const conduta = condutaDoseEsquecida(protocolo({ diasLimiteReposicao: 2 }), 2);
    expect(conduta.acao).toBe('aplicar_agora');
  });

  it('manda pular quando passou da janela', () => {
    const conduta = condutaDoseEsquecida(protocolo({ diasLimiteReposicao: 2 }), 3);
    expect(conduta.acao).toBe('pular_para_proxima');
  });

  it('respeita uma janela diferente sem mudar o código', () => {
    // O limite vem do protocolo justamente porque varia por produto.
    const conduta = condutaDoseEsquecida(protocolo({ diasLimiteReposicao: 4 }), 3);
    expect(conduta.acao).toBe('aplicar_agora');
  });
});

describe('proximoLocal', () => {
  it('começa pelo primeiro ponto quando não há histórico', () => {
    expect(proximoLocal([])).toEqual(PONTOS_RODIZIO[0]);
  });

  it('avança um ponto a partir da última aplicação com local', () => {
    const ultima = aplicacao(new Date(2026, 5, 4), { local: PONTOS_RODIZIO[0] });
    expect(proximoLocal([ultima])).toEqual(PONTOS_RODIZIO[1]);
  });

  it('dá a volta ao chegar no último ponto', () => {
    const fim = PONTOS_RODIZIO[PONTOS_RODIZIO.length - 1];
    const ultima = aplicacao(new Date(2026, 5, 4), { local: fim });
    expect(proximoLocal([ultima])).toEqual(PONTOS_RODIZIO[0]);
  });

  it('nunca repete o local imediatamente anterior', () => {
    let historico: Aplicacao[] = [];
    let anterior = null as null | (typeof PONTOS_RODIZIO)[number];

    for (let i = 0; i < PONTOS_RODIZIO.length * 2; i++) {
      const local = proximoLocal(historico);
      expect(local).not.toEqual(anterior);
      historico = [aplicacao(new Date(2026, 5, 4 + i * 7), { local }), ...historico];
      anterior = local;
    }
  });

  it('ignora aplicações sem local registrado', () => {
    const semLocal = aplicacao(new Date(2026, 5, 11));
    const comLocal = aplicacao(new Date(2026, 5, 4), { local: PONTOS_RODIZIO[2] });

    expect(proximoLocal([semLocal, comLocal])).toEqual(PONTOS_RODIZIO[3]);
  });
});

describe('utilitários', () => {
  it('ultimaAplicada desconsidera doses puladas', () => {
    const aplicada = aplicacao(new Date(2026, 5, 4));
    const pulada = aplicacao(new Date(2026, 5, 11), { status: 'pulada' });

    expect(ultimaAplicada([pulada, aplicada])?.id).toBe(aplicada.id);
  });

  it('descreverLocal produz texto legível', () => {
    expect(descreverLocal({ regiao: 'abdomen', lado: 'esq' })).toBe('Abdômen esquerdo(a)');
  });
});
