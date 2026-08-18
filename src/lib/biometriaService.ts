import { httpsCallable } from 'firebase/functions';
import {
  browserSupportsWebAuthn,
  startAuthentication,
  startRegistration,
  WebAuthnError,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser';
import { getFunctionsCliente } from './firebase';

/** Mesma convenção `CHAVE_<NOME>` já usada em `src/components/InstalacaoWizard.tsx`. */
export const CHAVE_BIOMETRIA = 'dosecerta:biometriaHabilitada';

export function suportaBiometria(): boolean {
  return browserSupportsWebAuthn();
}

export function dispositivoTemBiometria(): boolean {
  try {
    return localStorage.getItem(CHAVE_BIOMETRIA) === '1';
  } catch {
    return false;
  }
}

function marcarDispositivoComBiometria(): void {
  try {
    localStorage.setItem(CHAVE_BIOMETRIA, '1');
  } catch {
    // Storage bloqueado (modo privado): só não vai aparecer o atalho depois.
  }
}

/** Cancelamento do usuário na prompt do SO — não é erro, mesmo tratamento dado a popup do Google cancelado. */
export function eCancelamentoDoUsuario(erro: unknown): boolean {
  return erro instanceof WebAuthnError && erro.code === 'ERROR_CEREMONY_ABORTED';
}

/**
 * Registra uma credencial biométrica (Face ID/Touch ID/Windows Hello) pra
 * este dispositivo, associada ao usuário já autenticado.
 */
export async function registrarBiometria(): Promise<void> {
  const iniciar = httpsCallable(getFunctionsCliente(), 'webauthnIniciarRegistro');
  const { data: options } = await iniciar();

  const credencial = await startRegistration({
    optionsJSON: options as PublicKeyCredentialCreationOptionsJSON,
  });

  const concluir = httpsCallable(getFunctionsCliente(), 'webauthnConcluirRegistro');
  await concluir({ credencial });

  marcarDispositivoComBiometria();
}

/**
 * Autentica via biometria e devolve um Firebase custom token — quem chama é
 * responsável por trocar esse token por uma sessão real
 * (`signInWithCustomToken`).
 */
export async function entrarComBiometria(): Promise<string> {
  const iniciar = httpsCallable(getFunctionsCliente(), 'webauthnIniciarLogin');
  const { data } = await iniciar();
  const { sessionId, options } = data as {
    sessionId: string;
    options: PublicKeyCredentialRequestOptionsJSON;
  };

  const credencial = await startAuthentication({ optionsJSON: options });

  const concluir = httpsCallable(getFunctionsCliente(), 'webauthnConcluirLogin');
  const { data: resultado } = await concluir({ sessionId, credencial });
  return (resultado as { token: string }).token;
}
