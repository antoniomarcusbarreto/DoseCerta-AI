import { useCallback, useEffect, useRef, useState } from 'react';
import { confirmarInscricaoSalva, removerInscricaoPush, salvarInscricaoPush } from '@/lib/firestore';
import { useAuth } from '@/features/auth/AuthProvider';
import { detectarIOS } from '@/features/auth/sessao';
import { useAmbiente } from '@/lib/useAmbiente';
import { cancelarInscricao, obterInscricao, suportaPush } from './push';

const MENSAGEM_NEGADA = 'Você negou a permissão de notificações. Habilite pelas configurações do navegador.';

/**
 * Pede permissão, cria e persiste a inscrição de Web Push deste navegador,
 * confirmando a escrita no servidor e não só no cache local.
 *
 * A inscrição nasce do Service Worker RAIZ (ver `obterInscricao` em
 * `./push.ts`), o mesmo que controla o app — nenhum worker extra é registrado
 * aqui. É essa propriedade que faz o iOS entregar com o app encerrado.
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
  const [resetando, setResetando] = useState(false);
  // Guardado à parte do estado de React de propósito: só serve pro "Reset
  // Total" saber qual registro remover do Firestore, não precisa re-renderizar
  // nada quando muda.
  const ultimoEndpointRef = useRef<string | null>(null);

  // Núcleo comum de "criar a inscrição, salvar e confirmar no servidor" —
  // usado tanto pelo clique manual quanto pelos rechecks automáticos.
  // Lança um erro específico em cada etapa em vez de só retornar `false`:
  // o objetivo é a UI sempre conseguir mostrar o motivo real da falha
  // (suporte, chave VAPID, inscrição, ou a escrita não ter chegado no
  // servidor), nunca deixar isso morrer só no console.
  const obterEPersistirToken = useCallback(async (): Promise<void> => {
    if (!usuario) throw new Error('Você precisa estar logado para habilitar notificações.');

    if (!suportaPush()) {
      throw new Error('Este navegador não suporta notificações push.');
    }

    const inscricao = await obterInscricao();
    ultimoEndpointRef.current = inscricao.endpoint;

    await salvarInscricaoPush(usuario.uid, inscricao);

    const confirmado = await confirmarInscricaoSalva(usuario.uid, inscricao.endpoint);
    if (!confirmado) {
      throw new Error(
        'A inscrição foi criada, mas não foi confirmada no servidor. Verifique sua conexão e tente novamente.',
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

  /*
   * O mesmo recheck acima, mas disparado ao voltar ao primeiro plano — não só
   * no mount. Uma inscrição de push pode morrer silenciosamente (troca de
   * dispositivo, app reinstalado, o próprio SO revogando o registro) sem
   * nenhum evento que avise o app, e em PWA trocar de app no celular não
   * recarrega a página. Sem isto, uma inscrição morta só seria detectada se a
   * pessoa fechasse e reabrisse o app do zero — na prática, nunca. Foi assim
   * que dois usuários pararam de receber lembretes.
   */
  useEffect(() => {
    if (!usuario || precisaInstalar) return;
    if (typeof Notification === 'undefined') return;

    const aoVoltar = () => {
      if (document.visibilityState !== 'visible') return;
      if (Notification.permission !== 'granted') return;
      obterEPersistirToken().catch((falha: unknown) => {
        console.error('[DoseCerta] recheck de notificações ao voltar ao app falhou:', falha);
      });
    };

    document.addEventListener('visibilitychange', aoVoltar);
    return () => document.removeEventListener('visibilitychange', aoVoltar);
  }, [usuario, precisaInstalar, obterEPersistirToken]);

  /*
   * Mesmo recheck, mas em intervalo fixo enquanto o app fica aberto em
   * primeiro plano — não só nas bordas de mount/volta ao app. Uma sessão
   * longa sem nenhuma interação não teria motivo pra revalidar a inscrição
   * até o usuário sair e voltar. Silencioso de propósito:
   * mesmo tratamento de erro do recheck de `visibilitychange` (só console),
   * sem tocar em nenhum estado visível — o botão "Sincronizar Dispositivo"
   * continua sendo o único ponto com feedback na tela.
   */
  useEffect(() => {
    if (!usuario || precisaInstalar) return;
    if (typeof Notification === 'undefined') return;

    const INTERVALO_MS = 20 * 60 * 1000;
    const id = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      if (Notification.permission !== 'granted') return;
      obterEPersistirToken().catch((falha: unknown) => {
        console.error('[DoseCerta] recheck periódico de notificações falhou:', falha);
      });
    }, INTERVALO_MS);

    return () => window.clearInterval(id);
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

  // "Reset Total": limpeza profunda pra quando o IndexedDB/Service Worker
  // simples resolvem. Cada etapa é best-effort (nunca deixa uma falha
  // isolada impedir as demais) — o objetivo é sair do jeito mais limpo
  // possível antes do reload forçado.
  // "Reset de Notificações": limpeza profunda pra quando a inscrição local
  // fica em estado inconsistente. Cancela a inscrição deste navegador e apaga o
  // registro correspondente no Firestore. Cada etapa é best-effort (uma falha
  // isolada nunca impede as demais).
  //
  // A versão anterior chamava `getRegistrations()` e desregistrava TODOS os
  // service workers, incluindo o do próprio app — e deixava o registro no
  // Firestore. O resultado era o pior cenário possível: o servidor seguia
  // enviando, o provedor aceitava, e não existia mais worker nenhum do outro
  // lado para exibir. Nunca desregistre o worker aqui; ele é o dono da
  // inscrição e quem serve o app offline.
  const resetarNotificacoes = useCallback(async () => {
    setResetando(true);
    setErro(null);
    try {
      let endpoint: string | null = null;
      try {
        endpoint = await cancelarInscricao();
      } catch (falha) {
        console.warn('[DoseCerta] reset: falha ao cancelar a inscrição no navegador', falha);
      }

      // Cai para o endpoint memorizado se o navegador já não tiver mais a
      // inscrição — sem isso o documento ficaria órfão no Firestore.
      const alvo = endpoint ?? ultimoEndpointRef.current;
      try {
        if (usuario && alvo) {
          await removerInscricaoPush(usuario.uid, alvo);
        }
      } catch (falha) {
        console.warn('[DoseCerta] reset: falha ao remover a inscrição do Firestore', falha);
      }

      ultimoEndpointRef.current = null;
      setTokenConfirmado(false);
    } finally {
      setResetando(false);
    }
  }, [usuario]);

  return {
    permissao,
    precisaInstalar,
    verificando,
    sincronizando,
    tokenConfirmado,
    erro,
    resetando,
    sincronizarDispositivo,
    resetarNotificacoes,
  };
}
