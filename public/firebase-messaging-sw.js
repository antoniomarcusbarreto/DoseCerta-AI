/* eslint-disable */
/*
 * Service Worker de push, registrado no escopo dedicado
 * `/firebase-cloud-messaging-push-scope` (o mesmo default do FCM) — separado
 * de `/sw.js`, que cuida de cache/offline. Dois SWs no MESMO escopo se
 * substituem, então o escopo próprio é o que permite os dois coexistirem.
 *
 * Sem dependência do SDK do Firebase de propósito. A versão anterior fazia
 * `importScripts` do gstatic e usava `onBackgroundMessage`, o que trazia dois
 * problemas: (1) se a rede falhasse quando o SW acordasse para um push, o
 * import quebrava e NENHUMA notificação era exibida — justo no cenário
 * mobile onde a rede oscila; (2) a versão compat fixada (11.3.1) tinha
 * divergido da que o app empacota (11.10.0). O push do FCM chega como Web
 * Push padrão, então dá para tratar o evento `push` cru: menos peças, nada
 * para carregar em runtime e controle total sobre o `waitUntil`.
 */

const TITULO_PADRAO = 'DoseCerta';
const ICONE = '/icons/icon-192.png';
const URL_CONFIRMACAO = 'https://southamerica-east1-dosecertaai-edaa2.cloudfunctions.net/confirmarRecebimentoPush';

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

  const notificacao = dados.notification ?? {};
  const extras = dados.data ?? {};

  return {
    titulo: notificacao.title ?? extras.title ?? TITULO_PADRAO,
    corpo: notificacao.body ?? extras.body ?? '',
    link: extras.link ?? notificacao.click_action ?? '/',
    uid: extras.uid ?? null,
    enviadoEm: extras.enviadoEm ?? null,
    dispositivoId: extras.dispositivoId ?? null,
  };
}

/*
 * Best-effort: confirma ao servidor que este dispositivo acordou e recebeu
 * o push, para o diagnóstico conseguir provar depois se um envio confirmado
 * pelo FCM chegou a acordar o Service Worker ou morreu antes disso (iOS/APNs,
 * Foco, Baixo Consumo). Nunca deve impedir `showNotification` — por isso o
 * `catch` engole qualquer falha de rede/CORS em silêncio.
 */
function confirmarRecebimento(uid, enviadoEm, dispositivoId) {
  if (!uid) return Promise.resolve();
  return fetch(URL_CONFIRMACAO, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    keepalive: true,
    body: JSON.stringify({ uid, enviadoEm, dispositivoId }),
  }).catch(() => {});
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
        // Sem tag: cada lembrete é um evento distinto e não deve substituir o
        // anterior na bandeja.
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

// Assume o controle imediatamente: sem isso, uma versão corrigida do worker
// só passaria a valer depois que todas as abas fossem fechadas.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (evento) => evento.waitUntil(self.clients.claim()));
