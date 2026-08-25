import { httpsCallable } from 'firebase/functions';
import { getFunctionsCliente } from '@/lib/firebase';

export type DispositivoPainel = {
  id: string;
  status: string;
  plataforma: string | null;
  ultimoEnvioEm: string | null;
  ultimoRecebimentoEm: string | null;
};

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
  dispositivos: DispositivoPainel[];
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

export async function adminRessincronizarNotificacoes(): Promise<{
  totalUsuarios: number;
  atualizados: number;
}> {
  const chamar = httpsCallable<void, { totalUsuarios: number; atualizados: number }>(
    getFunctionsCliente(),
    'adminRessincronizarNotificacoes',
  );
  const resposta = await chamar();
  return resposta.data;
}

export async function adminForcarRerregistroDispositivos(
  uid: string,
): Promise<{ desativados: number }> {
  const chamar = httpsCallable<{ uid: string }, { desativados: number }>(
    getFunctionsCliente(),
    'adminForcarRerregistroDispositivos',
  );
  const resposta = await chamar({ uid });
  return resposta.data;
}

export type ResultadoEnvioTeste = {
  uid: string;
  email: string | null;
  enviados: number;
  erro?: string;
};

/**
 * Disparo direcionado — endpoint separado do broadcast global. Aceita `uids`
 * (seleção na tela de usuários) ou `email` (campo do dashboard). O retorno vem
 * por alvo, e não agregado: `enviados: 0` é o resultado que mais interessa.
 */
export async function adminEnviarPushTeste(entrada: {
  titulo: string;
  corpo: string;
  uids?: string[];
  email?: string;
}): Promise<{ resultados: ResultadoEnvioTeste[]; total: number }> {
  const chamar = httpsCallable<
    { titulo: string; corpo: string; uids?: string[]; email?: string },
    { resultados: ResultadoEnvioTeste[]; total: number }
  >(getFunctionsCliente(), 'adminEnviarPushTeste');
  const resposta = await chamar(entrada);
  return resposta.data;
}
