import {
  collection,
  doc,
  Timestamp,
  type CollectionReference,
  type DocumentData,
  type DocumentReference,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { getDb } from './firebase';
import type {
  Agenda,
  Aplicacao,
  Caneta,
  DiaSemana,
  Efeito,
  Medicamento,
  Medida,
  Perfil,
  PlanoAlimentar,
  Protocolo,
  RegistroFoto,
  RegistroHidratacao,
  RegistroIntestino,
  RegistroPeso,
  RegistroRefeicao,
  RegistroSintoma,
  SementeCatalogo,
} from '@/domain/tipos';

/**
 * Fronteira entre o Firestore e o domínio.
 *
 * Só este arquivo conhece `Timestamp`. Acima daqui tudo é `Date`, o que
 * mantém as regras de `src/domain` testáveis sem tocar no Firebase.
 */

const paraData = (valor: unknown): Date | null =>
  valor instanceof Timestamp ? valor.toDate() : valor instanceof Date ? valor : null;

const paraTimestamp = (valor: Date | null | undefined) =>
  valor ? Timestamp.fromDate(valor) : null;

/** Só 0–6 é dia da semana válido; qualquer outra coisa vira null. */
function paraDiaSemana(valor: unknown): DiaSemana | null {
  const n = Number(valor);
  return Number.isInteger(n) && n >= 0 && n <= 6 ? (n as DiaSemana) : null;
}

/** Converter genérico: injeta o `id` na leitura e o remove na escrita. */
function converter<T extends { id: string }>(
  aoLer: (dados: DocumentData) => Omit<T, 'id'>,
  aoEscrever: (item: Omit<T, 'id'>) => DocumentData,
): FirestoreDataConverter<T, DocumentData> {
  return {
    toFirestore: (item) => {
      const { id: _id, ...resto } = item as T;
      return aoEscrever(resto as Omit<T, 'id'>);
    },
    fromFirestore: (snap: QueryDocumentSnapshot) =>
      ({ id: snap.id, ...aoLer(snap.data()) }) as T,
  };
}

export const conversorProtocolo = converter<Protocolo>(
  (d) => ({
    medicamento: String(d.medicamento ?? ''),
    // Protocolos criados antes do catálogo existir não têm o campo: o default
    // aqui é o que dispensa qualquer migração de dados.
    medicamentoId: d.medicamentoId ?? null,
    doseAtualMg: Number(d.doseAtualMg ?? 0),
    frequencia: d.frequencia === 'diaria' ? 'diaria' : 'semanal',
    diaSemana: paraDiaSemana(d.diaSemana),
    horarioMin: Number(d.horarioMin ?? 480),
    planoTitulacao: Array.isArray(d.planoTitulacao) ? d.planoTitulacao : [],
    diasLimiteReposicao: Number(d.diasLimiteReposicao ?? 2),
    iniciadoEm: paraData(d.iniciadoEm) ?? new Date(),
    ativo: Boolean(d.ativo),
    criadoEm: paraData(d.criadoEm) ?? new Date(),
  }),
  (p) => ({
    medicamento: p.medicamento,
    medicamentoId: p.medicamentoId,
    doseAtualMg: p.doseAtualMg,
    frequencia: p.frequencia,
    diaSemana: p.diaSemana,
    horarioMin: p.horarioMin,
    planoTitulacao: p.planoTitulacao,
    diasLimiteReposicao: p.diasLimiteReposicao,
    iniciadoEm: paraTimestamp(p.iniciadoEm),
    ativo: p.ativo,
    criadoEm: paraTimestamp(p.criadoEm),
  }),
) as FirestoreDataConverter<Protocolo, DocumentData>;

export const conversorAplicacao = converter<Aplicacao>(
  (d) => ({
    protocoloId: String(d.protocoloId ?? ''),
    dataHora: paraData(d.dataHora) ?? new Date(),
    doseMg: Number(d.doseMg ?? 0),
    local: d.local ?? null,
    canetaId: d.canetaId ?? null,
    status: d.status === 'pulada' ? 'pulada' : 'aplicada',
    observacao: d.observacao ?? null,
    criadoEm: paraData(d.criadoEm) ?? new Date(),
  }),
  (a) => ({
    protocoloId: a.protocoloId,
    dataHora: paraTimestamp(a.dataHora),
    doseMg: a.doseMg,
    local: a.local,
    canetaId: a.canetaId,
    status: a.status,
    observacao: a.observacao,
    criadoEm: paraTimestamp(a.criadoEm),
  }),
) as FirestoreDataConverter<Aplicacao, DocumentData>;

export const conversorCaneta = converter<Caneta>(
  (d) => ({
    medicamento: String(d.medicamento ?? ''),
    apresentacao: String(d.apresentacao ?? ''),
    lote: d.lote ?? null,
    validadeFabricante: paraData(d.validadeFabricante),
    abertaEm: paraData(d.abertaEm),
    diasAposAbertura: d.diasAposAbertura ?? null,
    dosesTotais: Number(d.dosesTotais ?? 0),
    dosesUsadas: Number(d.dosesUsadas ?? 0),
    precoPago: d.precoPago ?? null,
    ativa: Boolean(d.ativa),
    criadoEm: paraData(d.criadoEm) ?? new Date(),
  }),
  (c) => ({
    medicamento: c.medicamento,
    apresentacao: c.apresentacao,
    lote: c.lote,
    validadeFabricante: paraTimestamp(c.validadeFabricante),
    abertaEm: paraTimestamp(c.abertaEm),
    diasAposAbertura: c.diasAposAbertura,
    dosesTotais: c.dosesTotais,
    dosesUsadas: c.dosesUsadas,
    precoPago: c.precoPago,
    ativa: c.ativa,
    criadoEm: paraTimestamp(c.criadoEm),
  }),
) as FirestoreDataConverter<Caneta, DocumentData>;

export const conversorMedicamento = converter<Medicamento>(
  (d) => ({
    nome: String(d.nome ?? ''),
    principioAtivo: String(d.principioAtivo ?? ''),
    fabricante: d.fabricante ?? null,
    forma: d.forma === 'oral' ? 'oral' : 'caneta',
    frequencia:
      d.frequencia === 'diaria' ? 'diaria' : d.frequencia === 'semanal' ? 'semanal' : null,
    dosesMg: Array.isArray(d.dosesMg)
      ? d.dosesMg.map(Number).filter((n: number) => Number.isFinite(n) && n > 0)
      : [],
    apresentacoes: Array.isArray(d.apresentacoes) ? d.apresentacoes.map(String) : [],
    diasAposAbertura: d.diasAposAbertura ?? null,
    nota: d.nota ?? null,
    catalogoId: d.catalogoId ?? null,
    criadoEm: paraData(d.criadoEm) ?? new Date(),
  }),
  (m) => ({
    nome: m.nome,
    principioAtivo: m.principioAtivo,
    fabricante: m.fabricante,
    forma: m.forma,
    frequencia: m.frequencia,
    dosesMg: m.dosesMg,
    apresentacoes: m.apresentacoes,
    diasAposAbertura: m.diasAposAbertura,
    nota: m.nota,
    catalogoId: m.catalogoId,
    criadoEm: paraTimestamp(m.criadoEm),
  }),
) as FirestoreDataConverter<Medicamento, DocumentData>;

export const conversorSementeCatalogo: FirestoreDataConverter<
  SementeCatalogo,
  DocumentData
> = {
  toFirestore: (s) => ({
    versao: s.versao,
    semeadoEm: paraTimestamp(s.semeadoEm as Date | null),
  }),
  fromFirestore: (snap) => {
    const d = snap.data();
    return { versao: Number(d.versao ?? 0), semeadoEm: paraData(d.semeadoEm) };
  },
};

export const conversorMedida = converter<Medida>(
  (d) => ({
    data: paraData(d.data) ?? new Date(),
    pesoKg: d.pesoKg ?? null,
    cinturaCm: d.cinturaCm ?? null,
  }),
  (m) => ({ data: paraTimestamp(m.data), pesoKg: m.pesoKg, cinturaCm: m.cinturaCm }),
) as FirestoreDataConverter<Medida, DocumentData>;

export const conversorRegistroPeso = converter<RegistroPeso>(
  (d) => ({
    weight: Number(d.weight ?? 0),
    waist: d.waist ?? null,
    recordedAt: paraData(d.recordedAt) ?? new Date(),
    notes: d.notes ?? null,
  }),
  (r) => ({
    weight: r.weight,
    waist: r.waist,
    recordedAt: paraTimestamp(r.recordedAt),
    notes: r.notes,
  }),
) as FirestoreDataConverter<RegistroPeso, DocumentData>;

export const conversorRegistroHidratacao = converter<RegistroHidratacao>(
  (d) => ({
    amount_ml: Number(d.amount_ml ?? 0),
    recordedAt: paraData(d.recordedAt) ?? new Date(),
  }),
  (r) => ({
    amount_ml: r.amount_ml,
    recordedAt: paraTimestamp(r.recordedAt),
  }),
) as FirestoreDataConverter<RegistroHidratacao, DocumentData>;

export const conversorRegistroSintoma = converter<RegistroSintoma>(
  (d) => ({
    symptom: String(d.symptom ?? ''),
    intensity: (d.intensity ?? 'Leve') as RegistroSintoma['intensity'],
    recordedAt: paraData(d.recordedAt) ?? new Date(),
    notes: d.notes ?? null,
  }),
  (r) => ({
    symptom: r.symptom,
    intensity: r.intensity,
    recordedAt: paraTimestamp(r.recordedAt),
    notes: r.notes,
  }),
) as FirestoreDataConverter<RegistroSintoma, DocumentData>;

export const conversorRegistroIntestino = converter<RegistroIntestino>(
  (d) => ({
    type: (d.type ?? 'Normal') as RegistroIntestino['type'],
    recordedAt: paraData(d.recordedAt) ?? new Date(),
  }),
  (r) => ({
    type: r.type,
    recordedAt: paraTimestamp(r.recordedAt),
  }),
) as FirestoreDataConverter<RegistroIntestino, DocumentData>;

export const conversorPlanoAlimentar = converter<PlanoAlimentar>(
  (d) => ({
    title: String(d.title ?? ''),
    isActive: Boolean(d.isActive),
    meals: Array.isArray(d.meals) ? d.meals : [],
    createdAt: paraData(d.createdAt) ?? new Date(),
  }),
  (p) => ({
    title: p.title,
    isActive: p.isActive,
    meals: p.meals,
    createdAt: paraTimestamp(p.createdAt),
  }),
) as FirestoreDataConverter<PlanoAlimentar, DocumentData>;

export const conversorEfeito = converter<Efeito>(
  (d) => ({
    data: paraData(d.data) ?? new Date(),
    tipo: d.tipo ?? 'outro',
    intensidade: Number(d.intensidade ?? 1) as Efeito['intensidade'],
    observacao: d.observacao ?? null,
  }),
  (e) => ({
    data: paraTimestamp(e.data),
    tipo: e.tipo,
    intensidade: e.intensidade,
    observacao: e.observacao,
  }),
) as FirestoreDataConverter<Efeito, DocumentData>;

export const conversorPerfil: FirestoreDataConverter<Perfil, DocumentData> = {
  toFirestore: (p) => ({
    nome: p.nome,
    alturaCm: p.alturaCm ?? null,
    criadoEm: paraTimestamp(p.criadoEm as Date),
  }),
  fromFirestore: (snap) => {
    const d = snap.data();
    return {
      nome: String(d.nome ?? ''),
      alturaCm: d.alturaCm ?? null,
      criadoEm: paraData(d.criadoEm) ?? new Date(),
    };
  },
};

export const conversorAgenda: FirestoreDataConverter<Agenda, DocumentData> = {
  toFirestore: (a) => ({
    proximaEm: paraTimestamp(a.proximaEm as Date | null),
    notificadaEm: paraTimestamp(a.notificadaEm as Date | null),
    protocoloId: a.protocoloId ?? null,
  }),
  fromFirestore: (snap) => {
    const d = snap.data();
    return {
      proximaEm: paraData(d.proximaEm),
      notificadaEm: paraData(d.notificadaEm),
      protocoloId: d.protocoloId ?? null,
    };
  },
};

export const conversorRegistroFoto = converter<RegistroFoto>(
  (d) => ({
    imageUrl: String(d.imageUrl ?? ''),
    storagePath: String(d.storagePath ?? ''),
    angle: (d.angle ?? 'Frente') as RegistroFoto['angle'],
    recordedAt: paraData(d.recordedAt) ?? new Date(),
  }),
  (r) => ({
    imageUrl: r.imageUrl,
    storagePath: r.storagePath,
    angle: r.angle,
    recordedAt: paraTimestamp(r.recordedAt),
  }),
) as FirestoreDataConverter<RegistroFoto, DocumentData>;

export const conversorRegistroRefeicao = converter<RegistroRefeicao>(
  (d) => ({
    imageUrl: String(d.imageUrl ?? ''),
    storagePath: String(d.storagePath ?? ''),
    items: Array.isArray(d.items) ? d.items : [],
    macros: {
      protein: Number(d.macros?.protein ?? 0),
      carbs: Number(d.macros?.carbs ?? 0),
      fat: Number(d.macros?.fat ?? 0),
      kcal: Number(d.macros?.kcal ?? 0),
    },
    aiFeedback: String(d.aiFeedback ?? ''),
    status: (d.status === 'completed' ? 'completed' : 'pending') as RegistroRefeicao['status'],
    consumedPercentage: d.consumedPercentage ?? null,
    createdAt: paraData(d.createdAt) ?? new Date(),
  }),
  (r) => ({
    imageUrl: r.imageUrl,
    storagePath: r.storagePath,
    items: r.items,
    macros: r.macros,
    aiFeedback: r.aiFeedback,
    status: r.status,
    consumedPercentage: r.consumedPercentage,
    createdAt: paraTimestamp(r.createdAt),
  }),
) as FirestoreDataConverter<RegistroRefeicao, DocumentData>;

/* ---- Referências tipadas ------------------------------------------------ */

const docUsuario = (uid: string): DocumentReference<DocumentData> => doc(getDb(), 'users', uid);

type CampoUsuario = { height: number | null; hydration_goal: number | null };

const conversorCampoUsuario: FirestoreDataConverter<CampoUsuario, DocumentData> = {
  // Escritas aqui são sempre parciais (merge de um campo por vez), então só
  // manda o que veio de fato — incluir a chave com `undefined` faz o
  // Firestore rejeitar a escrita inteira.
  toFirestore: (u) => {
    const dados: DocumentData = {};
    if (u.height !== undefined) dados.height = u.height;
    if (u.hydration_goal !== undefined) dados.hydration_goal = u.hydration_goal;
    return dados;
  },
  fromFirestore: (snap) => ({
    height: snap.data().height ?? null,
    hydration_goal: snap.data().hydration_goal ?? null,
  }),
};

/** Doc raiz do usuário, só para o campo `height` — `docUsuario` acima fica sem converter porque também serve de pai para as subcoleções. */
export const refUsuario = (uid: string) =>
  doc(getDb(), 'users', uid).withConverter(conversorCampoUsuario);

export const refPerfil = (uid: string) =>
  doc(getDb(), 'users', uid, 'meta', 'perfil').withConverter(conversorPerfil);

/**
 * Doc denormalizado que a Cloud Function de lembretes varre com uma única
 * `collectionGroup('agenda')`. Sempre derivado — nunca fonte da verdade.
 */
export const refAgenda = (uid: string) =>
  doc(getDb(), 'users', uid, 'agenda', 'proxima').withConverter(conversorAgenda);

/**
 * Marcador de qual versão do catálogo embutido já foi semeada na conta.
 *
 * Doc próprio em vez de campo em `Perfil` de propósito: `garantirPerfil` roda
 * a cada login com um `Perfil` literal completo, e `{ merge: true }` não
 * protege campo que está sendo enviado. Um campo novo lá seria zerado toda vez
 * e a semente ressuscitaria tudo que o usuário tivesse excluído.
 */
export const refSementeCatalogo = (uid: string) =>
  doc(getDb(), 'users', uid, 'meta', 'catalogo').withConverter(conversorSementeCatalogo);

export const colProtocolos = (uid: string): CollectionReference<Protocolo> =>
  collection(docUsuario(uid), 'protocolos').withConverter(conversorProtocolo);

export const colAplicacoes = (uid: string): CollectionReference<Aplicacao> =>
  collection(docUsuario(uid), 'aplicacoes').withConverter(conversorAplicacao);

export const colCanetas = (uid: string): CollectionReference<Caneta> =>
  collection(docUsuario(uid), 'canetas').withConverter(conversorCaneta);

export const colMedicamentos = (uid: string): CollectionReference<Medicamento> =>
  collection(docUsuario(uid), 'medicamentos').withConverter(conversorMedicamento);

export const colMedidas = (uid: string): CollectionReference<Medida> =>
  collection(docUsuario(uid), 'medidas').withConverter(conversorMedida);

export const colHistoricoPeso = (uid: string): CollectionReference<RegistroPeso> =>
  collection(docUsuario(uid), 'weight_history').withConverter(conversorRegistroPeso);

export const colSintomas = (uid: string): CollectionReference<RegistroSintoma> =>
  collection(docUsuario(uid), 'symptom_logs').withConverter(conversorRegistroSintoma);

export const colEfeitos = (uid: string): CollectionReference<Efeito> =>
  collection(docUsuario(uid), 'efeitos').withConverter(conversorEfeito);

export const colBowelLogs = (uid: string): CollectionReference<RegistroIntestino> =>
  collection(docUsuario(uid), 'bowel_logs').withConverter(conversorRegistroIntestino);

export const colHidratacao = (uid: string): CollectionReference<RegistroHidratacao> =>
  collection(docUsuario(uid), 'hydration_logs').withConverter(conversorRegistroHidratacao);

export const colPlanosAlimentares = (uid: string): CollectionReference<PlanoAlimentar> =>
  collection(docUsuario(uid), 'diet_plans').withConverter(conversorPlanoAlimentar);

export const colFotosProgresso = (uid: string): CollectionReference<RegistroFoto> =>
  collection(docUsuario(uid), 'progress_photos').withConverter(conversorRegistroFoto);

export const colRefeicoes = (uid: string): CollectionReference<RegistroRefeicao> =>
  collection(docUsuario(uid), 'meals').withConverter(conversorRegistroRefeicao);
