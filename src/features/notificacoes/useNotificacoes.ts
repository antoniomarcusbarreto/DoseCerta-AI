import { useCallback, useEffect, useState } from 'react';
import { getToken, onMessage, type MessagePayload } from 'firebase/messaging';
import { getMessagingCliente } from '@/lib/firebase';
import { salvarTokenFcm } from '@/lib/firestore';
import { useAuth } from '@/features/auth/AuthProvider';
import { detectarIOS } from '@/features/auth/sessao';
import { useAmbiente } from '@/lib/useAmbiente';

const MENSAGEM_SEM_SUPORTE = 'Este navegador não suporta notificações push.';
const MENSAGEM_NEGADA = 'Você negou a permissão de notificações. Habilite pelas configurações do navegador.';
const MENSAGEM_ERRO = 'Não foi possível habilitar as notificações agora. Tente novamente.';

// Escopo próprio (fora de '/'), obrigatório aqui: o app já registra outro
// service worker em '/' (Workbox, via vite-plugin-pwa) para cache/offline.
// Registrar o SW do FCM sem escopo dedicado faria as duas registrations
// colidirem na mesma scope '/' — o navegador entrega o evento `push` só para
// UM worker ativo por escopo, e não necessariamente para o nosso, então o
// push chega no servidor mas nunca aparece pro usuário.
const ESCOPO_SW_MENSAGENS = '/firebase-cloud-messaging-push-scope';

async function registrarSWMensagens(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  return navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: ESCOPO_SW_MENSAGENS });
}

/**
 * Pede permissão, obtém e persiste o token FCM do dispositivo, e escuta
 * mensagens em primeiro plano. O registro do Service Worker de mensagens só
 * acontece aqui (não no boot do app), para não abrir um SW extra sem o
 * usuário ter pedido notificações.
 */
export function useNotificacoes() {
  const { usuario } = useAuth();
  const { isPWA, isMobile } = useAmbiente();
  const [permissao, setPermissao] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied',
  );
  /*
   * No iOS, a Push API só existe com o app instalado (modo standalone) —
   * fora disso, pedir permissão fica num estado que nem sempre erra, só não
   * funciona de verdade. Melhor nem tentar do que deixar o usuário achando
   * que habilitou. No desktop puro (nem PWA nem mobile) a funcionalidade
   * inteira fica fora do escopo do produto, então também conta como
   * "precisa instalar" — é o sinal que a tela usa pra não oferecer o botão.
   */
  const precisaInstalar = (!isPWA && !isMobile) || (detectarIOS() && !isPWA);
  const [habilitando, setHabilitando] = useState(false);
  const [tokenSalvo, setTokenSalvo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ultimaMensagem, setUltimaMensagem] = useState<MessagePayload | null>(null);

  useEffect(() => {
    let cancelado = false;

    async function ouvirPrimeiroPlano() {
      const messaging = await getMessagingCliente();
      if (!messaging || cancelado) return;
      return onMessage(messaging, (payload) => {
        setUltimaMensagem(payload);
      });
    }

    const unsubscribePromise = ouvirPrimeiroPlano();
    return () => {
      cancelado = true;
      void unsubscribePromise.then((unsubscribe) => unsubscribe?.());
    };
  }, []);

  // Núcleo comum de "pegar o token do dispositivo e persistir no Firestore",
  // usado tanto pelo clique manual (`habilitar`) quanto pelo recheck
  // silencioso no mount — sem isso, `tokenSalvo` fica só na memória do
  // componente e o botão "Habilitar" volta a aparecer a cada reload mesmo
  // com a permissão do navegador já concedida e o token já salvo antes.
  const obterEPersistirToken = useCallback(async (): Promise<boolean> => {
    if (!usuario) return false;

    const messaging = await getMessagingCliente();
    const registro = await registrarSWMensagens();
    if (!messaging || !registro) return false;

    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registro });
    if (!token) return false;

    await salvarTokenFcm(usuario.uid, token);
    setTokenSalvo(true);
    return true;
  }, [usuario]);

  // Recheck silencioso: se a permissão já está concedida (de uma sessão
  // anterior), confirma/recupera o token sem exigir um novo clique — e de
  // quebra corrige o caso em que o token nunca chegou a ser salvo (ex.: bug
  // de escopo do SW já corrigido). Falha aqui não vira `erro` visível — é
  // só um recheck em segundo plano, não uma ação que o usuário pediu agora.
  useEffect(() => {
    if (!usuario || precisaInstalar) return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

    let cancelado = false;
    obterEPersistirToken()
      .then((ok) => {
        if (!ok && !cancelado) {
          console.warn('[DoseCerta] permissão de notificação já concedida, mas não foi possível confirmar o token FCM.');
        }
      })
      .catch((falha) => {
        if (!cancelado) console.warn('[DoseCerta] falha ao reconfirmar token FCM no mount:', falha);
      });

    return () => {
      cancelado = true;
    };
  }, [usuario, precisaInstalar, obterEPersistirToken]);

  const habilitar = useCallback(async () => {
    if (!usuario || precisaInstalar) return;
    if (typeof Notification === 'undefined') {
      setErro(MENSAGEM_SEM_SUPORTE);
      return;
    }

    setHabilitando(true);
    setErro(null);
    try {
      const resultado = await Notification.requestPermission();
      setPermissao(resultado);
      if (resultado !== 'granted') {
        setErro(MENSAGEM_NEGADA);
        return;
      }

      const ok = await obterEPersistirToken();
      if (!ok) {
        setErro(MENSAGEM_ERRO);
      }
    } catch (falha) {
      console.error('[DoseCerta] falha ao habilitar notificações:', falha);
      setErro(MENSAGEM_ERRO);
    } finally {
      setHabilitando(false);
    }
  }, [usuario, precisaInstalar, obterEPersistirToken]);

  return { permissao, precisaInstalar, habilitando, tokenSalvo, erro, ultimaMensagem, habilitar };
}
