import { useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * Banner de atualização OTA do PWA.
 *
 * `needRefresh` fica true quando o Workbox detecta um service worker novo
 * (assets do build mudaram) já instalado e em espera. `updateServiceWorker(true)`
 * manda o SW novo assumir (skip-waiting) e recarrega a página — sem isso o
 * usuário ficaria preso na versão antiga até fechar todas as abas.
 *
 * O reload não é instantâneo (espera o `controllerchange`), então escondemos
 * o banner e desabilitamos o botão assim que o clique acontece — sem isso,
 * um segundo clique dispara `updateServiceWorker` de novo, ou o banner some
 * e reaparece durante a janela entre o clique e o reload de fato.
 */
export function ReloadPrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  const [atualizando, setAtualizando] = useState(false);

  if (!needRefresh || atualizando) return null;

  function atualizar() {
    setAtualizando(true);
    updateServiceWorker(true);
  }

  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        left: '50%',
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        width: 'min(360px, calc(100vw - 32px))',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        padding: '16px',
        borderRadius: 'var(--r-card)',
        background: 'var(--surface-card)',
        color: 'var(--ink)',
        boxShadow: 'var(--shadow-card)',
        border: '1.5px solid var(--border-hair)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <p style={{ margin: 0, fontSize: '0.9375rem', color: 'var(--ink)' }}>
        Uma nova atualização do aplicativo está disponível.
      </p>
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={() => setNeedRefresh(false)}
          style={{
            padding: '10px 14px',
            borderRadius: 'var(--r-pill)',
            border: 'none',
            background: 'transparent',
            color: 'var(--ink-muted)',
            fontSize: '0.875rem',
            fontWeight: 500,
            cursor: 'pointer',
            minHeight: 'var(--touch-min)',
          }}
        >
          Fechar
        </button>
        <button
          type="button"
          onClick={atualizar}
          style={{
            padding: '10px 16px',
            borderRadius: 'var(--r-pill)',
            border: 'none',
            background: 'var(--btn-primary-bg, var(--hero-0))',
            color: 'var(--btn-primary-text, var(--on-hero))',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: 'pointer',
            minHeight: 'var(--touch-min)',
          }}
        >
          Atualizar agora
        </button>
      </div>
    </div>
  );
}
