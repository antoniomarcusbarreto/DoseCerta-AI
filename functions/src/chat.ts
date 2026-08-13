import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret, defineString } from 'firebase-functions/params';
import { GoogleGenAI } from '@google/genai';

const geminiApiKey = defineSecret('GEMINI_API_KEY');
const geminiModel = defineString('GEMINI_MODEL', { default: 'gemini-flash-latest' });

const TAMANHO_MAXIMO_MENSAGEM = 4000;
const MAXIMO_HISTORICO = 40;
const MAXIMO_CARACTERES_TITULO = 60;
const PALAVRAS_NO_TITULO = 4;

const SYSTEM_PROMPT_BASE = `Você é o Co-piloto de Hábitos do Dose Certa-AI. Sua missão é apoiar o usuário no seu tratamento com GLP-1 cruzando a dúvida dele com os seguintes dados recentes:
[DADOS]

REGRAS INQUEBRÁVEIS DE SEGURANÇA, SIGILO E FORMATAÇÃO:
1. SOB NENHUMA HIPÓTESE aja como médico, não faça diagnósticos, não prescreva e não sugira alterar doses de medicamentos.
2. Dê apenas dicas de apoio (hidratação, bem-estar e alimentação leve) utilizando os dados do plano alimentar e refeições.
3. Se houver qualquer sintoma preocupante, interrompa o apoio e oriente a busca imediata por atendimento médico.
4. Mantenha sigilo absoluto das informações do usuário.
5. SEJA BREVE E DIRETO: O usuário está no celular. Suas respostas devem ser extremamente curtas e concisas, limitando-se a no máximo 2 parágrafos pequenos. Vá direto ao ponto.
6. PROIBIDO MARKDOWN: NÃO utilize nenhuma formatação Markdown (como ** para negrito ou * para itálico). Escreva a resposta utilizando exclusivamente texto limpo (plain text), usando apenas quebras de linha normais.`;

type PapelHistorico = 'user' | 'model';
type EntradaHistorico = { role: PapelHistorico; text: string };

function comoData(valor: unknown): Date | null {
  if (valor instanceof Timestamp) return valor.toDate();
  return null;
}

function formatarData(data: Date): string {
  return data.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

/**
 * Busca o contexto de saúde do usuário via Admin SDK, isolado por `uid` já
 * validado pelo `verifyIdToken` — nunca por um id vindo do corpo da requisição.
 */
async function buscarContextoSaude(uid: string): Promise<string> {
  const db = getFirestore();
  const refUsuario = db.collection('users').doc(uid);

  const seteDiasAtras = new Date();
  seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);
  seteDiasAtras.setHours(0, 0, 0, 0);

  const quarentaEOitoHorasAtras = new Date();
  quarentaEOitoHorasAtras.setHours(quarentaEOitoHorasAtras.getHours() - 48);

  const [aplicacoesSnap, pesoSnap, sintomasSnap, planoAlimentarSnap, refeicoesSnap] = await Promise.all([
    refUsuario.collection('aplicacoes').orderBy('dataHora', 'desc').limit(1).get(),
    refUsuario.collection('weight_history').orderBy('recordedAt', 'desc').limit(1).get(),
    refUsuario
      .collection('symptom_logs')
      .where('recordedAt', '>=', Timestamp.fromDate(seteDiasAtras))
      .orderBy('recordedAt', 'desc')
      .limit(10)
      .get(),
    refUsuario.collection('diet_plans').where('isActive', '==', true).limit(1).get(),
    refUsuario
      .collection('meals')
      .where('status', '==', 'completed')
      .where('createdAt', '>=', Timestamp.fromDate(quarentaEOitoHorasAtras))
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get(),
  ]);

  const linhas: string[] = [];

  if (aplicacoesSnap.empty) {
    linhas.push('Última aplicação: nenhuma aplicação registrada ainda.');
  } else {
    const d = aplicacoesSnap.docs[0].data();
    const dataHora = comoData(d.dataHora);
    const doseMg = Number(d.doseMg ?? 0);
    const status = d.status === 'pulada' ? 'pulada' : 'aplicada';
    linhas.push(
      `Última aplicação: ${doseMg} mg, status "${status}"${dataHora ? `, em ${formatarData(dataHora)}` : ''}.`,
    );
  }

  if (pesoSnap.empty) {
    linhas.push('Peso atual: nenhum peso registrado ainda.');
  } else {
    const d = pesoSnap.docs[0].data();
    const recordedAt = comoData(d.recordedAt);
    const weight = Number(d.weight ?? 0);
    linhas.push(
      `Peso atual: ${weight} kg${recordedAt ? `, registrado em ${formatarData(recordedAt)}` : ''}.`,
    );
  }

  if (sintomasSnap.empty) {
    linhas.push('Sintomas recentes (últimos 7 dias): nenhum sintoma relatado.');
  } else {
    const itens = sintomasSnap.docs.map((doc) => {
      const d = doc.data();
      const recordedAt = comoData(d.recordedAt);
      const symptom = String(d.symptom ?? '');
      const intensity = String(d.intensity ?? '');
      return `${symptom} (intensidade ${intensity}${recordedAt ? `, ${formatarData(recordedAt)}` : ''})`;
    });
    linhas.push(`Sintomas recentes (últimos 7 dias): ${itens.join('; ')}.`);
  }

  if (planoAlimentarSnap.empty) {
    linhas.push('Plano alimentar ativo: nenhum plano alimentar ativo cadastrado.');
  } else {
    const d = planoAlimentarSnap.docs[0].data();
    const title = String(d.title ?? '');
    const meals = Array.isArray(d.meals) ? d.meals : [];
    const refeicoesPlano = meals
      .map((m: { name?: string; time?: string; description?: string }) =>
        `${m.name ?? ''} às ${m.time ?? '?'} (${m.description ?? ''})`,
      )
      .join('; ');
    linhas.push(
      `Plano alimentar ativo: "${title}"${refeicoesPlano ? `, com as refeições planejadas: ${refeicoesPlano}` : ''}.`,
    );
  }

  if (refeicoesSnap.empty) {
    linhas.push('Refeições recentes (últimas 48 horas): nenhuma refeição registrada.');
  } else {
    const itens = refeicoesSnap.docs.map((doc) => {
      const d = doc.data();
      const createdAt = comoData(d.createdAt);
      const kcal = Number(d.macros?.kcal ?? 0);
      const nomesItens = Array.isArray(d.items)
        ? d.items.map((item: { name?: string }) => item.name).filter(Boolean).join(', ')
        : '';
      const percentual = d.consumedPercentage != null ? `${d.consumedPercentage}% consumido` : null;
      return `${nomesItens || 'refeição sem itens detalhados'} (${kcal} kcal${percentual ? `, ${percentual}` : ''}${createdAt ? `, ${formatarData(createdAt)}` : ''})`;
    });
    linhas.push(`Refeições recentes (últimas 48 horas): ${itens.join('; ')}.`);
  }

  return linhas.join('\n');
}

/** Título automático da sessão: as primeiras palavras da primeira mensagem. */
function primeirasPalavras(mensagem: string): string {
  const palavras = mensagem.trim().split(/\s+/).slice(0, PALAVRAS_NO_TITULO).join(' ');
  return palavras.length > MAXIMO_CARACTERES_TITULO
    ? `${palavras.slice(0, MAXIMO_CARACTERES_TITULO).trimEnd()}…`
    : palavras;
}

/** Lê o histórico já persistido da sessão, do mais antigo para o mais novo. */
async function carregarHistorico(
  refSessao: FirebaseFirestore.DocumentReference,
): Promise<EntradaHistorico[]> {
  const snap = await refSessao
    .collection('mensagens')
    .orderBy('createdAt', 'desc')
    .limit(MAXIMO_HISTORICO)
    .get();

  return snap.docs
    .map((doc) => {
      const d = doc.data();
      const role: PapelHistorico = d.role === 'assistant' ? 'model' : 'user';
      return { role, text: String(d.text ?? '') };
    })
    .reverse();
}

/**
 * Chat do Co-piloto de Hábitos: `onRequest` (não `onCall`) para poder fazer
 * streaming via SSE com `res.write`, com `verifyIdToken` manual — o cliente
 * chama via `fetch`, não via `httpsCallable`.
 *
 * A função é dona da persistência das mensagens (o cliente não grava mais
 * nada diretamente): ela resolve/cria a sessão, lê o histórico dela, grava a
 * pergunta, gera a resposta via Gemini e grava a resposta ao final — assim a
 * criação de sessão + título automático + primeira mensagem nunca ficam
 * dessincronizados entre abas/dispositivos.
 */
export const chatCopiloto = onRequest(
  { secrets: [geminiApiKey], region: 'southamerica-east1', cors: true },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Método não permitido.' });
      return;
    }

    const cabecalhoAuth = req.get('Authorization') ?? '';
    const token = cabecalhoAuth.startsWith('Bearer ') ? cabecalhoAuth.slice(7) : '';
    if (!token) {
      res.status(401).json({ error: 'Token de autenticação ausente.' });
      return;
    }

    let uid: string;
    try {
      const decodificado = await getAuth().verifyIdToken(token);
      uid = decodificado.uid;
    } catch (falha) {
      console.warn('[chatCopiloto] token inválido:', falha);
      res.status(401).json({ error: 'Sessão inválida. Entre novamente.' });
      return;
    }

    const { message, sessaoId } = req.body as { message?: unknown; sessaoId?: unknown };
    if (typeof message !== 'string' || message.trim().length === 0) {
      res.status(400).json({ error: 'Mensagem é obrigatória.' });
      return;
    }
    if (message.length > TAMANHO_MAXIMO_MENSAGEM) {
      res.status(400).json({ error: 'Mensagem muito longa.' });
      return;
    }

    const db = getFirestore();
    const colSessoes = db.collection('users').doc(uid).collection('sessoes_chat');
    const agora = Timestamp.now();

    let refSessao: FirebaseFirestore.DocumentReference;
    if (typeof sessaoId === 'string' && sessaoId.trim().length > 0) {
      refSessao = colSessoes.doc(sessaoId);
      const snap = await refSessao.get();
      if (!snap.exists) {
        res.status(404).json({ error: 'Conversa não encontrada.' });
        return;
      }
    } else {
      refSessao = colSessoes.doc();
      await refSessao.set({ titulo: primeirasPalavras(message), createdAt: agora, updatedAt: agora });
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();
    res.write(`data: ${JSON.stringify({ sessaoId: refSessao.id })}\n\n`);

    let historico: EntradaHistorico[];
    let contextoSaude: string;
    try {
      // Lê o histórico ANTES de gravar a mensagem nova: rodar os dois em
      // paralelo arriscaria a leitura enxergar a própria escrita e duplicar a
      // mensagem atual (uma vez vinda do histórico, outra do `message` abaixo).
      [historico, contextoSaude] = await Promise.all([carregarHistorico(refSessao), buscarContextoSaude(uid)]);
      await refSessao.collection('mensagens').add({ role: 'user', text: message, createdAt: agora });
      await refSessao.update({ updatedAt: agora });
    } catch (falha) {
      console.error('[chatCopiloto] falha ao preparar a conversa', uid, refSessao.id, falha);
      res.write(`data: ${JSON.stringify({ error: 'Não foi possível carregar seus dados. Tente novamente.' })}\n\n`);
      res.end();
      return;
    }

    const systemInstruction = SYSTEM_PROMPT_BASE.replace('[DADOS]', contextoSaude);
    const genAI = new GoogleGenAI({ apiKey: geminiApiKey.value() });

    let textoCompleto = '';
    try {
      const stream = await genAI.models.generateContentStream({
        model: geminiModel.value(),
        contents: [
          ...historico.map((entrada) => ({ role: entrada.role, parts: [{ text: entrada.text }] })),
          { role: 'user' as const, parts: [{ text: message }] },
        ],
        config: { systemInstruction },
      });

      for await (const chunk of stream) {
        const texto = chunk.text;
        if (texto) {
          textoCompleto += texto;
          res.write(`data: ${JSON.stringify({ delta: texto })}\n\n`);
        }
      }

      res.write('data: [DONE]\n\n');
    } catch (falha) {
      console.error('[chatCopiloto] falha ao gerar resposta via Gemini', uid, refSessao.id, falha);
      res.write(`data: ${JSON.stringify({ error: 'Não foi possível responder agora. Tente novamente.' })}\n\n`);
    }

    // Mesmo em falha no meio do stream, o que já foi gerado vale mais gravado
    // do que perdido.
    if (textoCompleto) {
      try {
        await refSessao.collection('mensagens').add({
          role: 'assistant',
          text: textoCompleto,
          createdAt: Timestamp.now(),
        });
        await refSessao.update({ updatedAt: Timestamp.now() });
      } catch (falha) {
        console.error('[chatCopiloto] falha ao gravar a resposta', uid, refSessao.id, falha);
      }
    }

    res.end();
  },
);
