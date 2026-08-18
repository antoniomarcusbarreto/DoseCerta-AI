import { useEffect, useState } from 'react';
import { onMessage } from 'firebase/messaging';
import { getMessagingCliente } from '@/lib/firebase';

const DURACAO_MS = 6000;

type Aviso = { id: number; titulo: string; corpo: string };

/**
 * Banner de notificação recebida com o app em primeiro plano.
 *
 * Com o app aberto o sistema operacional não exibe o banner nativo — o push
 * chega direto no `onMessage` e sumiria sem deixar rastro. Este componente é
 * o que dá ao PWA o mesmo comportamento de um app nativo nos três estados
 * (fechado e minimizado ficam com o service worker; aberto fica aqui).
 *
 * Montado uma única vez no `Layout`: dois listeners `onMessage` ativos
 * exibiriam a mesma notificação em duplicidade.
 */
export function ToastNotificacao() {
  const [aviso, setAviso] = useState<Aviso | null>(null);

  useEffect(() => {
    let cancelado = false;

    async function ouvir() {
      const messaging = await getMessagingCliente();
      if (!messaging || cancelado) return;
      return onMessage(messaging, (payload) => {
        const titulo = payload.notification?.title ?? 'DoseCerta';
        const corpo = payload.notification?.body ?? '';
        // `id` novo a cada mensagem reinicia o timer de auto-dispensa mesmo
        // quando o texto repete.
        setAviso({ id: Date.now(), titulo, corpo });
      });
    }

    const cancelarPromessa = ouvir();
    return () => {
      cancelado = true;
      void cancelarPromessa.then((cancelar) => cancelar?.());
    };
  }, []);

  useEffect(() => {
    if (!aviso) return;
    const timer = window.setTimeout(() => setAviso(null), DURACAO_MS);
    return () => window.clearTimeout(timer);
  }, [aviso]);

  if (!aviso) return null;

  return (
    <button
      type="button"
      onClick={() => setAviso(null)}
      role="status"
      aria-live="polite"
      /* Encostado no topo, como um banner do sistema — e abaixo do recorte
         da câmera/Dynamic Island, senão o texto fica escondido no iPhone. */
      style={{
        position: 'fixed',
        left: '50%',
        top: 'calc(env(safe-area-inset-top, 0px) + 12px)',
        transform: 'translateX(-50%)',
        zIndex: 1100,
        width: 'min(420px, calc(100vw - 24px))',
        textAlign: 'left',
        padding: '14px 16px',
        borderRadius: 'var(--r-card)',
        background: 'var(--surface-card)',
        color: 'var(--ink)',
        boxShadow: 'var(--shadow-card)',
        border: '1.5px solid var(--border-hair)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <span className="t-label block text-ink">{aviso.titulo}</span>
      {aviso.corpo ? <span className="t-label mt-0.5 block text-ink-muted">{aviso.corpo}</span> : null}
    </button>
  );
}
