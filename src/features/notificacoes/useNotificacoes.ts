import { useCallback, useEffect, useState } from 'react';
import { getToken, onMessage, type MessagePayload } from 'firebase/messaging';
import { getMessagingCliente } from '@/lib/firebase';
import { confirmarTokenFcmSalvo, salvarTokenFcm } from '@/lib/firestore';
import { useAuth } from '@/features/auth/AuthProvider';
import { detectarIOS } from '@/features/auth/sessao';
import { useAmbiente } from '@/lib/useAmbiente';

const MENSAGEM_NEGADA = 'Você negou a permissão de notificações. Habilite pelas configurações do navegador.';

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
 * Pede permissão, obtém e persiste o token FCM do dispositivo (confirmando
 * a escrita no servidor, não só no cache local), e escuta mensagens em
 * primeiro plano. O registro do Service Worker de mensagens só acontece
 * aqui (não no boot do app), para não abrir um SW extra sem o usuário ter
 * pedido notificações.
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
  const [sincronizando, setSincronizando] = useState(false);
  // true só durante o primeiro recheck automático do mount — evita a UI
  // piscar entre "Sincronizar Dispositivo" e "Habilitado" antes da resposta.
  const [verificando, setVerificando] = useState(true);
  const [tokenConfirmado, setTokenConfirmado] = useState(false);
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

  // Núcleo comum de "pegar o token do dispositivo, salvar e confirmar no
  // servidor" — usado tanto pelo clique manual quanto pelo recheck do mount.
  // Lança um erro específico em cada etapa em vez de só retornar `false`:
  // o objetivo é a UI sempre conseguir mostrar o motivo real da falha
  // (suporte, VAPID key, token, ou a escrita não ter chegado no servidor),
  // nunca deixar isso morrer só no console.
  const obterEPersistirToken = useCallback(async (): Promise<void> => {
    if (!usuario) throw new Error('Você precisa estar logado para habilitar notificações.');

    const messaging = await getMessagingCliente();
    const registro = await registrarSWMensagens();
    if (!messaging || !registro) {
      throw new Error('Este navegador não suporta notificações push.');
    }

    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    if (!vapidKey) {
      throw new Error('Configuração ausente: chave VAPID (VITE_FIREBASE_VAPID_KEY) não definida.');
    }

    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registro });
    if (!token) {
      throw new Error('Não foi possível obter o token de notificação deste dispositivo.');
    }

    await salvarTokenFcm(usuario.uid, token);

    const confirmado = await confirmarTokenFcmSalvo(usuario.uid, token);
    if (!confirmado) {
      throw new Error(
        'O token foi gerado, mas não foi confirmado no servidor. Verifique sua conexão e tente novamente.',
      );
    }

    setTokenConfirmado(true);
  }, [usuario]);

  // Recheck automático: se a permissão já está concedida (de uma sessão
  // anterior), confirma/recupera o token sem exigir um novo clique — e de
  // quebra corrige o caso em que o token nunca chegou a ser salvo de fato.
  // Ao contrário de antes, uma falha aqui também aparece na tela: o usuário
  // pediu explicitamente pra não esconder isso no console.
  useEffect(() => {
    if (!usuario || precisaInstalar) {
      setVerificando(false);
      return;
    }
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
      setVerificando(false);
      return;
    }

    let cancelado = false;
    setVerificando(true);
    obterEPersistirToken()
      .catch((falha: unknown) => {
        if (cancelado) return;
        console.error('[DoseCerta] recheck automático de notificações falhou:', falha);
        setErro(falha instanceof Error ? falha.message : String(falha));
      })
      .finally(() => {
        if (!cancelado) setVerificando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [usuario, precisaInstalar, obterEPersistirToken]);

  const sincronizarDispositivo = useCallback(async () => {
    if (!usuario || precisaInstalar) return;
    if (typeof Notification === 'undefined') {
      setErro('Este navegador não suporta notificações push.');
      return;
    }

    setSincronizando(true);
    setErro(null);
    try {
      // Instantâneo e sem novo prompt quando a permissão já foi concedida —
      // por isso esta mesma função serve tanto pro primeiro pedido quanto
      // pro botão "Sincronizar Dispositivo" de uma nova tentativa.
      const resultado = await Notification.requestPermission();
      setPermissao(resultado);
      if (resultado !== 'granted') {
        setErro(MENSAGEM_NEGADA);
        return;
      }

      await obterEPersistirToken();
    } catch (falha) {
      console.error('[DoseCerta] falha ao sincronizar notificações:', falha);
      setErro(falha instanceof Error ? falha.message : String(falha));
    } finally {
      setSincronizando(false);
    }
  }, [usuario, precisaInstalar, obterEPersistirToken]);

  return {
    permissao,
    precisaInstalar,
    verificando,
    sincronizando,
    tokenConfirmado,
    erro,
    ultimaMensagem,
    sincronizarDispositivo,
  };
}
