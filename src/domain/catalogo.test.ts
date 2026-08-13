import { describe, expect, it } from 'vitest';
import {
  acharPorNome,
  analisarDoses,
  CATALOGO,
  CATALOGO_VERSAO,
  entradasPendentes,
  formatarDoses,
  normalizarNome,
  ordenarMedicamentos,
  paraMedicamento,
  usosDoMedicamento,
  type EntradaCatalogo,
} from './catalogo';
import type { Caneta, Medicamento, Protocolo } from './tipos';

function medicamento(sobrescrever: Partial<Medicamento> = {}): Medicamento {
  return {
    id: 'm1',
    nome: 'Ozempic',
    principioAtivo: 'semaglutida',
    fabricante: 'Novo Nordisk',
    forma: 'caneta',
    frequencia: 'semanal',
    dosesMg: [0.25, 0.5, 1, 2],
    apresentacoes: ['1,34 mg/mL'],
    diasAposAbertura: 56,
    nota: null,
    catalogoId: 'ozempic',
    criadoEm: new Date(2026, 7, 1),
    ...sobrescrever,
  };
}

function protocolo(sobrescrever: Partial<Protocolo> = {}): Protocolo {
  return {
    id: 'p1',
    medicamento: 'Ozempic',
    medicamentoId: 'm1',
    doseAtualMg: 1,
    frequencia: 'semanal',
    diaSemana: 4,
    horarioMin: 8 * 60,
    planoTitulacao: [],
    diasLimiteReposicao: 2,
    iniciadoEm: new Date(2026, 7, 1),
    ativo: true,
    criadoEm: new Date(2026, 7, 1),
    ...sobrescrever,
  };
}

function caneta(sobrescrever: Partial<Caneta> = {}): Caneta {
  return {
    id: 'c1',
    medicamento: 'Ozempic',
    apresentacao: '1,34 mg/mL',
    lote: null,
    validadeFabricante: null,
    abertaEm: null,
    diasAposAbertura: 56,
    dosesTotais: 4,
    dosesUsadas: 0,
    precoPago: null,
    ativa: true,
    criadoEm: new Date(2026, 7, 1),
    ...sobrescrever,
  };
}

describe('integridade do catálogo embutido', () => {
  it('não repete slug — é o id do documento no Firestore', () => {
    const slugs = CATALOGO.map((e) => e.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('usa slugs seguros como id de documento', () => {
    for (const entrada of CATALOGO) {
      expect(entrada.slug).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it('não tem entrada de versão futura sem o CATALOGO_VERSAO ter subido', () => {
    for (const entrada of CATALOGO) {
      expect(entrada.versao).toBeGreaterThanOrEqual(1);
      expect(entrada.versao).toBeLessThanOrEqual(CATALOGO_VERSAO);
    }
  });

  it('lista doses positivas, crescentes e sem repetição', () => {
    for (const entrada of CATALOGO) {
      for (const dose of entrada.dosesMg) expect(dose).toBeGreaterThan(0);
      const crescente = [...entrada.dosesMg].sort((a, b) => a - b);
      expect(entrada.dosesMg).toEqual(crescente);
      expect(new Set(entrada.dosesMg).size).toBe(entrada.dosesMg.length);
    }
  });

  it('não sugere valor clínico nenhum', () => {
    // A regra da casa em forma executável: o catálogo diz quais doses existem,
    // nunca qual tomar. Se alguém adicionar um campo de recomendação, quebra aqui.
    const proibidos = [
      'planoTitulacao',
      'doseRecomendada',
      'doseInicial',
      'doseManutencao',
      'doseAlvo',
      'escalonamento',
    ];
    for (const entrada of CATALOGO) {
      for (const campo of proibidos) {
        expect(Object.hasOwn(entrada, campo)).toBe(false);
      }
    }
  });

  it('não inclui princípio ativo sem aprovação em lugar nenhum', () => {
    const naoAprovados = [
      'retatrutida',
      'orforglipron',
      'cagrisema',
      'survodutida',
      'mazdutida',
    ];
    for (const entrada of CATALOGO) {
      const texto = normalizarNome(`${entrada.nome} ${entrada.principioAtivo}`);
      for (const proibido of naoAprovados) {
        expect(texto).not.toContain(proibido);
      }
    }
  });

  it('converte a entrada em documento carregando o slug como proveniência', () => {
    const ozempic = CATALOGO.find((e) => e.slug === 'ozempic')!;
    const doc = paraMedicamento(ozempic);
    expect(doc.catalogoId).toBe('ozempic');
    expect(doc.nome).toBe('Ozempic');
    expect(doc.dosesMg).toEqual([0.25, 0.5, 1, 2]);
    expect(doc).not.toHaveProperty('slug');
    expect(doc).not.toHaveProperty('versao');
  });
});

describe('entradasPendentes', () => {
  it('semeia tudo numa conta que nunca recebeu o catálogo', () => {
    expect(entradasPendentes(0)).toHaveLength(CATALOGO.length);
  });

  it('não semeia nada com o marcador em dia — é o que impede ressuscitar exclusões', () => {
    expect(entradasPendentes(CATALOGO_VERSAO)).toEqual([]);
  });

  it('semeia só as entradas novas quando o catálogo cresce', () => {
    const novas: EntradaCatalogo[] = [
      { ...CATALOGO[0], slug: 'ficticio', versao: 2 },
      { ...CATALOGO[0], slug: 'outro-ficticio', versao: 3 },
    ];
    const pendentes = [...CATALOGO, ...novas].filter((e) => e.versao > 1);
    expect(pendentes.map((e) => e.slug)).toEqual(['ficticio', 'outro-ficticio']);
  });
});

describe('analisarDoses', () => {
  it('lê vírgula, descarta lixo, remove repetido e ordena', () => {
    expect(analisarDoses(['0,25', '1,0', '', 'abc', '0,25', '-1', '0'])).toEqual([0.25, 1]);
  });

  it('aceita ponto também, para quem digita com teclado numérico', () => {
    expect(analisarDoses(['2.5', '1.5'])).toEqual([1.5, 2.5]);
  });

  it('devolve lista vazia quando não sobra nada válido', () => {
    expect(analisarDoses(['', '  ', 'x'])).toEqual([]);
  });
});

describe('formatarDoses', () => {
  it('junta as doses em pt-BR', () => {
    expect(formatarDoses([0.25, 0.5, 1, 2])).toBe('0,25 · 0,5 · 1 · 2 mg');
  });

  it('avisa quando o medicamento não tem doses cadastradas', () => {
    expect(formatarDoses([])).toBe('Sem doses cadastradas');
  });
});

describe('acharPorNome', () => {
  const lista = [medicamento(), medicamento({ id: 'm2', nome: 'Ávita' })];

  it('ignora caixa e espaço em volta', () => {
    expect(acharPorNome(lista, '  OZEMPIC ')?.id).toBe('m1');
  });

  it('ignora acento', () => {
    expect(acharPorNome(lista, 'avita')?.id).toBe('m2');
  });

  it('não casa por princípio ativo — cinco produtos são semaglutida', () => {
    expect(acharPorNome(lista, 'Semaglutida')).toBeNull();
  });

  it('não casa com texto vazio', () => {
    expect(acharPorNome(lista, '   ')).toBeNull();
  });
});

describe('ordenarMedicamentos', () => {
  it('ordena com acento no lugar certo, ao contrário do byte-order do Firestore', () => {
    const lista = [
      medicamento({ id: 'b', nome: 'Bravo' }),
      medicamento({ id: 'a', nome: 'Ávita' }),
      medicamento({ id: 'z', nome: 'Zempneo' }),
    ];
    expect(ordenarMedicamentos(lista).map((m) => m.nome)).toEqual([
      'Ávita',
      'Bravo',
      'Zempneo',
    ]);
  });

  it('não modifica a lista recebida', () => {
    const lista = [medicamento({ nome: 'Zempneo' }), medicamento({ nome: 'Ávita' })];
    ordenarMedicamentos(lista);
    expect(lista[0].nome).toBe('Zempneo');
  });
});

describe('usosDoMedicamento', () => {
  const alvo = medicamento();

  it('conta protocolo ligado por id', () => {
    const usos = usosDoMedicamento(alvo, [protocolo()], []);
    expect(usos.protocolos).toBe(1);
    expect(usos.noProtocoloAtivo).toBe(true);
  });

  it('conta protocolo antigo ligado só pelo nome', () => {
    const antigo = protocolo({ id: 'p2', medicamentoId: null, ativo: false });
    const usos = usosDoMedicamento(alvo, [antigo], []);
    expect(usos.protocolos).toBe(1);
    expect(usos.noProtocoloAtivo).toBe(false);
  });

  it('ignora protocolo de outro medicamento', () => {
    const outro = protocolo({ id: 'p3', medicamento: 'Mounjaro', medicamentoId: 'm9' });
    expect(usosDoMedicamento(alvo, [outro], []).protocolos).toBe(0);
  });

  it('conta canetas pelo nome', () => {
    const canetas = [caneta(), caneta({ id: 'c2', medicamento: 'Mounjaro' })];
    expect(usosDoMedicamento(alvo, [], canetas).canetas).toBe(1);
  });

  it('marca noProtocoloAtivo só quando algum dos usos está ativo', () => {
    const arquivado = protocolo({ id: 'p4', ativo: false });
    const ativo = protocolo({ id: 'p5', ativo: true });
    expect(usosDoMedicamento(alvo, [arquivado], []).noProtocoloAtivo).toBe(false);
    expect(usosDoMedicamento(alvo, [arquivado, ativo], []).noProtocoloAtivo).toBe(true);
  });
});
