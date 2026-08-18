import { useCallback, useEffect, useState } from 'react';
import { getToken, onMessage, type MessagePayload } from 'firebase/messaging';
import { getMessagingCliente } from '@/lib/firebase';
import { salvarTokenFcm } from '@/lib/firestore';
import { useAuth } from '@/features/auth/AuthProvider';
import { detectarIOS, rodandoComoPWAInstalado } from '@/features/auth/sessao';

const MENSAGEM_SEM_SUPORTE = 'Este navegador não suporta notificações push.';
const MENSAGEM_NEGADA = 'Você negou a permissão de notificações. Habilite pelas configurações do navegador.';
const MENSAGEM_ERRO = 'Não foi possível habilitar as notificações agora. Tente novamente.';

async function registrarSWMensagens(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  return navigator.serviceWorker.register('/firebase-messaging-sw.js');
}

/**
 * Pede permissão, obtém e persiste o token FCM do dispositivo, e escuta
 * mensagens em primeiro plano. O registro do Service Worker de mensagens só
 * acontece aqui (não no boot do app), para não abrir um SW extra sem o
 * usuário ter pedido notificações.
 */
export function useNotificacoes() {
  const { usuario } = useAuth();
  const [permissao, setPermissao] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied',
  );
  // No iOS, a Push API só existe com o app instalado (modo standalone) —
  // fora disso, pedir permissão fica num estado que nem sempre erra, só não
  // funciona de verdade. Melhor nem tentar do que deixar o usuário achando
  // que habilitou.
  const [precisaInstalar] = useState(() => detectarIOS() && !rodandoComoPWAInstalado());
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

      const messaging = await getMessagingCliente();
      const registro = await registrarSWMensagens();
      if (!messaging || !registro) {
        setErro(MENSAGEM_SEM_SUPORTE);
        return;
      }

      const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
      const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registro });
      if (!token) {
        setErro(MENSAGEM_ERRO);
        return;
      }

      await salvarTokenFcm(usuario.uid, token);
      setTokenSalvo(true);
    } catch (falha) {
      console.error('[DoseCerta] falha ao habilitar notificações:', falha);
      setErro(MENSAGEM_ERRO);
    } finally {
      setHabilitando(false);
    }
  }, [usuario, precisaInstalar]);

  return { permissao, precisaInstalar, habilitando, tokenSalvo, erro, ultimaMensagem, habilitar };
}
