import type { User } from 'firebase/auth';
import { CHAVE_BIOMETRIA } from '@/lib/biometriaService';

/**
 * Só estes códigos significam "esta sessão morreu" — conta excluída,
 * desativada ou token irrecuperável.
 *
 * Qualquer outro erro (rede offline, timeout, indisponibilidade momentânea)
 * NÃO pode derrubar a sessão: derrubaria a cada oscilação de rede e quebraria
 * a expectativa de continuar logado no celular.
 */
const CODIGOS_SESSAO_MORTA = new Set([
  'auth/user-disabled',
  'auth/user-not-found',
  'auth/user-token-expired',
  'auth/invalid-user-token',
  'auth/requires-recent-login',
]);

function codigoDoErro(erro: unknown): string | null {
  if (typeof erro === 'object' && erro !== null && 'code' in erro) {
    const codigo = (erro as { code: unknown }).code;
    return typeof codigo === 'string' ? codigo : null;
  }
  return null;
}

export function eSessaoMorta(erro: unknown): boolean {
  const codigo = codigoDoErro(erro);
  return codigo !== null && CODIGOS_SESSAO_MORTA.has(codigo);
}

/**
 * Força um round-trip ao servidor para perguntar se a conta ainda existe.
 * Restaurar sessão apenas do cache local deixa o app "logado" com uma conta
 * já excluída, até alguém limpar os dados do navegador na mão.
 *
 * @returns `true` se a sessão continua válida, `false` se morreu.
 */
export async function validarSessao(usuario: User): Promise<boolean> {
  try {
    await usuario.getIdToken(true);
    return true;
  } catch (erro) {
    if (eSessaoMorta(erro)) return false;
    // Offline ou instabilidade: mantém a sessão. Verificamos de novo depois.
    console.warn('[DoseCerta] não foi possível validar a sessão agora:', erro);
    return true;
  }
}

/**
 * PWA instalado (standalone) costuma bloquear ou se comportar mal com
 * `signInWithPopup` do Google, principalmente no iOS. Nesses casos o fluxo de
 * login precisa usar `signInWithRedirect` em vez de popup.
 */
export function rodandoComoPWAInstalado(): boolean {
  const standaloneIOS = (navigator as { standalone?: boolean }).standalone === true;
  return window.matchMedia?.('(display-mode: standalone)').matches || standaloneIOS;
}

/** iPhone/iPad/iPod — usado junto com `rodandoComoPWAInstalado` porque no iOS a Push API só existe em modo standalone. */
export function detectarIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/** Celular Android — o resto (desktop Windows/Mac/Linux) cai no caso "web". */
export function detectarAndroid(): boolean {
  return /android/i.test(navigator.userAgent);
}

/**
 * Limpa todo o rastro local da sessão. Reaproveitado tanto pelo logout manual
 * quanto pela detecção de sessão morta — precisam ser o mesmo teardown.
 *
 * O flag de biometria é a única exceção: ele marca que ESTE DISPOSITIVO tem
 * uma passkey cadastrada, não a sessão em si, e precisa sobreviver ao logout
 * pra "Entrar com Biometria" continuar aparecendo na próxima vez que o app
 * abrir — senão o usuário teria que recadastrar a biometria a cada login.
 */
export function limparEstadoLocal() {
  try {
    const biometria = localStorage.getItem(CHAVE_BIOMETRIA);
    localStorage.clear();
    sessionStorage.clear();
    if (biometria) localStorage.setItem(CHAVE_BIOMETRIA, biometria);
  } catch {
    // Storage bloqueado (modo privado): nada a limpar.
  }
}
