import { getFirestore, Timestamp, type QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';

const REGIAO = 'southamerica-east1';
const FUSO = 'America/Sao_Paulo';

/**
 * Envia uma notificação para todos os tokens FCM salvos em `users/{uid}` e
 * remove da lista os tokens que o FCM reporta como mortos (desinstalado,
 * permissão revogada, etc.) — sem isso `fcmTokens` só cresce para sempre.
 */
export async function enviarParaUsuario(uid: string, titulo: string, corpo: string): Promise<number> {
  const db = getFirestore();
  const docUsuario = db.collection('users').doc(uid);
  const snap = await docUsuario.get();
  const tokens = (snap.data()?.fcmTokens ?? []) as string[];
  if (tokens.length === 0) return 0;

  const resposta = await getMessaging().sendEachForMulticast({
    tokens,
    notification: { title: titulo, body: corpo },
  });

  const tokensInvalidos = resposta.responses
    .map((r, i) => (!r.success && ehTokenInvalido(r.error?.code) ? tokens[i] : null))
    .filter((t): t is string => t !== null);

  if (tokensInvalidos.length > 0) {
    await docUsuario.update({
      fcmTokens: tokens.filter((t) => !tokensInvalidos.includes(t)),
    });
  }

  return resposta.successCount;
}

function ehTokenInvalido(codigo: string | undefined): boolean {
  return (
    codigo === 'messaging/registration-token-not-registered' ||
    codigo === 'messaging/invalid-registration-token'
  );
}

function inicioDoDia(data: Date): Date {
  const d = new Date(data);
  d.setHours(0, 0, 0, 0);
  return d;
}

function fimDoDia(data: Date): Date {
  const d = new Date(data);
  d.setHours(23, 59, 59, 999);
  return d;
}

/** Extrai o uid do usuário dono de um doc de subcoleção, ex. `users/{uid}/agenda/proxima`. */
function uidDoDoc(caminho: string): string | null {
  const partes = caminho.split('/');
  const indice = partes.indexOf('users');
  return indice >= 0 && partes.length > indice + 1 ? partes[indice + 1] : null;
}

/**
 * Dispara uma notificação de teste imediata para o usuário autenticado —
 * usada pelo botão "Testar Notificação" em Ajustes > Lembretes.
 */
export const testarNotificacao = onCall({ region: REGIAO, cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'É necessário estar logado.');
  }

  const enviados = await enviarParaUsuario(
    request.auth.uid,
    'DoseCerta',
    'Notificação de teste — se você está vendo isso, está tudo funcionando! 🎉',
  );

  if (enviados === 0) {
    throw new HttpsError(
      'failed-precondition',
      'Nenhum dispositivo com notificações habilitadas foi encontrado.',
    );
  }

  return { enviados };
});

/**
 * Diariamente às 08:00: varre `agenda/proxima` de todos os usuários (doc
 * denormalizado mantido por `sincronizarAgenda` no cliente) buscando quem
 * tem aplicação prevista para hoje e ainda não foi notificado hoje.
 */
export const lembreteAplicacao = onSchedule(
  { schedule: '0 8 * * *', timeZone: FUSO, region: REGIAO },
  async () => {
    const db = getFirestore();
    const agora = new Date();
    const inicio = Timestamp.fromDate(inicioDoDia(agora));
    const fim = Timestamp.fromDate(fimDoDia(agora));

    const snap = await db
      .collectionGroup('agenda')
      .where('proximaEm', '>=', inicio)
      .where('proximaEm', '<=', fim)
      .get();

    for (const doc of snap.docs) {
      const uid = uidDoDoc(doc.ref.path);
      if (!uid) continue;

      const notificadaEm = doc.data().notificadaEm as Timestamp | null | undefined;
      if (notificadaEm && notificadaEm.toDate() >= inicioDoDia(agora)) continue;

      await enviarParaUsuario(
        uid,
        'Dia de Dose Certa! 💉',
        'Lembre-se de registrar sua aplicação hoje.',
      );
      await doc.ref.update({ notificadaEm: Timestamp.now() });
    }
  },
);

/**
 * Diariamente às 10:00: quem registrou sintoma ontem recebe um acompanhamento.
 */
export const acompanhamentoSintoma = onSchedule(
  { schedule: '0 10 * * *', timeZone: FUSO, region: REGIAO },
  async () => {
    const db = getFirestore();
    const ontem = new Date();
    ontem.setDate(ontem.getDate() - 1);
    const inicio = Timestamp.fromDate(inicioDoDia(ontem));
    const fim = Timestamp.fromDate(fimDoDia(ontem));

    const snap = await db
      .collectionGroup('symptom_logs')
      .where('recordedAt', '>=', inicio)
      .where('recordedAt', '<=', fim)
      .get();

    const uidsNotificados = new Set<string>();
    for (const doc of snap.docs) {
      const uid = uidDoDoc(doc.ref.path);
      if (!uid || uidsNotificados.has(uid)) continue;
      uidsNotificados.add(uid);

      await enviarParaUsuario(
        uid,
        'Como você está hoje?',
        'Ontem você relatou desconforto. Seu Co-piloto tem dicas para te ajudar.',
      );
    }
  },
);

const ML_POR_KG_PESO = 35;
const META_HIDRATACAO_PADRAO_ML = 2000;

/**
 * Mesma regra de `src/domain/hidratacao.ts` (peso×35ml, com fallback fixo) —
 * duplicada aqui porque `functions/` é outro pacote e não importa `src/`.
 */
async function metaHidratacaoDoUsuario(usuario: QueryDocumentSnapshot): Promise<number> {
  const hydrationGoal = usuario.data().hydration_goal;
  if (typeof hydrationGoal === 'number' && hydrationGoal > 0) return hydrationGoal;

  const ultimoPeso = await usuario.ref
    .collection('weight_history')
    .orderBy('recordedAt', 'desc')
    .limit(1)
    .get();

  const pesoKg = ultimoPeso.empty ? null : (ultimoPeso.docs[0].data().weight as number | undefined);
  return pesoKg ? Math.round(pesoKg * ML_POR_KG_PESO) : META_HIDRATACAO_PADRAO_ML;
}

/** Soma `amount_ml` de `hydration_logs` registrados hoje. */
async function totalHidratacaoHoje(userRef: FirebaseFirestore.DocumentReference): Promise<number> {
  const agora = new Date();
  const inicio = Timestamp.fromDate(inicioDoDia(agora));
  const fim = Timestamp.fromDate(fimDoDia(agora));

  const snap = await userRef
    .collection('hydration_logs')
    .where('recordedAt', '>=', inicio)
    .where('recordedAt', '<=', fim)
    .get();

  return snap.docs.reduce((total, doc) => total + Number(doc.data().amount_ml ?? 0), 0);
}

/**
 * Diariamente às 15:00: quem bebeu menos de 50% da meta até agora recebe um
 * empurrão. Não dispara para quem já bateu a meta (condição `< 50%` já cobre).
 */
export const hidratacaoMetadeDia = onSchedule(
  { schedule: '0 15 * * *', timeZone: FUSO, region: REGIAO },
  async () => {
    const db = getFirestore();
    const usuarios = await db.collection('users').where('fcmTokens', '!=', []).get();

    for (const usuario of usuarios.docs) {
      const meta = await metaHidratacaoDoUsuario(usuario);
      const total = await totalHidratacaoHoje(usuario.ref);
      if (total >= meta * 0.5) continue;

      await enviarParaUsuario(
        usuario.id,
        '💧 Hora de beber água',
        'Opa! Já passou do meio-dia e você bebeu pouca água. Que tal um copo agora?',
      );
    }
  },
);

/**
 * Diariamente às 19:00: quem está entre 50% e 100% da meta recebe um
 * incentivo com a quantidade exata que falta. Quem já bateu a meta (>=100%)
 * ou está abaixo de 50% (já coberto pelo aviso das 15h) não recebe nada.
 */
export const hidratacaoRetaFinal = onSchedule(
  { schedule: '0 19 * * *', timeZone: FUSO, region: REGIAO },
  async () => {
    const db = getFirestore();
    const usuarios = await db.collection('users').where('fcmTokens', '!=', []).get();

    for (const usuario of usuarios.docs) {
      const meta = await metaHidratacaoDoUsuario(usuario);
      const total = await totalHidratacaoHoje(usuario.ref);
      if (total < meta * 0.5 || total >= meta) continue;

      const faltam = meta - total;
      await enviarParaUsuario(
        usuario.id,
        '🏆 Quase lá!',
        `Faltam só ${faltam} ml para bater sua meta de hidratação hoje!`,
      );
    }
  },
);

const PROTEINA_G_POR_KG = 1.35;
const KCAL_POR_KG = 24;
const PISO_KCAL_SEGURO = 1200;

type MetasNutricao = { proteinGoalG: number; kcalGoal: number };

/**
 * Meta real vem do Plano Alimentar ativo (`diet_plans`, campo `0` = não
 * definido). Na ausência de meta no plano, cai pro mesmo fallback por peso de
 * `src/domain/refeicao.ts` (duplicado aqui pelo mesmo motivo de sempre:
 * `functions/` não importa `src/`). `nutritionGoals` no doc do usuário não é
 * usado — hoje nenhum fluxo da UI grava esse campo.
 *
 * Retorna `null` quando nem o plano nem o peso dão uma meta pra nenhum dos
 * dois campos — nesse caso não há base pra comparar e o usuário é pulado.
 */
async function metasNutricaoDoUsuario(usuario: QueryDocumentSnapshot): Promise<MetasNutricao | null> {
  const planoAtivo = await usuario.ref
    .collection('diet_plans')
    .where('isActive', '==', true)
    .limit(1)
    .get();

  const proteinGoalPlano = planoAtivo.empty ? 0 : Number(planoAtivo.docs[0].data().proteinGoalG ?? 0);
  const kcalGoalPlano = planoAtivo.empty ? 0 : Number(planoAtivo.docs[0].data().kcalGoal ?? 0);

  let pesoKg: number | null = null;
  if (proteinGoalPlano <= 0 || kcalGoalPlano <= 0) {
    const ultimoPeso = await usuario.ref
      .collection('weight_history')
      .orderBy('recordedAt', 'desc')
      .limit(1)
      .get();
    pesoKg = ultimoPeso.empty ? null : (ultimoPeso.docs[0].data().weight as number | undefined) ?? null;
  }

  const proteinGoalG =
    proteinGoalPlano > 0 ? proteinGoalPlano : pesoKg ? Math.round(pesoKg * PROTEINA_G_POR_KG) : 0;
  const kcalGoal =
    kcalGoalPlano > 0 ? kcalGoalPlano : pesoKg ? Math.max(Math.round(pesoKg * KCAL_POR_KG), PISO_KCAL_SEGURO) : 0;

  if (proteinGoalG <= 0 && kcalGoal <= 0) return null;
  return { proteinGoalG, kcalGoal };
}

/**
 * Soma `macros.protein`/`macros.kcal` das refeições confirmadas hoje.
 * `macros` já é o valor proporcional real gravado na confirmação
 * (`confirmarRefeicao` no cliente) — não multiplicar por `consumedPercentage`
 * de novo, senão o consumo fica descontado em dobro.
 */
async function consumoNutricaoHoje(
  userRef: FirebaseFirestore.DocumentReference,
): Promise<{ protein: number; kcal: number }> {
  const agora = new Date();
  const inicio = Timestamp.fromDate(inicioDoDia(agora));
  const fim = Timestamp.fromDate(fimDoDia(agora));

  const snap = await userRef
    .collection('meals')
    .where('status', '==', 'completed')
    .where('createdAt', '>=', inicio)
    .where('createdAt', '<=', fim)
    .get();

  return snap.docs.reduce(
    (total, doc) => {
      const macros = doc.data().macros ?? {};
      return {
        protein: total.protein + Number(macros.protein ?? 0),
        kcal: total.kcal + Number(macros.kcal ?? 0),
      };
    },
    { protein: 0, kcal: 0 },
  );
}

/**
 * Diariamente às 16:00: consumo de proteína ou calorias abaixo de 50% da
 * meta do dia recebe um empurrão para um lanche proteico.
 */
export const nutricaoAlertaTarde = onSchedule(
  { schedule: '0 16 * * *', timeZone: FUSO, region: REGIAO },
  async () => {
    const db = getFirestore();
    const usuarios = await db.collection('users').where('fcmTokens', '!=', []).get();

    for (const usuario of usuarios.docs) {
      const metas = await metasNutricaoDoUsuario(usuario);
      if (!metas) continue;

      const consumo = await consumoNutricaoHoje(usuario.ref);
      const proteinaBaixa = metas.proteinGoalG > 0 && consumo.protein < metas.proteinGoalG * 0.5;
      const caloriasBaixas = metas.kcalGoal > 0 && consumo.kcal < metas.kcalGoal * 0.5;
      if (!proteinaBaixa && !caloriasBaixas) continue;

      await enviarParaUsuario(
        usuario.id,
        '🍗 Proteja sua massa muscular!',
        'Seu consumo de nutrientes está baixo hoje. Que tal um lanche proteico agora à tarde?',
      );
    }
  },
);

/**
 * Diariamente às 20:00: última chamada do dia — dispara se a proteína
 * estiver abaixo de 80% da meta, ou as calorias abaixo de 80% da meta, ou
 * abaixo do piso de segurança absoluto (1200kcal), independente da meta.
 */
export const nutricaoRetaFinal = onSchedule(
  { schedule: '0 20 * * *', timeZone: FUSO, region: REGIAO },
  async () => {
    const db = getFirestore();
    const usuarios = await db.collection('users').where('fcmTokens', '!=', []).get();

    for (const usuario of usuarios.docs) {
      const metas = await metasNutricaoDoUsuario(usuario);
      if (!metas) continue;

      const consumo = await consumoNutricaoHoje(usuario.ref);
      const proteinaBaixa = metas.proteinGoalG > 0 && consumo.protein < metas.proteinGoalG * 0.8;
      const caloriasCriticas =
        (metas.kcalGoal > 0 && consumo.kcal < metas.kcalGoal * 0.8) || consumo.kcal < PISO_KCAL_SEGURO;
      if (!proteinaBaixa && !caloriasCriticas) continue;

      await enviarParaUsuario(
        usuario.id,
        '🥗 Ainda dá tempo de nutrir seu corpo hoje!',
        'Faltam poucas proteínas para sua meta. Um jantar equilibrado faz toda a diferença.',
      );
    }
  },
);

const SEMANA_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Toda sexta-feira às 18:00: quem está com `fcmTokens` cadastrados mas sem
 * registro de peso nos últimos 7 dias recebe um lembrete de check-in.
 */
export const engajamentoRotina = onSchedule(
  { schedule: '0 18 * * 5', timeZone: FUSO, region: REGIAO },
  async () => {
    const db = getFirestore();
    const usuarios = await db.collection('users').where('fcmTokens', '!=', []).get();
    const limite = Timestamp.fromDate(new Date(Date.now() - SEMANA_MS));

    for (const usuario of usuarios.docs) {
      const ultimoPeso = await usuario.ref
        .collection('weight_history')
        .orderBy('recordedAt', 'desc')
        .limit(1)
        .get();

      const registrouRecente =
        !ultimoPeso.empty &&
        (ultimoPeso.docs[0].data().recordedAt as Timestamp).toMillis() >= limite.toMillis();
      if (registrouRecente) continue;

      await enviarParaUsuario(
        usuario.id,
        'Hora do check-in! ⚖️',
        'Que tal registrar seu peso hoje e ver sua evolução?',
      );
    }
  },
);
