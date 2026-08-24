import { createHash } from 'node:crypto';
import {
  FieldValue,
  getFirestore,
  Timestamp,
  type DocumentSnapshot,
  type QueryDocumentSnapshot,
} from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { HttpsError, onCall, onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';

const REGIAO = 'southamerica-east1';
const FUSO = 'America/Sao_Paulo';

/*
 * Quantos envios seguidos sem nenhuma confirmação do aparelho antes de
 * considerar um token fantasma. Com ~6 rotinas por dia, 15 envios são uns
 * 2 a 3 dias de silêncio total — folga suficiente para um celular
 * desligado ou em Foco não ser descartado à toa.
 */
const ENVIOS_SEM_CONFIRMACAO_PARA_DESCARTE = 15;

/*
 * O mesmo, para conta que não tem NENHUM dispositivo confirmado com que
 * comparar. Sem irmão saudável, a chance de o silêncio ser falha transitória
 * de rede (e não um registro morto) é maior, então exige o dobro de silêncio
 * — uns 4 a 5 dias — antes de desativar o único registro da pessoa.
 */
const ENVIOS_SEM_CONFIRMACAO_SEM_IRMAO = 30;

/*
 * Teto de dispositivos por conta. Ninguém usa o app em cinco aparelhos ao
 * mesmo tempo; passar disso significa registros obsoletos acumulando.
 */
const MAX_DISPOSITIVOS = 5;

type Dispositivo = {
  token: string;
  status: 'ativo' | 'inativo';
  plataforma?: string;
  enviosSemConfirmacao?: number;
  ultimoEnvioEm?: unknown;
  ultimoRecebimentoEm?: unknown;
};

/**
 * Identificador curto e estável de um token, derivado dele mesmo.
 *
 * O token em si nunca vai para log nem trafega de volta do aparelho: é
 * credencial de envio. O hash permite o Service Worker dizer "fui eu que
 * recebi" sem expor nada, e dá sempre a mesma chave para o mesmo token — é o
 * próprio id do documento em `users/{uid}/dispositivos/{id}`. Só hex, então
 * serve como caminho de campo/id do Firestore sem escape.
 */
export function idDoToken(token: string): string {
  return createHash('sha256').update(token).digest('hex').slice(0, 20);
}

function colecaoDispositivos(uid: string) {
  return getFirestore().collection('users').doc(uid).collection('dispositivos');
}

/**
 * Envia uma notificação para os dispositivos registrados em `users/{uid}` e
 * poda o que não serve mais.
 *
 * São três causas distintas de lixo, e cada uma exige um critério próprio:
 *
 * 1. Token que o FCM declara morto (app desinstalado, permissão revogada).
 *    Fácil: o próprio FCM avisa no retorno do envio.
 * 2. Token *fantasma* — o FCM ainda aceita, mas nenhum Service Worker acorda
 *    do outro lado. Nasce de PWA reinstalado ou de contextos separados no
 *    iOS (Safari vs. app na Tela de Início). Este é o perigoso: como o envio
 *    "dá certo", `successCount` sobe, a rotina contabiliza sucesso e o log
 *    fica limpo enquanto ninguém vê notificação nenhuma. Só dá para
 *    identificá-lo pela ausência de confirmação de recebimento.
 * 3. Acúmulo puro e simples, contido pelo teto de `MAX_DISPOSITIVOS`.
 *
 * O critério do fantasma é SILÊNCIO ACUMULADO (`enviosSemConfirmacao`), não
 * "nunca confirmou". A versão anterior só podava quem jamais tinha confirmado,
 * e isso criava um sucesso falso permanente: um registro que confirmou uma
 * única vez e depois morreu — token rotacionado, PWA reinstalada, inscrição
 * revogada pelo SO — ficava marcado como saudável para sempre, imune à poda.
 * O FCM segue aceitando esse registro morto por muito tempo antes de declarar
 * `registration-token-not-registered`, então a rotina registrava
 * `notificados: N` indefinidamente enquanto a pessoa não recebia nada, sem
 * nenhum caminho de autocorreção. Foi exatamente esse o caso que motivou a
 * mudança, diagnosticado em produção.
 *
 * O irmão saudável deixou de ser porta de entrada da poda e virou só a
 * escolha do limiar. A confirmação depende de um `fetch` best-effort dentro
 * do Service Worker, que pode falhar por rede sem que a notificação tenha
 * falhado — daí a cautela. Mas exigir irmão travava justamente a conta de
 * dispositivo único, que é quem mais precisa da poda: sem ninguém com quem
 * comparar, nada era podado nunca. Agora ela também é podada, só que com o
 * dobro de silêncio exigido (`ENVIOS_SEM_CONFIRMACAO_SEM_IRMAO`).
 *
 * Desativar não é perda: o cliente re-registra um token novo sozinho no
 * próximo uso do app (rechecks de `useNotificacoes` no mount, no
 * `visibilitychange` e no intervalo em primeiro plano), que é exatamente o
 * que uma reinstalação manual da PWA fazia — agora automático.
 */
export async function enviarParaUsuario(uid: string, titulo: string, corpo: string): Promise<number> {
  const db = getFirestore();
  const docUsuario = db.collection('users').doc(uid);
  const dispositivosSnap = await colecaoDispositivos(uid).where('status', '==', 'ativo').get();
  const dispositivos = dispositivosSnap.docs;
  const tokens = dispositivos.map((d) => (d.data() as Dispositivo).token);

  if (tokens.length === 0) {
    /*
     * Autocorreção de custo zero: se `notificacoesAtivas` ainda estiver
     * `true` sem dispositivo nenhum (ex. o "Reset Total" removeu o último
     * dispositivo sem mexer na flag, de propósito — ver `removerTokenFcm`),
     * corrige aqui, no próximo ciclo em que este usuário for varrido.
     */
    const usuario = await docUsuario.get();
    if (usuario.data()?.notificacoesAtivas === true || usuario.data()?.totalDispositivosAtivos > 0) {
      await docUsuario.update({ notificacoesAtivas: false, totalDispositivosAtivos: 0 });
    }
    console.log('[enviarParaUsuario]', JSON.stringify({ uid, tokens: 0, enviados: 0 }));
    return 0;
  }

  const saude = new Map(dispositivos.map((d) => [d.id, d.data() as Dispositivo]));
  const enviadoEm = Date.now();

  /*
   * `sendEach` em vez de `sendEachForMulticast`: o multicast manda o MESMO
   * payload para todos os tokens, então não havia como cada aparelho saber
   * qual registro ele é ao confirmar o recebimento. Com uma mensagem por
   * token, cada uma leva o seu `dispositivoId`. O custo é o mesmo: o
   * multicast também despacha individualmente por baixo.
   */
  const ids = dispositivos.map((d) => d.id);

  const mensagens = tokens.map((token, i) => ({
    token,
    /*
     * `notification` no topo é obrigatório: sem ele o iOS trata a mensagem
     * como data-only e não exibe banner nenhum com o app fechado.
     */
    notification: { title: titulo, body: corpo },
    data: { uid, dispositivoId: ids[i], enviadoEm: String(enviadoEm) },
    /*
     * Bloco `apns` explícito: o iOS descarta o push silenciosamente com o
     * app em force-close se a prioridade/tipo não vierem declarados aqui.
     */
    apns: {
      headers: {
        'apns-priority': '10',
        'apns-push-type': 'alert',
      },
      payload: {
        aps: {
          alert: { title: titulo, body: corpo },
          contentAvailable: true,
          mutableContent: true,
        },
      },
    },
    webpush: {
      headers: { Urgency: 'high', TTL: '86400' },
      notification: {
        title: titulo,
        body: corpo,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
      },
      fcmOptions: { link: '/' },
    },
  }));

  const resposta = await getMessaging().sendEach(mensagens);

  // (1) mortos declarados pelo próprio FCM
  const descartar = new Set<string>();
  resposta.responses.forEach((r, i) => {
    if (!r.success && ehTokenInvalido(r.error?.code)) descartar.add(ids[i]);
  });

  /*
   * (2) fantasmas — silêncio acumulado, tenha o dispositivo confirmado no
   * passado ou não. Ter um irmão saudável na conta só afrouxa o limiar: com
   * ninguém para comparar, exige o dobro de silêncio antes de agir.
   */
  const existeSaudavel = ids.some((id) => !descartar.has(id) && saude.get(id)?.ultimoRecebimentoEm);
  const limite = existeSaudavel
    ? ENVIOS_SEM_CONFIRMACAO_PARA_DESCARTE
    : ENVIOS_SEM_CONFIRMACAO_SEM_IRMAO;

  for (const id of ids) {
    if (descartar.has(id)) continue;
    const semConfirmacao = saude.get(id)?.enviosSemConfirmacao ?? 0;
    if (semConfirmacao >= limite) descartar.add(id);
  }

  // (3) teto: mantém os que confirmaram mais recentemente
  let restantes = ids.filter((id) => !descartar.has(id));
  if (restantes.length > MAX_DISPOSITIVOS) {
    const quando = (id: string) => {
      const valor = saude.get(id)?.ultimoRecebimentoEm;
      return valor instanceof Timestamp ? valor.toMillis() : 0;
    };
    const ordenados = [...restantes].sort((a, b) => quando(b) - quando(a));
    for (const id of ordenados.slice(MAX_DISPOSITIVOS)) descartar.add(id);
    restantes = ordenados.slice(0, MAX_DISPOSITIVOS);
  }

  /*
   * Todo write desta rotina — poda de dispositivo, contador de saúde e o
   * total agregado no doc raiz — sai num único `batch`. Um `batch` não aceita
   * duas chamadas separadas de `update` sobre o MESMO documento, então cada
   * documento (o usuário, e cada dispositivo) acumula suas mudanças num único
   * objeto antes de entrar no lote.
   */
  const atualizacoesPorDispositivo = new Map<string, Record<string, unknown>>();
  const atualizacaoUsuario: Record<string, unknown> = {};

  const paraDispositivo = (id: string): Record<string, unknown> => {
    let atual = atualizacoesPorDispositivo.get(id);
    if (!atual) {
      atual = {};
      atualizacoesPorDispositivo.set(id, atual);
    }
    return atual;
  };

  for (const id of descartar) {
    // Marca inativo em vez de apagar: preserva o histórico de saúde do
    // dispositivo para diagnóstico, e evita recriar o doc do zero se o
    // mesmo token voltar a ser salvo pelo cliente antes de expirar de vez.
    paraDispositivo(id).status = 'inativo';
  }

  /*
   * O carimbo de envio é gravado no servidor, no momento do envio — nunca
   * dependendo do aparelho responder. Enquanto ele dependia disso, um push
   * que o dispositivo nunca recebia deixava os dois campos vazios e o
   * diagnóstico dizia "enviado: nunca" mesmo tendo enviado com sucesso.
   */
  if (resposta.successCount > 0) {
    atualizacaoUsuario.ultimoPushEnviadoEm = Timestamp.fromMillis(enviadoEm);
  }

  /*
   * Contador por dispositivo: sobe a cada envio aceito, e o recebimento
   * confirmado zera. É ele que denuncia o fantasma.
   */
  resposta.responses.forEach((r, i) => {
    const id = ids[i];
    if (!r.success || descartar.has(id)) return;
    const atual = paraDispositivo(id);
    atual.ultimoEnvioEm = Timestamp.fromMillis(enviadoEm);
    atual.enviosSemConfirmacao = FieldValue.increment(1);
  });

  /*
   * A poda mudou a contagem de dispositivos ativos — mantém o campo
   * agregado no doc raiz em dia, é ele que sustenta a query indexada de
   * `usuariosComNotificacoes` sem exigir leitura da subcoleção.
   */
  if (descartar.size > 0) {
    atualizacaoUsuario.totalDispositivosAtivos = restantes.length;
    // A poda esvaziou tudo: tira este usuário da query indexada já na
    // próxima rotina, em vez de esperar o próximo ciclo achar o early
    // return no topo desta função.
    if (restantes.length === 0) {
      atualizacaoUsuario.notificacoesAtivas = false;
    }
  }

  const lote = db.batch();
  let mudou = false;

  for (const [id, dados] of atualizacoesPorDispositivo) {
    lote.update(colecaoDispositivos(uid).doc(id), dados);
    mudou = true;
  }
  if (Object.keys(atualizacaoUsuario).length > 0) {
    lote.update(docUsuario, atualizacaoUsuario);
    mudou = true;
  }

  if (mudou) {
    await lote.commit();
  }

  // Só contagens e códigos de erro — o token em si nunca vai para o log.
  console.log(
    '[enviarParaUsuario]',
    JSON.stringify({
      uid,
      tokens: tokens.length,
      enviados: resposta.successCount,
      removidos: descartar.size,
      erros: resposta.responses.filter((r) => !r.success).map((r) => r.error?.code ?? 'desconhecido'),
    }),
  );

  return resposta.successCount;
}

function ehTokenInvalido(codigo: string | undefined): boolean {
  return (
    codigo === 'messaging/registration-token-not-registered' ||
    codigo === 'messaging/invalid-registration-token'
  );
}

function temDispositivosAtivos(valor: unknown): boolean {
  return typeof valor === 'number' && valor > 0;
}

/*
 * `fonte` diz qual caminho a varredura realmente tomou nesta execução —
 * distinção que só existia antes como um `console.error`, e a ferramenta de
 * log deste projeto se mostrou, repetidas vezes nesta base, incapaz de
 * alcançar de forma confiável os últimos dias. Sem isso, "por que deu
 * candidatos:0 nessa hora?" só tinha resposta especulativa. Com `fonte` no
 * registro de execução, a própria tela de diagnóstico responde.
 */
type VarreduraUsuarios = {
  total: number;
  comToken: QueryDocumentSnapshot[];
  fonte: 'indexada' | 'fallback';
};

/*
 * Registra que uma rotina agendada rodou, e com que resultado.
 *
 * As rotinas só faziam `console.log`. Quando o log fica inacessível — e a
 * ferramenta de log deste projeto costuma não alcançar os últimos dias —
 * não havia como responder "o cron das 15:00 chegou a disparar hoje?", o que
 * deixa qualquer investigação cega e convida a diagnosticar por palpite.
 * Gravar aqui torna isso visível na própria tela de diagnóstico.
 *
 * Tudo num doc único (`sistema/rotinas`), com um campo por rotina: o
 * diagnóstico lê uma vez só, e cada rotina escreve uma vez por execução.
 * Best-effort de propósito — falhar ao registrar não pode derrubar um envio
 * que já aconteceu.
 */
async function registrarExecucao(rotina: string, resumo: Record<string, unknown>): Promise<void> {
  try {
    await getFirestore()
      .collection('sistema')
      .doc('rotinas')
      .set({ [rotina]: { executadaEm: Timestamp.now(), ...resumo } }, { merge: true });
  } catch (falha) {
    console.error('[registrarExecucao] falha ao registrar', rotina, falha);
  }
}

/** `rotina_AAAAMMDD_HHmm` no fuso de São Paulo — a chave do lock de execução. */
function idExecucao(rotina: string, instante: Date): string {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instante);
  const campo = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? '00';
  return `${rotina}_${campo('year')}${campo('month')}${campo('day')}_${campo('hour')}${campo('minute')}`;
}

/**
 * Trava distribuída de idempotência: tenta criar um doc único para esta
 * rotina neste minuto exato. `create()` falha com ALREADY_EXISTS se o doc já
 * existir — é atômico no Firestore, então duas invocações concorrentes do
 * mesmo cron (cold start duplicado, retry do Cloud Scheduler) nunca passam
 * as duas. Quem perde a corrida aborta sem tocar em nada mais: nenhum envio,
 * nenhum `registrarExecucao`.
 */
async function adquirirLock(rotina: string, agora: Date): Promise<boolean> {
  const id = idExecucao(rotina, agora);
  try {
    // `sistema/execucoes` é um doc-namespace, só para agrupar a subcoleção de
    // locks no mesmo lugar que `sistema/rotinas` guarda o resumo de execução.
    await getFirestore()
      .collection('sistema')
      .doc('execucoes')
      .collection('locks')
      .doc(id)
      .create({ criadaEm: Timestamp.now() });
    return true;
  } catch (falha) {
    console.log('[adquirirLock] execução já em andamento ou concluída, abortando', id, falha);
    return false;
  }
}

export async function usuariosComNotificacoes(): Promise<VarreduraUsuarios> {
  const db = getFirestore();

  /*
   * Query indexada: lê só quem tem `notificacoesAtivas === true`, mantido
   * por `salvarTokenFcm` (cliente) e `enviarParaUsuario` (servidor). É uma
   * única igualdade — não exige índice composto, o Firestore auto-indexa
   * campo único por padrão. `temDispositivosAtivos` continua filtrando por cima como
   * segunda trava: se a flag ficou desatualizada em algum caso não previsto,
   * o pior resultado é avaliar um usuário a mais, nunca a menos.
   *
   * Antes disto, `collection('users').get()` lia a base inteira 7×/dia —
   * custo proporcional ao total de contas, não às ativas, e risco real de
   * estourar os 60s de timeout da function conforme a base crescer.
   */
  try {
    /*
     * `total` precisa continuar sendo a base INTEIRA, não só quem tem
     * notificação ativa — é a comparação `usuariosTotal` vs. `candidatos` no
     * registro de execução que expoõe um usuário nunca avaliado (foi assim
     * que o caso da Gyselle foi diagnosticado). `count()` é uma query de
     * agregação: custa uma leitura fixa, independente do tamanho da coleção,
     * não le os documentos.
     */
    const [totalSnap, comTokenSnap] = await Promise.all([
      db.collection('users').count().get(),
      db.collection('users').where('notificacoesAtivas', '==', true).get(),
    ]);

    /*
     * Uma query sem match NÃO lança exceção — sucede com zero documentos.
     * Isso é indistinguível, para o try/catch abaixo, de "de fato ninguém
     * tem notificação ativa". A distinção que importa é: existe gente na
     * base (`total > 0`) mas a query indexada não achou ninguém. Foi
     * exatamente esse buraco que quase causou um apagão de um dia inteiro
     * de rotinas na primeira vez que este código foi ao ar — a flag nunca
     * tinha sido populada em nenhum documento existente, e a query
     * "funcionou", só que vazia. Tratar isso como suspeito e cair para a
     * varredura completa é o que fecha esse buraco de vez, sem depender de
     * ninguém rodar um backfill manual antes do próximo cron dar zero.
     */
    if (comTokenSnap.empty && totalSnap.data().count > 0) {
      console.error(
        '[usuariosComNotificacoes] query indexada voltou vazia com',
        totalSnap.data().count,
        'usuário(s) na base — caindo para varredura completa (flag ainda não populada?)',
      );
      const todos = await db.collection('users').get();
      return {
        total: todos.size,
        comToken: todos.docs.filter((doc) => temDispositivosAtivos(doc.data().totalDispositivosAtivos)),
        fonte: 'fallback',
      };
    }

    return {
      total: totalSnap.data().count,
      comToken: comTokenSnap.docs.filter((doc) => temDispositivosAtivos(doc.data().totalDispositivosAtivos)),
      fonte: 'indexada',
    };
  } catch (falha) {
    /*
     * Fallback para a varredura completa. A mensagem crua de um
     * FAILED_PRECONDITION do Firestore já embute a URL de criação do índice
     * — útil se um dia um segundo filtro exigir índice composto. Hoje isto
     * não deveria disparar nunca: é rede de segurança, não o caminho esperado.
     */
    console.error('[usuariosComNotificacoes] query indexada falhou, usando varredura completa', falha);
    const todos = await db.collection('users').get();
    return {
      total: todos.size,
      comToken: todos.docs.filter((doc) => temDispositivosAtivos(doc.data().totalDispositivosAtivos)),
      fonte: 'fallback',
    };
  }
}

/**
 * Deslocamento do fuso de São Paulo, em ms, no instante dado.
 *
 * Calculado via `Intl` em vez de fixado em -03:00: o Brasil não usa horário
 * de verão hoje, mas se voltar a usar isso continua correto sozinho.
 */
function deslocamentoFusoMs(instante: Date): number {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instante);

  const campo = (tipo: string) => Number(partes.find((p) => p.type === tipo)?.value ?? 0);
  const comoSeUTC = Date.UTC(
    campo('year'),
    campo('month') - 1,
    campo('day'),
    campo('hour'),
    campo('minute'),
    campo('second'),
  );

  return comoSeUTC - instante.getTime();
}

/*
 * Limites do dia EM SÃO PAULO, não em UTC.
 *
 * O `onSchedule` já dispara no fuso certo, mas o runtime das Functions é UTC:
 * com `setHours` o "dia" ia das 21:00 da véspera às 20:59 do dia corrente.
 * Na prática, aplicação marcada para depois das 21:00 nunca gerava lembrete,
 * e água/refeição registrada à noite entrava no total do dia seguinte.
 *
 * A conta soma o deslocamento para chegar na hora "de parede", recorta o dia
 * com `setUTCHours` e desfaz o deslocamento para voltar ao instante real.
 */
function inicioDoDia(instante: Date): Date {
  const deslocamento = deslocamentoFusoMs(instante);
  const parede = new Date(instante.getTime() + deslocamento);
  parede.setUTCHours(0, 0, 0, 0);
  return new Date(parede.getTime() - deslocamento);
}

function fimDoDia(instante: Date): Date {
  const deslocamento = deslocamentoFusoMs(instante);
  const parede = new Date(instante.getTime() + deslocamento);
  parede.setUTCHours(23, 59, 59, 999);
  return new Date(parede.getTime() - deslocamento);
}

/** Extrai o uid do usuário dono de um doc de subcoleção, ex. `users/{uid}/agenda/proxima`. */
function uidDoDoc(caminho: string): string | null {
  const partes = caminho.split('/');
  const indice = partes.indexOf('users');
  return indice >= 0 && partes.length > indice + 1 ? partes[indice + 1] : null;
}

/**
 * Converte um campo do Firestore em `Date` só quando ele é de fato um
 * `Timestamp`. Os casts diretos (`campo as Timestamp`) que existiam antes
 * mentem: o TypeScript aceita, mas se o campo estiver ausente ou vier com
 * outro tipo o `.toDate()` estoura em runtime — e numa rotina que varre todos
 * os usuários, um único doc malformado derrubava o envio para a base inteira.
 */
function comoData(valor: unknown): Date | null {
  return valor instanceof Timestamp ? valor.toDate() : null;
}

/**
 * Dispara uma notificação de teste imediata para o usuário autenticado —
 * usada pelo botão "Testar Notificação" em Ajustes > Lembretes.
 */
export const testarNotificacao = onCall({ region: REGIAO, cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'É necessário estar logado.');
  }

  let enviados: number;
  try {
    enviados = await enviarParaUsuario(
      request.auth.uid,
      'DoseCerta',
      'Notificação de teste — se você está vendo isso, está tudo funcionando! 🎉',
    );
  } catch (falha) {
    // Ferramenta de diagnóstico: vale mais mostrar o erro real pro usuário
    // aqui do que nas rotinas automáticas, onde isso viraria ruído.
    console.error('[testarNotificacao] falha ao enviar via FCM', request.auth.uid, falha);
    const detalhe = falha instanceof Error ? falha.message : String(falha);
    throw new HttpsError('internal', `Falha ao enviar pelo FCM: ${detalhe}`);
  }

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
    const agora = new Date();
    if (!(await adquirirLock('lembreteAplicacao', agora))) return;

    const db = getFirestore();
    const inicio = Timestamp.fromDate(inicioDoDia(agora));
    const fim = Timestamp.fromDate(fimDoDia(agora));

    const snap = await db
      .collectionGroup('agenda')
      .where('proximaEm', '>=', inicio)
      .where('proximaEm', '<=', fim)
      .get();

    let jaNotificados = 0;
    let notificados = 0;
    let semDispositivo = 0;
    let falhas = 0;

    for (const doc of snap.docs) {
      const uid = uidDoDoc(doc.ref.path);
      if (!uid) continue;

      try {
        const notificadaEm = comoData(doc.data().notificadaEm);
        if (notificadaEm && notificadaEm >= inicioDoDia(agora)) {
          jaNotificados += 1;
          continue;
        }

        const enviados = await enviarParaUsuario(
          uid,
          'Dia de Dose Certa! 💉',
          'Lembre-se de registrar sua aplicação hoje.',
        );
        if (enviados > 0) notificados += 1;
        else semDispositivo += 1;
        await doc.ref.update({ notificadaEm: Timestamp.now() });
      } catch (falha) {
        // Um usuário com dado inesperado não pode zerar o envio da base
        // inteira — foi assim que um índice ausente virou "ninguém recebeu".
        falhas += 1;
        console.error('[lembreteAplicacao] falha ao avaliar usuário', uid, falha);
      }
    }

    const resumo = { agendasHoje: snap.docs.length, jaNotificados, notificados, semDispositivo, falhas };
    console.log('[lembreteAplicacao]', JSON.stringify(resumo));
    await registrarExecucao('lembreteAplicacao', resumo);
  },
);

/**
 * Diariamente às 10:00: quem registrou sintoma ontem recebe um acompanhamento.
 */
export const acompanhamentoSintoma = onSchedule(
  { schedule: '0 10 * * *', timeZone: FUSO, region: REGIAO },
  async () => {
    if (!(await adquirirLock('acompanhamentoSintoma', new Date()))) return;

    const db = getFirestore();
    // 24h atrás e depois recortado pelos helpers de fuso — `setDate` aqui
    // usaria o calendário UTC e cairia no dia errado perto da meia-noite.
    const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const inicio = Timestamp.fromDate(inicioDoDia(ontem));
    const fim = Timestamp.fromDate(fimDoDia(ontem));

    const snap = await db
      .collectionGroup('symptom_logs')
      .where('recordedAt', '>=', inicio)
      .where('recordedAt', '<=', fim)
      .get();

    const uidsNotificados = new Set<string>();
    let notificados = 0;
    let semDispositivo = 0;
    let falhas = 0;

    for (const doc of snap.docs) {
      const uid = uidDoDoc(doc.ref.path);
      if (!uid || uidsNotificados.has(uid)) continue;
      uidsNotificados.add(uid);

      try {
        const enviados = await enviarParaUsuario(
          uid,
          'Como você está hoje?',
          'Ontem você relatou desconforto. Seu Co-piloto tem dicas para te ajudar.',
        );
        if (enviados > 0) notificados += 1;
        else semDispositivo += 1;
      } catch (falha) {
        // Um usuário com dado inesperado não pode zerar o envio da base
        // inteira — foi assim que um índice ausente virou "ninguém recebeu".
        falhas += 1;
        console.error('[acompanhamentoSintoma] falha ao avaliar usuário', uid, falha);
      }
    }

    const resumo = {
      sintomasOntem: snap.docs.length,
      usuariosDistintos: uidsNotificados.size,
      notificados,
      semDispositivo,
      falhas,
    };
    console.log('[acompanhamentoSintoma]', JSON.stringify(resumo));
    await registrarExecucao('acompanhamentoSintoma', resumo);
  },
);

const ML_POR_KG_PESO = 35;
const META_HIDRATACAO_PADRAO_ML = 2000;

/**
 * Mesma regra de `src/domain/hidratacao.ts` (peso×35ml, com fallback fixo) —
 * duplicada aqui porque `functions/` é outro pacote e não importa `src/`.
 */
async function metaHidratacaoDoUsuario(usuario: DocumentSnapshot): Promise<number> {
  const hydrationGoal = usuario.data()?.hydration_goal;
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
    if (!(await adquirirLock('hidratacaoMetadeDia', new Date()))) return;

    const { total, comToken, fonte } = await usuariosComNotificacoes();

    let elegiveis = 0;
    let notificados = 0;
    let semDispositivo = 0;
    let falhas = 0;

    for (const usuario of comToken) {
      try {
        const meta = await metaHidratacaoDoUsuario(usuario);
        const total = await totalHidratacaoHoje(usuario.ref);
        if (total >= meta * 0.5) continue;
        elegiveis += 1;

        const enviados = await enviarParaUsuario(
          usuario.id,
          '💧 Hora de beber água',
          'Opa! Já passou do meio-dia e você bebeu pouca água. Que tal um copo agora?',
        );
        if (enviados > 0) notificados += 1;
        else semDispositivo += 1;
      } catch (falha) {
        // Um usuário com dado inesperado não pode zerar o envio da base
        // inteira — foi assim que um índice ausente virou "ninguém recebeu".
        falhas += 1;
        console.error('[hidratacaoMetadeDia] falha ao avaliar usuário', usuario.id, falha);
      }
    }

    const resumo = { usuariosTotal: total, candidatos: comToken.length, elegiveis, notificados, semDispositivo, falhas, fonte };
    console.log('[hidratacaoMetadeDia]', JSON.stringify(resumo));
    await registrarExecucao('hidratacaoMetadeDia', resumo);
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
    if (!(await adquirirLock('hidratacaoRetaFinal', new Date()))) return;

    const { total, comToken, fonte } = await usuariosComNotificacoes();

    let elegiveis = 0;
    let notificados = 0;
    let semDispositivo = 0;
    let falhas = 0;

    for (const usuario of comToken) {
      try {
        const meta = await metaHidratacaoDoUsuario(usuario);
        const total = await totalHidratacaoHoje(usuario.ref);
        if (total < meta * 0.5 || total >= meta) continue;
        elegiveis += 1;

        const faltam = meta - total;
        const enviados = await enviarParaUsuario(
          usuario.id,
          '🏆 Quase lá!',
          `Faltam só ${faltam} ml para bater sua meta de hidratação hoje!`,
        );
        if (enviados > 0) notificados += 1;
        else semDispositivo += 1;
      } catch (falha) {
        // Um usuário com dado inesperado não pode zerar o envio da base
        // inteira — foi assim que um índice ausente virou "ninguém recebeu".
        falhas += 1;
        console.error('[hidratacaoRetaFinal] falha ao avaliar usuário', usuario.id, falha);
      }
    }

    const resumo = { usuariosTotal: total, candidatos: comToken.length, elegiveis, notificados, semDispositivo, falhas, fonte };
    console.log('[hidratacaoRetaFinal]', JSON.stringify(resumo));
    await registrarExecucao('hidratacaoRetaFinal', resumo);
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
async function metasNutricaoDoUsuario(usuario: DocumentSnapshot): Promise<MetasNutricao | null> {
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

  /*
   * O `orderBy` descendente não é decorativo: sem ele o Firestore assume ordem
   * ascendente e exige um índice `status ASC, createdAt ASC`, que não existe no
   * projeto. O índice ativo é `status ASC, createdAt DESC`, e a falta desse
   * alinhamento derrubava as duas rotinas de nutrição todo dia com
   * FAILED_PRECONDITION, antes de qualquer envio. Como o resultado é uma soma,
   * a ordem não muda nada — mas remover esta linha quebra a rotina.
   */
  const snap = await userRef
    .collection('meals')
    .where('status', '==', 'completed')
    .where('createdAt', '>=', inicio)
    .where('createdAt', '<=', fim)
    .orderBy('createdAt', 'desc')
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
    if (!(await adquirirLock('nutricaoAlertaTarde', new Date()))) return;

    const { total, comToken, fonte } = await usuariosComNotificacoes();

    let semMetas = 0;
    let elegiveis = 0;
    let notificados = 0;
    let semDispositivo = 0;
    let falhas = 0;

    for (const usuario of comToken) {
      try {
        const metas = await metasNutricaoDoUsuario(usuario);
        if (!metas) {
          semMetas += 1;
          continue;
        }

        const consumo = await consumoNutricaoHoje(usuario.ref);
        const proteinaBaixa = metas.proteinGoalG > 0 && consumo.protein < metas.proteinGoalG * 0.5;
        const caloriasBaixas = metas.kcalGoal > 0 && consumo.kcal < metas.kcalGoal * 0.5;
        if (!proteinaBaixa && !caloriasBaixas) continue;
        elegiveis += 1;

        const enviados = await enviarParaUsuario(
          usuario.id,
          '🍗 Proteja sua massa muscular!',
          'Seu consumo de nutrientes está baixo hoje. Que tal um lanche proteico agora à tarde?',
        );
        if (enviados > 0) notificados += 1;
        else semDispositivo += 1;
      } catch (falha) {
        // Um usuário com dado inesperado não pode zerar o envio da base
        // inteira — foi assim que um índice ausente virou "ninguém recebeu".
        falhas += 1;
        console.error('[nutricaoAlertaTarde] falha ao avaliar usuário', usuario.id, falha);
      }
    }

    const resumo = { usuariosTotal: total, candidatos: comToken.length, semMetas, elegiveis, notificados, semDispositivo, falhas, fonte };
    console.log('[nutricaoAlertaTarde]', JSON.stringify(resumo));
    await registrarExecucao('nutricaoAlertaTarde', resumo);
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
    if (!(await adquirirLock('nutricaoRetaFinal', new Date()))) return;

    const { total, comToken, fonte } = await usuariosComNotificacoes();

    let semMetas = 0;
    let elegiveis = 0;
    let notificados = 0;
    let semDispositivo = 0;
    let falhas = 0;

    for (const usuario of comToken) {
      try {
        const metas = await metasNutricaoDoUsuario(usuario);
        if (!metas) {
          semMetas += 1;
          continue;
        }

        const consumo = await consumoNutricaoHoje(usuario.ref);
        const proteinaBaixa = metas.proteinGoalG > 0 && consumo.protein < metas.proteinGoalG * 0.8;
        const caloriasCriticas =
          (metas.kcalGoal > 0 && consumo.kcal < metas.kcalGoal * 0.8) || consumo.kcal < PISO_KCAL_SEGURO;
        if (!proteinaBaixa && !caloriasCriticas) continue;
        elegiveis += 1;

        const enviados = await enviarParaUsuario(
          usuario.id,
          '🥗 Ainda dá tempo de nutrir seu corpo hoje!',
          'Faltam poucas proteínas para sua meta. Um jantar equilibrado faz toda a diferença.',
        );
        if (enviados > 0) notificados += 1;
        else semDispositivo += 1;
      } catch (falha) {
        // Um usuário com dado inesperado não pode zerar o envio da base
        // inteira — foi assim que um índice ausente virou "ninguém recebeu".
        falhas += 1;
        console.error('[nutricaoRetaFinal] falha ao avaliar usuário', usuario.id, falha);
      }
    }

    const resumo = { usuariosTotal: total, candidatos: comToken.length, semMetas, elegiveis, notificados, semDispositivo, falhas, fonte };
    console.log('[nutricaoRetaFinal]', JSON.stringify(resumo));
    await registrarExecucao('nutricaoRetaFinal', resumo);
  },
);

const SEMANA_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Toda sexta-feira às 18:00: quem tem dispositivo ativo cadastrado mas sem
 * registro de peso nos últimos 7 dias recebe um lembrete de check-in.
 */
export const engajamentoRotina = onSchedule(
  { schedule: '0 18 * * 5', timeZone: FUSO, region: REGIAO },
  async () => {
    if (!(await adquirirLock('engajamentoRotina', new Date()))) return;

    const { total, comToken, fonte } = await usuariosComNotificacoes();
    const limite = Timestamp.fromDate(new Date(Date.now() - SEMANA_MS));
    let elegiveis = 0;
    let notificados = 0;
    let semDispositivo = 0;
    let falhas = 0;

    for (const usuario of comToken) {
      try {
        const ultimoPeso = await usuario.ref
          .collection('weight_history')
          .orderBy('recordedAt', 'desc')
          .limit(1)
          .get();

        const registradoEm = ultimoPeso.empty ? null : comoData(ultimoPeso.docs[0].data().recordedAt);
        if (registradoEm && registradoEm.getTime() >= limite.toMillis()) continue;
        elegiveis += 1;

        const enviados = await enviarParaUsuario(
          usuario.id,
          'Hora do check-in! ⚖️',
          'Que tal registrar seu peso hoje e ver sua evolução?',
        );
        if (enviados > 0) notificados += 1;
        else semDispositivo += 1;
      } catch (falha) {
        // Um usuário com dado inesperado não pode zerar o envio da base
        // inteira — foi assim que um índice ausente virou "ninguém recebeu".
        falhas += 1;
        console.error('[engajamentoRotina] falha ao avaliar usuário', usuario.id, falha);
      }
    }

    const resumo = { usuariosTotal: total, candidatos: comToken.length, elegiveis, notificados, semDispositivo, falhas, fonte };
    console.log('[engajamentoRotina]', JSON.stringify(resumo));
    await registrarExecucao('engajamentoRotina', resumo);
  },
);

type ResultadoRotina = { rotina: string; dispararia: boolean; detalhe: string };

const emBrt = (data: Date): string => data.toLocaleString('pt-BR', { timeZone: FUSO });

/**
 * Fotografia, para a conta de quem chamou, de por que cada rotina agendada
 * dispararia ou não neste momento — sem enviar push nenhum.
 *
 * Existe porque diagnosticar isso pelo Cloud Logging se mostrou inviável: as
 * rotinas rodam 1×/dia e a leitura de log pela CLI vinha em janelas
 * inconsistentes. Aqui a resposta chega na tela, na hora.
 */
export const diagnosticarNotificacoes = onCall({ region: REGIAO, cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'É necessário estar logado.');
  }

  const uid = request.auth.uid;

  try {
    const db = getFirestore();
    const usuario = await db.collection('users').doc(uid).get();
    const qtdTokens = Number(usuario.data()?.totalDispositivosAtivos ?? 0);

    const varredura = await usuariosComNotificacoes();
    const achadoPelaVarredura = varredura.comToken.some((doc) => doc.id === uid);

    const agora = new Date();
    const inicioHoje = inicioDoDia(agora);
    const fimHoje = fimDoDia(agora);
    const rotinas: ResultadoRotina[] = [];

    /*
     * Cada bloco é avaliado isolado: se um estourar, ele vira uma linha de erro
     * legível no relatório em vez de derrubar as outras seis. Era esse o
     * comportamento anterior — um índice ausente na leitura de refeições
     * apagava o diagnóstico inteiro e chegava na tela como um "INTERNAL" cego.
     */
    const bloco = async (nomes: string[], avaliar: () => Promise<ResultadoRotina[]>) => {
      try {
        rotinas.push(...(await avaliar()));
      } catch (falha) {
        console.error('[diagnosticarNotificacoes] falha ao avaliar', nomes.join(', '), falha);
        const detalhe = falha instanceof Error ? falha.message : String(falha);
        for (const rotina of nomes) {
          rotinas.push({ rotina, dispararia: false, detalhe: `Erro ao avaliar: ${detalhe}` });
        }
      }
    };

    // --- lembreteAplicacao (08:00) ---
    const APLICACAO = 'Lembrete de aplicação (08:00)';
    await bloco([APLICACAO], async () => {
      const agenda = await usuario.ref.collection('agenda').doc('proxima').get();
      if (!agenda.exists) {
        return [
          {
            rotina: APLICACAO,
            dispararia: false,
            detalhe:
              'O documento agenda/proxima não existe. Ele só é gravado ao salvar o protocolo ou registrar uma aplicação — abra Ajustes > Tratamento e salve para criá-lo.',
          },
        ];
      }

      const proximaEm = comoData(agenda.data()?.proximaEm);
      const notificadaEm = comoData(agenda.data()?.notificadaEm);
      if (!proximaEm) {
        return [
          {
            rotina: APLICACAO,
            dispararia: false,
            detalhe: 'agenda/proxima existe, mas sem proximaEm válida gravada.',
          },
        ];
      }
      if (proximaEm < inicioHoje || proximaEm > fimHoje) {
        return [
          {
            rotina: APLICACAO,
            dispararia: false,
            detalhe: `Próxima aplicação em ${emBrt(proximaEm)} — fora da janela de hoje.`,
          },
        ];
      }
      if (notificadaEm && notificadaEm >= inicioHoje) {
        return [
          {
            rotina: APLICACAO,
            dispararia: false,
            detalhe: `Aplicação é hoje, mas já foi notificada em ${emBrt(notificadaEm)}.`,
          },
        ];
      }
      return [
        {
          rotina: APLICACAO,
          dispararia: true,
          detalhe: `Aplicação prevista para hoje (${emBrt(proximaEm)}) e ainda não notificada.`,
        },
      ];
    });

    // --- acompanhamentoSintoma (10:00) ---
    const SINTOMA = 'Acompanhamento de sintoma (10:00)';
    await bloco([SINTOMA], async () => {
      const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const sintomas = await usuario.ref
        .collection('symptom_logs')
        .where('recordedAt', '>=', Timestamp.fromDate(inicioDoDia(ontem)))
        .where('recordedAt', '<=', Timestamp.fromDate(fimDoDia(ontem)))
        .get();
      return [
        {
          rotina: SINTOMA,
          dispararia: sintomas.size > 0,
          detalhe: `${sintomas.size} sintoma(s) registrado(s) ontem.`,
        },
      ];
    });

    // --- hidratação (15:00 e 19:00) ---
    const AGUA_MEIO = 'Hidratação — metade do dia (15:00)';
    const AGUA_FIM = 'Hidratação — reta final (19:00)';
    await bloco([AGUA_MEIO, AGUA_FIM], async () => {
      const meta = await metaHidratacaoDoUsuario(usuario);
      const bebido = await totalHidratacaoHoje(usuario.ref);
      const percentual = meta > 0 ? Math.round((bebido / meta) * 100) : 0;
      const base = `${bebido} ml de ${meta} ml (${percentual}%) hoje.`;
      return [
        {
          rotina: AGUA_MEIO,
          dispararia: bebido < meta * 0.5,
          detalhe: `${base} Dispara abaixo de 50%.`,
        },
        {
          rotina: AGUA_FIM,
          dispararia: bebido >= meta * 0.5 && bebido < meta,
          detalhe: `${base} Dispara entre 50% e 100%.`,
        },
      ];
    });

    // --- nutrição (16:00 e 20:00) ---
    const NUTRI_TARDE = 'Nutrição — tarde (16:00)';
    const NUTRI_FIM = 'Nutrição — reta final (20:00)';
    await bloco([NUTRI_TARDE, NUTRI_FIM], async () => {
      const metas = await metasNutricaoDoUsuario(usuario);
      if (!metas) {
        const semMeta =
          'Sem metas de proteína/calorias: não há plano alimentar ativo com metas nem peso registrado para estimá-las.';
        return [
          { rotina: NUTRI_TARDE, dispararia: false, detalhe: semMeta },
          { rotina: NUTRI_FIM, dispararia: false, detalhe: semMeta },
        ];
      }

      const consumo = await consumoNutricaoHoje(usuario.ref);
      const base =
        `Proteína ${consumo.protein}g de ${metas.proteinGoalG}g; ` +
        `calorias ${consumo.kcal} de ${metas.kcalGoal} kcal (só refeições confirmadas hoje).`;
      return [
        {
          rotina: NUTRI_TARDE,
          dispararia:
            (metas.proteinGoalG > 0 && consumo.protein < metas.proteinGoalG * 0.5) ||
            (metas.kcalGoal > 0 && consumo.kcal < metas.kcalGoal * 0.5),
          detalhe: `${base} Dispara abaixo de 50% em qualquer um dos dois.`,
        },
        {
          rotina: NUTRI_FIM,
          dispararia:
            (metas.proteinGoalG > 0 && consumo.protein < metas.proteinGoalG * 0.8) ||
            (metas.kcalGoal > 0 && consumo.kcal < metas.kcalGoal * 0.8) ||
            consumo.kcal < PISO_KCAL_SEGURO,
          detalhe: `${base} Dispara abaixo de 80%, ou abaixo de ${PISO_KCAL_SEGURO} kcal.`,
        },
      ];
    });

    // --- engajamentoRotina (sexta 18:00) ---
    const PESO = 'Check-in de peso (sexta, 18:00)';
    await bloco([PESO], async () => {
      const ultimoPeso = await usuario.ref
        .collection('weight_history')
        .orderBy('recordedAt', 'desc')
        .limit(1)
        .get();

      if (ultimoPeso.empty) {
        return [{ rotina: PESO, dispararia: true, detalhe: 'Nenhum peso registrado até hoje.' }];
      }

      const registradoEm = comoData(ultimoPeso.docs[0].data().recordedAt);
      if (!registradoEm) {
        return [
          {
            rotina: PESO,
            dispararia: true,
            detalhe: 'Há peso registrado, mas sem data válida em recordedAt — tratado como vencido.',
          },
        ];
      }
      return [
        {
          rotina: PESO,
          dispararia: registradoEm.getTime() < Date.now() - SEMANA_MS,
          detalhe: `Último peso em ${emBrt(registradoEm)}. Dispara se passar de 7 dias.`,
        },
      ];
    });

    /*
     * `ultimoPushEnviadoEm`/`ultimoPushRecebidoEm` são gravados pelo par
     * enviarParaUsuario → confirmarRecebimentoPush (Service Worker chamando
     * de volta ao acordar). Se o envio existe mas o recebimento nunca chegou
     * (ou é de outro dia), o push confirmadamente saiu do servidor e morreu
     * em algum lugar fora do nosso código — iOS/APNs, Foco, Baixo Consumo.
     * Se os dois batem, o problema (se houver) está no app, não na entrega.
     */
    const dadosUsuario = usuario.data();
    const ultimoPushEnviadoEm = comoData(dadosUsuario?.ultimoPushEnviadoEm);
    const ultimoPushRecebidoEm = comoData(dadosUsuario?.ultimoPushRecebidoEm);
    const atrasoMs =
      ultimoPushEnviadoEm && ultimoPushRecebidoEm
        ? ultimoPushRecebidoEm.getTime() - ultimoPushEnviadoEm.getTime()
        : null;

    /*
     * Última execução real de cada rotina agendada, gravada por
     * `registrarExecucao`. É o que distingue "o cron não disparou" de "o cron
     * disparou e me avaliou como inelegivel" — dois casos que, sem isto,
     * chegam na tela exatamente iguais.
     */
    const execucoes: Record<string, { executadaEm: string; resumo: Record<string, unknown> }> = {};
    try {
      const doc = await db.collection('sistema').doc('rotinas').get();
      for (const [nome, valor] of Object.entries(doc.data() ?? {})) {
        const registro = valor as Record<string, unknown>;
        const quando = comoData(registro.executadaEm);
        if (!quando) continue;
        const { executadaEm: _ignorado, ...resumo } = registro;
        execucoes[nome] = { executadaEm: emBrt(quando), resumo };
      }
    } catch (falha) {
      console.error('[diagnosticarNotificacoes] falha ao ler execuções', falha);
    }

    return {
      execucoes,
      dispositivo: {
        tokens: qtdTokens,
        achadoPelaVarredura,
        usuariosNaBase: varredura.total,
        usuariosComToken: varredura.comToken.length,
        ultimoPushEnviadoEm: ultimoPushEnviadoEm ? emBrt(ultimoPushEnviadoEm) : null,
        ultimoPushRecebidoEm: ultimoPushRecebidoEm ? emBrt(ultimoPushRecebidoEm) : null,
        atrasoMs,
      },
      avaliadoEm: emBrt(agora),
      rotinas,
    };
  } catch (falha) {
    /*
     * Sem isto o `onCall` converte qualquer exceção não tratada num "INTERNAL"
     * sem mensagem — exatamente o que uma ferramenta de diagnóstico não pode
     * fazer. O cliente já exibe `erro.message`, então o motivo real aparece na
     * tela em vez de um código cego.
     */
    if (falha instanceof HttpsError) throw falha;
    console.error('[diagnosticarNotificacoes] falha geral', uid, falha);
    const detalhe = falha instanceof Error ? falha.message : String(falha);
    throw new HttpsError('internal', `Diagnóstico falhou: ${detalhe}`);
  }
});

/**
 * Recebe a confirmação de que o Service Worker acordou e exibiu um push.
 * É `onRequest` (sem auth) porque o SW dispara isso a partir do evento
 * `push`, que não tem sessão de usuário — não há como chamar um `onCall`
 * dali. A gravação em `users/{uid}` é o que permite ao diagnóstico provar,
 * depois, se um push confirmadamente enviado pelo servidor chegou ou não
 * a acordar o dispositivo.
 */
export const confirmarRecebimentoPush = onRequest({ region: REGIAO, cors: true }, async (request, response) => {
  if (request.method !== 'POST') {
    response.status(405).send('Method Not Allowed');
    return;
  }

  const { uid, dispositivoId } = (request.body ?? {}) as {
    uid?: unknown;
    dispositivoId?: unknown;
  };
  if (typeof uid !== 'string' || uid.trim().length === 0) {
    response.status(400).send('uid inválido');
    return;
  }

  try {
    const db = getFirestore();
    const docUsuario = db.collection('users').doc(uid);
    const existe = (await docUsuario.get()).exists;
    if (!existe) {
      response.status(404).send('usuário não encontrado');
      return;
    }

    /*
     * Só o recebimento é gravado aqui. `ultimoPushEnviadoEm` passou a ser
     * escrito pelo próprio `enviarParaUsuario`, no servidor: é um dado de
     * envio, e deixar o cliente reescrevê-lo permitiria a qualquer chamada
     * a esta rota (que é pública, por não haver sessão dentro do Service
     * Worker) forjar o carimbo que o diagnóstico usa como prova.
     */
    const agora = Timestamp.now();
    await docUsuario.update({ ultimoPushRecebidoEm: agora });

    /*
     * Zerar o contador do dispositivo que confirmou é o que mantém a poda
     * honesta: só quem nunca acorda acumula envios sem confirmação e acaba
     * descartado. `dispositivoId` é hex de 20 caracteres vindo do payload que
     * o próprio servidor mandou — validado aqui porque a rota é pública e
     * é usado como id de documento no Firestore.
     */
    if (typeof dispositivoId === 'string' && /^[0-9a-f]{20}$/.test(dispositivoId)) {
      await colecaoDispositivos(uid).doc(dispositivoId).update({
        ultimoRecebimentoEm: agora,
        enviosSemConfirmacao: 0,
      });
    }

    response.status(204).send();
  } catch (falha) {
    console.error('[confirmarRecebimentoPush] falha', uid, falha);
    response.status(500).send('erro interno');
  }
});
