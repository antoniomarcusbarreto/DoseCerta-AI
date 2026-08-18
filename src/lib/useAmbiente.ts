import { useEffect, useState } from 'react';
import { detectarAndroid, detectarIOS, rodandoComoPWAInstalado } from '@/features/auth/sessao';
import { aoCapturarPrompt, obterPromptInstalacao } from './promptInstalacao';

export type Ambiente = {
  /** Rodando instalado (standalone), em Android ou iOS. */
  isPWA: boolean;
  /** UA de celular (Android ou iOS) — independe de estar instalado. */
  isMobile: boolean;
  /** Elegível para o prompt nativo de instalação (Android/Chrome). Sempre falso já instalado. */
  canInstall: boolean;
};

/**
 * Detecção de ambiente reativa, usada para restringir funcionalidades
 * mobile/PWA-only (notificações, biometria, instalar app) fora do desktop.
 */
export function useAmbiente(): Ambiente {
  const [isPWA, setIsPWA] = useState(rodandoComoPWAInstalado);
  const [canInstall, setCanInstall] = useState(() => Boolean(obterPromptInstalacao()));

  useEffect(() => {
    const midia = window.matchMedia('(display-mode: standalone)');
    const atualizar = () => setIsPWA(rodandoComoPWAInstalado());
    midia.addEventListener?.('change', atualizar);

    const aoInstalar = () => {
      setIsPWA(true);
      setCanInstall(false);
    };
    window.addEventListener('appinstalled', aoInstalar);

    const cancelarPrompt = aoCapturarPrompt(() => setCanInstall(true));

    return () => {
      midia.removeEventListener?.('change', atualizar);
      window.removeEventListener('appinstalled', aoInstalar);
      cancelarPrompt();
    };
  }, []);

  return {
    isPWA,
    isMobile: detectarAndroid() || detectarIOS(),
    canInstall: canInstall && !isPWA,
  };
}
