/* eslint-disable */
/*
 * Handler de Web Push, importado pelo Service Worker RAIZ (`/sw.js`, gerado
 * pelo vite-plugin-pwa) via `workbox.importScripts`.
 *
 * Ser importado pelo SW raiz é o ponto central desta arquitetura, não um
 * detalhe de organização. A versão anterior registrava um Service Worker
 * separado, do FCM, no escopo `/firebase-cloud-messaging-push-scope` — um
 * caminho que nenhuma página jamais navega e que portanto não controla client
 * nenhum. Com o app aberto aquele worker já estava vivo e o push aparecia; com
 * o app ENCERRADO, o iOS precisava acordar uma registration órfã e
 * simplesmente não entregava. O sintoma parecia "throttling da Apple" porque
 * acompanhava o estado do app, mas a variável real era o worker estar vivo ou
 * precisar de cold start. Com a inscrição pertencendo ao worker que controla o
 * PWA instalado, o iOS entrega com a tela bloqueada e o app fechado.
 *
 * Sem SDK do Firebase de propósito: o push chega como Web Push padrão, então
 * o evento `push` cru basta. Menos peças, nada para carregar em runtime e
 * controle total sobre o `waitUntil`.
 */

const TITULO_PADRAO = 'DoseCerta';
const ICONE = '/icons/icon-192.png';
const URL_CONFIRMACAO = 'https://southamerica-east1-dosecertaai-edaa2.cloudfunctions.net/confirmarRecebimentoPush';

/*
 * Teto para a confirmação de recebimento. Ela é puramente diagnóstica, mas
 * vive dentro do `waitUntil` — sem teto, um cold start da Cloud Function
 * (3-4s observados em produção) mantém o Service Worker vivo esperando, e o
 * iOS cobra esse tempo do orçamento de execução, podendo estrangular o
 * próximo push. A notificação nunca deve depender disso.
 */
const TIMEOUT_CONFIRMACAO_MS = 1000;

function extrairNotificacao(evento) {
  if (!evento.data) return null;

  let dados;
  try {
    dados = evento.data.json();
  } catch (erro) {
    // Payload que não é JSON: ainda melhor mostrar como texto do que engolir.
    return {
      titulo: TITULO_PADRAO,
      corpo: evento.data.text(),
      link: '/',
      uid: null,
      enviadoEm: null,
      dispositivoId: null,
    };
  }

  const extras = dados.data ?? {};

  return {
    titulo: dados.title ?? TITULO_PADRAO,
    corpo: dados.body ?? '',
    tag: dados.tag ?? null,
    link: extras.url ?? '/',
    uid: extras.uid ?? null,
    enviadoEm: extras.enviadoEm ?? null,
    dispositivoId: extras.dispositivoId ?? null,
  };
}

/*
 * Best-effort: confirma ao servidor que este dispositivo acordou e exibiu o
 * push. É o que permite provar, depois, se um envio aceito pelo push service
 * chegou a acordar o Service Worker ou morreu no caminho — foi o único dado
 * que tornou diagnosticável o caso que motivou esta reescrita. Nunca pode
 * impedir nem atrasar o `showNotification`: o `catch` engole falha de
 * rede/CORS e o timeout impede que um cold start segure o worker.
 */
function confirmarRecebimento(uid, enviadoEm, dispositivoId) {
  if (!uid) return Promise.resolve();

  const requisicao = fetch(URL_CONFIRMACAO, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    keepalive: true,
    body: JSON.stringify({ uid, enviadoEm, dispositivoId }),
  }).catch(() => {});

  const teto = new Promise((resolve) => setTimeout(resolve, TIMEOUT_CONFIRMACAO_MS));
  return Promise.race([requisicao, teto]);
}

self.addEventListener('push', (evento) => {
  const conteudo = extrairNotificacao(evento);
  if (!conteudo) return;

  /*
   * `waitUntil` é obrigatório: sem ele o navegador pode encerrar o worker
   * antes de `showNotification` resolver, e a notificação simplesmente não
   * aparece. O iOS é especialmente agressivo nesse encerramento — e ainda
   * penaliza push que não vira notificação visível, podendo revogar a
   * inscrição do dispositivo.
   */
  evento.waitUntil(
    Promise.all([
      self.registration.showNotification(conteudo.titulo, {
        body: conteudo.corpo,
        icon: ICONE,
        badge: ICONE,
        // Cada lembrete é um evento distinto e não deve substituir o anterior
        // na bandeja — o servidor manda uma tag única por dose/rotina.
        tag: conteudo.tag ?? undefined,
        data: { link: conteudo.link },
      }),
      confirmarRecebimento(conteudo.uid, conteudo.enviadoEm, conteudo.dispositivoId),
    ]),
  );
});

/** Tocar na notificação foca a aba já aberta, ou abre o app se não houver nenhuma. */
self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  const destino = new URL(evento.notification.data?.link ?? '/', self.location.origin).href;

  evento.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
      for (const janela of janelas) {
        if ('focus' in janela) return janela.focus();
      }
      return self.clients.openWindow ? self.clients.openWindow(destino) : undefined;
    }),
  );
});

/*
 * O navegador pode rotacionar a inscrição por conta própria. Sem tratar isso,
 * a inscrição no servidor vira lixo silencioso: o push service passa a
 * recusá-la e o usuário para de receber sem nada avisar. Aqui só reinscrevemos
 * no navegador; o registro no Firestore é refeito pelo app na próxima abertura
 * (os rechecks de `useNotificacoes`), que é quem tem sessão autenticada.
 */
self.addEventListener('pushsubscriptionchange', (evento) => {
  const anterior = evento.oldSubscription;
  const chave = anterior?.options?.applicationServerKey;
  if (!chave) return;
  evento.waitUntil(
    self.registration.pushManager
      .subscribe({ userVisibleOnly: true, applicationServerKey: chave })
      .catch(() => {}),
  );
});
