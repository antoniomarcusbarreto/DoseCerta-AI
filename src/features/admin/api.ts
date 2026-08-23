import { httpsCallable } from 'firebase/functions';
import { getFunctionsCliente } from '@/lib/firebase';

export type UsuarioPainel = {
  uid: string;
  email: string | null;
  displayName: string | null;
  disabled: boolean;
  criadoEm: string;
  freeTrialEndsAt: string | null;
  tokens: number;
  ultimoPushEnviadoEm: string | null;
  ultimoPushRecebidoEm: string | null;
};

export async function iniciarLoginAdmin(email: string): Promise<void> {
  const chamar = httpsCallable(getFunctionsCliente(), 'iniciarLoginAdmin');
  await chamar({ email });
}

export async function verificarLoginAdmin(codigo: string): Promise<string> {
  const chamar = httpsCallable<{ codigo: string }, { token: string }>(
    getFunctionsCliente(),
    'verificarLoginAdmin',
  );
  const resposta = await chamar({ codigo });
  return resposta.data.token;
}

export async function adminListarUsuarios(): Promise<UsuarioPainel[]> {
  const chamar = httpsCallable<void, { usuarios: UsuarioPainel[] }>(
    getFunctionsCliente(),
    'adminListarUsuarios',
  );
  const resposta = await chamar();
  return resposta.data.usuarios;
}

export async function adminAlterarSenha(uid: string, novaSenha: string): Promise<void> {
  const chamar = httpsCallable(getFunctionsCliente(), 'adminAlterarSenha');
  await chamar({ uid, novaSenha });
}

export async function adminDefinirBloqueio(uid: string, bloqueado: boolean): Promise<void> {
  const chamar = httpsCallable(getFunctionsCliente(), 'adminDefinirBloqueio');
  await chamar({ uid, bloqueado });
}

export async function adminDefinirGratuidade(uid: string, freeTrialEndsAt: number): Promise<void> {
  const chamar = httpsCallable(getFunctionsCliente(), 'adminDefinirGratuidade');
  await chamar({ uid, freeTrialEndsAt });
}

export async function adminMetricas(): Promise<{ totalUsuarios: number; totalAssinantes: number }> {
  const chamar = httpsCallable<void, { totalUsuarios: number; totalAssinantes: number }>(
    getFunctionsCliente(),
    'adminMetricas',
  );
  const resposta = await chamar();
  return resposta.data;
}

export async function adminEnviarBroadcast(
  titulo: string,
  corpo: string,
): Promise<{ enviados: number; totalUsuarios: number }> {
  const chamar = httpsCallable<
    { titulo: string; corpo: string },
    { enviados: number; totalUsuarios: number }
  >(getFunctionsCliente(), 'adminEnviarBroadcast');
  const resposta = await chamar({ titulo, corpo });
  return resposta.data;
}
