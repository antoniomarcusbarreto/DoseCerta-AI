import { initializeApp } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { defineSecret, defineString } from 'firebase-functions/params';
import { GoogleGenAI, Type } from '@google/genai';
import mammoth from 'mammoth';

initializeApp();

export { chatCopiloto } from './chat.js';
export {
  testarNotificacao,
  lembreteAplicacao,
  acompanhamentoSintoma,
  engajamentoRotina,
} from './notificacoes.js';
export { excluirContaUsuario } from './conta.js';
export { enviarCodigoRecuperacao, redefinirSenhaComCodigo } from './recuperacaoSenha.js';

const geminiApiKey = defineSecret('GEMINI_API_KEY');
const geminiModel = defineString('GEMINI_MODEL', { default: 'gemini-flash-latest' });

const TAMANHO_MAXIMO_ARQUIVO = 8 * 1024 * 1024; // 8 MB, generoso para PDF/DOCX de dieta

type RefeicaoExtraida = { name: string; time: string; description: string };
type PlanoExtraido = { title: string; meals: RefeicaoExtraida[] };

const esquemaPlanoAlimentar = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: 'Nome/título do plano alimentar' },
    meals: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: 'Nome da refeição, ex: "Café da manhã"' },
          time: { type: Type.STRING, description: 'Horário no formato HH:MM (24h)' },
          description: { type: Type.STRING, description: 'Itens/alimentos da refeição' },
        },
        required: ['name', 'time', 'description'],
      },
    },
  },
  required: ['title', 'meals'],
};

/**
 * Extrai um plano alimentar estruturado a partir de um PDF ou DOCX, usando o
 * Gemini. A chave da API fica só aqui no servidor (Secret Manager) — nunca no
 * bundle do frontend.
 */
export const importarDietaIA = onCall(
  { secrets: [geminiApiKey], region: 'southamerica-east1', cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'É necessário estar logado.');
    }

    const { fileBase64, mimeType, fileName } = request.data as {
      fileBase64?: string;
      mimeType?: string;
      fileName?: string;
    };

    if (!fileBase64 || !mimeType) {
      throw new HttpsError('invalid-argument', 'Arquivo (fileBase64) e mimeType são obrigatórios.');
    }
    if (fileBase64.length > TAMANHO_MAXIMO_ARQUIVO * 1.4) {
      throw new HttpsError('invalid-argument', 'Arquivo muito grande. Envie um PDF/DOCX de até 8 MB.');
    }

    const ehPdf = mimeType === 'application/pdf';
    const ehDocx =
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (!ehPdf && !ehDocx) {
      throw new HttpsError('invalid-argument', 'Envie um arquivo .pdf ou .docx.');
    }

    const genAI = new GoogleGenAI({ apiKey: geminiApiKey.value() });
    const prompt =
      'Extraia o plano alimentar deste documento. Identifique um título curto para o plano ' +
      'e cada refeição (nome, horário no formato HH:MM e a descrição dos alimentos). ' +
      'Se um horário não estiver explícito, estime um horário plausível para o tipo de refeição.';

    try {
      const resposta = await genAI.models.generateContent({
        model: geminiModel.value(),
        contents: ehPdf
          ? [{ text: prompt }, { inlineData: { mimeType, data: fileBase64 } }]
          : [{ text: `${prompt}\n\nConteúdo do documento:\n${await extrairTextoDocx(fileBase64)}` }],
        config: {
          responseMimeType: 'application/json',
          responseSchema: esquemaPlanoAlimentar,
        },
      });

      const texto = resposta.text;
      if (!texto) {
        throw new HttpsError('internal', 'A IA não retornou conteúdo.');
      }

      const extraido = JSON.parse(texto) as PlanoExtraido;
      if (!extraido.title || !Array.isArray(extraido.meals)) {
        throw new HttpsError('internal', 'Resposta da IA em formato inesperado.');
      }

      return {
        title: extraido.title,
        meals: extraido.meals.map((refeicao) => ({
          id: crypto.randomUUID(),
          name: refeicao.name,
          time: refeicao.time,
          description: refeicao.description,
        })),
      };
    } catch (falha) {
      if (falha instanceof HttpsError) throw falha;
      console.error('[importarDietaIA] falha ao extrair dieta via Gemini', fileName, falha);
      throw new HttpsError('internal', 'Não foi possível analisar o arquivo. Tente novamente.');
    }
  },
);

async function extrairTextoDocx(base64: string): Promise<string> {
  const buffer = Buffer.from(base64, 'base64');
  const { value } = await mammoth.extractRawText({ buffer });
  return value;
}

type ItemRefeicaoExtraido = { name: string; quantity: string };
type MacrosExtraidos = { protein: number; carbs: number; fat: number; kcal: number };
type AnaliseRefeicaoExtraida = {
  items: ItemRefeicaoExtraido[];
  macros: MacrosExtraidos;
  aiFeedback: string;
};

const esquemaAnaliseRefeicao = {
  type: Type.OBJECT,
  properties: {
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: 'Nome do alimento identificado no prato' },
          quantity: { type: Type.STRING, description: 'Quantidade estimada, ex: "150g"' },
        },
        required: ['name', 'quantity'],
      },
    },
    macros: {
      type: Type.OBJECT,
      properties: {
        protein: { type: Type.NUMBER, description: 'Proteínas em gramas' },
        carbs: { type: Type.NUMBER, description: 'Carboidratos em gramas' },
        fat: { type: Type.NUMBER, description: 'Gorduras em gramas' },
        kcal: { type: Type.NUMBER, description: 'Calorias totais' },
      },
      required: ['protein', 'carbs', 'fat', 'kcal'],
    },
    aiFeedback: {
      type: Type.STRING,
      description: 'Feedback curto cruzando a refeição identificada com o plano alimentar do usuário',
    },
  },
  required: ['items', 'macros', 'aiFeedback'],
};

/**
 * Analisa a foto de um prato de comida via Gemini Vision, cruzando com o
 * plano alimentar ativo do usuário (se houver). A imagem já está no Storage
 * (upload feito pelo cliente antes de chamar esta função) — lida aqui via
 * Admin SDK, em vez de Base64 na requisição, para não esbarrar no limite de
 * payload de callables com fotos de câmera.
 */
export const analisarRefeicaoIA = onCall(
  { secrets: [geminiApiKey], region: 'southamerica-east1', cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'É necessário estar logado.');
    }

    const uid = request.auth.uid;
    const { storagePath, dietPlanGoals } = request.data as {
      storagePath?: string;
      dietPlanGoals?: { title: string; meals: { name: string; time: string; description: string }[] } | null;
    };

    if (!storagePath) {
      throw new HttpsError('invalid-argument', 'storagePath é obrigatório.');
    }
    if (!storagePath.startsWith(`users/${uid}/meals/`)) {
      throw new HttpsError('permission-denied', 'Caminho de imagem inválido.');
    }

    const genAI = new GoogleGenAI({ apiKey: geminiApiKey.value() });
    const promptContexto = dietPlanGoals
      ? `Plano alimentar ativo do usuário: "${dietPlanGoals.title}". Refeições planejadas: ${JSON.stringify(dietPlanGoals.meals)}.`
      : 'O usuário não possui um plano alimentar ativo cadastrado.';

    const prompt =
      'Analise a foto deste prato de comida. Identifique os alimentos e suas quantidades estimadas, ' +
      'calcule os macronutrientes totais (proteína, carboidrato, gordura em gramas, e calorias), e escreva ' +
      'um feedback curto (1-2 frases, em português, pode usar emoji) cruzando o que foi identificado com o ' +
      `plano alimentar do usuário abaixo.\n\n${promptContexto}`;

    try {
      const [buffer] = await getStorage().bucket().file(storagePath).download();
      const imageBase64 = buffer.toString('base64');

      const resposta = await genAI.models.generateContent({
        model: geminiModel.value(),
        contents: [{ text: prompt }, { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } }],
        config: {
          responseMimeType: 'application/json',
          responseSchema: esquemaAnaliseRefeicao,
        },
      });

      const texto = resposta.text;
      if (!texto) {
        throw new HttpsError('internal', 'A IA não retornou conteúdo.');
      }

      const extraido = JSON.parse(texto) as AnaliseRefeicaoExtraida;
      if (!Array.isArray(extraido.items) || !extraido.macros || !extraido.aiFeedback) {
        throw new HttpsError('internal', 'Resposta da IA em formato inesperado.');
      }

      return extraido;
    } catch (falha) {
      if (falha instanceof HttpsError) throw falha;
      console.error('[analisarRefeicaoIA] falha ao analisar refeição via Gemini', storagePath, falha);
      throw new HttpsError('internal', 'Não foi possível analisar a foto. Tente novamente.');
    }
  },
);
