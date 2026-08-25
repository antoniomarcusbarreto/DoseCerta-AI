/*
 * Inscrição de Web Push no navegador.
 *
 * Espelha a implementação do HoraCerta-AI, que entrega no iOS com a tela
 * bloqueada e o app encerrado. O ponto que faz isso funcionar é um só, e está
 * em `obterInscricao`: a inscrição é criada a partir de
 * `navigator.serviceWorker.ready` — a registration que CONTROLA a página, no
 * escopo `/`. Antes usávamos o FCM, que registra um worker próprio num escopo
 * dedicado; aquela registration não controlava client nenhum, e o iOS não
 * acordava ela de forma confiável com o app fechado.
 */

/** Converte a chave VAPID base64url no `Uint8Array` que `subscribe()` espera. */
function base64UrlParaUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const preenchimento = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalizada = (base64 + preenchimento).replace(/-/g, '+').replace(/_/g, '/');
  const bruto = atob(normalizada);
  // `ArrayBuffer` explícito: o tipo padrão de `Uint8Array` admite
  // `SharedArrayBuffer`, que `applicationServerKey` não aceita.
  const saida = new Uint8Array(new ArrayBuffer(bruto.length));
  for (let i = 0; i < bruto.length; i += 1) saida[i] = bruto.charCodeAt(i);
  return saida;
}

export function suportaPush(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof window !== 'undefined' &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/** Dados da inscrição no formato que o servidor precisa para cifrar o envio. */
export type InscricaoPush = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

function comoInscricaoPush(assinatura: PushSubscription): InscricaoPush {
  // `toJSON()` devolve as chaves já em base64url, prontas para o `web-push`.
  const json = assinatura.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  const endpoint = json.endpoint ?? assinatura.endpoint;
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!endpoint || !p256dh || !auth) {
    throw new Error('A inscrição de push veio incompleta do navegador.');
  }
  return { endpoint, keys: { p256dh, auth } };
}

/**
 * Devolve a inscrição deste navegador, reaproveitando a existente quando há
 * uma. Idempotente de propósito: é chamada no mount, ao voltar ao primeiro
 * plano e em intervalo fixo, e nenhuma dessas chamadas pode gerar inscrição
 * nova a cada vez.
 *
 * Lança com mensagem específica em cada etapa em vez de devolver `null`: a UI
 * precisa conseguir mostrar o motivo real da falha, nunca deixar isso morrer
 * só no console.
 */
export async function obterInscricao(): Promise<InscricaoPush> {
  if (!suportaPush()) {
    throw new Error('Este navegador não suporta notificações push.');
  }

  const chavePublica = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (!chavePublica) {
    throw new Error('Configuração ausente: chave VAPID pública (VITE_VAPID_PUBLIC_KEY) não definida.');
  }

  /*
   * `ready` (e não `register`) é o ponto crítico desta arquitetura: ele resolve
   * para a registration ATIVA que controla esta página — o worker raiz gerado
   * pelo vite-plugin-pwa, que já embute o handler de push via `importScripts`.
   * Criar a inscrição a partir dele é o que faz o iOS entregar com o app
   * encerrado.
   */
  const registro = await navigator.serviceWorker.ready;

  const existente = await registro.pushManager.getSubscription();
  if (existente) return comoInscricaoPush(existente);

  const nova = await registro.pushManager.subscribe({
    // Obrigatório: promete ao navegador que todo push vira notificação visível.
    // O iOS revoga a inscrição de quem recebe push sem exibir nada.
    userVisibleOnly: true,
    applicationServerKey: base64UrlParaUint8Array(chavePublica),
  });
  return comoInscricaoPush(nova);
}

/**
 * Cancela a inscrição deste navegador. Usado pelo "Reset de Notificações".
 * Devolve o endpoint cancelado para o chamador saber qual registro apagar no
 * Firestore — sem ele, o servidor continuaria enviando para uma inscrição que
 * não existe mais, que é justamente o tipo de sucesso falso que esta
 * arquitetura veio eliminar.
 */
export async function cancelarInscricao(): Promise<string | null> {
  if (!suportaPush()) return null;
  const registro = await navigator.serviceWorker.ready;
  const assinatura = await registro.pushManager.getSubscription();
  if (!assinatura) return null;
  const { endpoint } = assinatura;
  await assinatura.unsubscribe().catch(() => {});
  return endpoint;
}
