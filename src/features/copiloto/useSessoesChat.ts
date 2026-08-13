import { useCallback } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { useColecao } from '@/lib/useConsulta';
import { consultaSessoesChat, excluirSessaoChat } from '@/features/dados/repositorio';
import type { SessaoChat } from '@/domain/tipos';

/** Lista reativa das sessões de chat do usuário, da mais recente para a mais antiga. */
export function useSessoesChat() {
  const { usuario } = useAuth();
  const uid = usuario?.uid ?? null;

  const consulta = useColecao<SessaoChat>(
    uid ? consultaSessoesChat(uid) : null,
    uid ? `${uid}/sessoes_chat` : null,
  );

  const excluir = useCallback(
    async (sessaoId: string) => {
      if (!uid) return;
      await excluirSessaoChat(uid, sessaoId);
    },
    [uid],
  );

  return { sessoes: consulta.dados, carregando: consulta.carregando, excluir };
}
