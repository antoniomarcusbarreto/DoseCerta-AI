import { useCallback, useRef, useState } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { useColecao } from '@/lib/useConsulta';
import { consultaMensagensSessao } from '@/features/dados/repositorio';
import type { MensagemCopiloto } from '@/domain/tipos';

const URL_CHAT_COPILOTO = import.meta.env.VITE_CHAT_COPILOTO_URL;
const MENSAGEM_ERRO_PADRAO = 'Não foi possível enviar sua mensagem agora. Tente novamente.';
const MENSAGEM_SESSAO_APAGADA = 'Esta conversa não existe mais.';

/**
 * Orquestra uma sessão de chat com o Co-piloto. Quem grava as mensagens no
 * Firestore agora é a Cloud Function (não este hook) — ela lê/cria a sessão,
 * grava a pergunta e a resposta, e devolve tudo via streaming SSE. Por isso
 * `mensagemPendente` existe: sem ela, a própria mensagem do usuário só
 * apareceria depois do round-trip inteiro até o servidor.
 *
 * `sessaoAtivaId === null` é "conversa nova, ainda sem sessão criada" — ao
 * enviar a primeira mensagem, o servidor cria a sessão e devolve o id pelo
 * evento inicial do SSE, e `onSessaoCriada` avisa quem chamou o hook.
 */
export function useChatCopiloto(sessaoAtivaId: string | null, onSessaoCriada: (id: string) => void) {
  const { usuario } = useAuth();
  const uid = usuario?.uid ?? null;

  const consulta = useColecao<MensagemCopiloto>(
    uid && sessaoAtivaId ? consultaMensagensSessao(uid, sessaoAtivaId) : null,
    uid && sessaoAtivaId ? `${uid}/sessoes_chat/${sessaoAtivaId}/mensagens` : null,
  );

  const [mensagemPendente, setMensagemPendente] = useState('');
  const [respostaEmAndamento, setRespostaEmAndamento] = useState('');

  /*
   * O backend grava a pergunta no Firestore bem antes de terminar de gerar a
   * resposta (e a resposta, só ao fechar o stream) — então por um tempo a
   * mensagem "real" (vinda do onSnapshot) e o eco local coexistem e
   * duplicam na tela. Assim que a última mensagem persistida bate com o eco
   * local, o eco para de ser exibido.
   */
  const ultimaMensagem = consulta.dados[consulta.dados.length - 1];
  const mensagemPendenteExibida =
    ultimaMensagem?.role === 'user' && ultimaMensagem.text === mensagemPendente ? '' : mensagemPendente;
  const respostaEmAndamentoExibida =
    ultimaMensagem?.role === 'assistant' && ultimaMensagem.text === respostaEmAndamento
      ? ''
      : respostaEmAndamento;
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const cancelarRef = useRef<AbortController | null>(null);

  const enviar = useCallback(
    async (texto: string) => {
      const mensagem = texto.trim();
      if (!mensagem || !usuario || !uid || enviando) return;

      if (!URL_CHAT_COPILOTO) {
        setErro('Chat indisponível: configuração do servidor ausente.');
        return;
      }

      setErro(null);
      setEnviando(true);
      setMensagemPendente(mensagem);
      setRespostaEmAndamento('');

      const controlador = new AbortController();
      cancelarRef.current = controlador;

      try {
        const token = await usuario.getIdToken();
        const resposta = await fetch(URL_CHAT_COPILOTO, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ message: mensagem, sessaoId: sessaoAtivaId }),
          signal: controlador.signal,
        });

        if (resposta.status === 404) {
          setErro(MENSAGEM_SESSAO_APAGADA);
          return;
        }
        if (!resposta.ok || !resposta.body) {
          throw new Error(`status ${resposta.status}`);
        }

        const leitor = resposta.body.getReader();
        const decodificador = new TextDecoder();
        let bufer = '';
        let textoCompleto = '';
        let erroDoStream: string | null = null;

        for (;;) {
          const { done, value } = await leitor.read();
          if (done) break;

          bufer += decodificador.decode(value, { stream: true });
          const linhas = bufer.split('\n\n');
          bufer = linhas.pop() ?? '';

          for (const linha of linhas) {
            const conteudo = linha.startsWith('data: ') ? linha.slice(6) : '';
            if (!conteudo || conteudo === '[DONE]') continue;

            try {
              const evento = JSON.parse(conteudo) as { sessaoId?: string; delta?: string; error?: string };
              if (evento.sessaoId && !sessaoAtivaId) onSessaoCriada(evento.sessaoId);
              if (evento.error) erroDoStream = evento.error;
              if (evento.delta) {
                textoCompleto += evento.delta;
                setRespostaEmAndamento(textoCompleto);
              }
            } catch {
              // Fragmento incompleto de um chunk anterior — ignora.
            }
          }
        }

        if (erroDoStream) throw new Error(erroDoStream);
      } catch (falha) {
        if ((falha as Error)?.name === 'AbortError') return;
        console.error('[DoseCerta] falha no chat do Co-piloto:', falha);
        setErro(MENSAGEM_ERRO_PADRAO);
      } finally {
        setMensagemPendente('');
        setRespostaEmAndamento('');
        setEnviando(false);
        cancelarRef.current = null;
      }
    },
    [usuario, uid, sessaoAtivaId, enviando, onSessaoCriada],
  );

  return {
    mensagens: consulta.dados,
    carregando: consulta.carregando,
    mensagemPendente: mensagemPendenteExibida,
    respostaEmAndamento: respostaEmAndamentoExibida,
    enviando,
    erro,
    enviar,
  };
}
