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
  hidratacaoMetadeDia,
  hidratacaoRetaFinal,
  nutricaoAlertaTarde,
  nutricaoRetaFinal,
} from './notificacoes.js';
export { excluirContaUsuario } from './conta.js';
export { enviarCodigoRecuperacao, redefinirSenhaComCodigo } from './recuperacaoSenha.js';
export {
  iniciarLoginAdmin,
  verificarLoginAdmin,
  adminListarUsuarios,
  adminAlterarSenha,
  adminDefinirBloqueio,
  adminDefinirGratuidade,
  adminMetricas,
  adminEnviarBroadcast,
} from './admin.js';
export {
  webauthnIniciarRegistro,
  webauthnConcluirRegistro,
  webauthnIniciarLogin,
  webauthnConcluirLogin,
} from './webauthn.js';

const geminiApiKey = defineSecret('GEMINI_API_KEY');
const geminiModel = defineString('GEMINI_MODEL', { default: 'gemini-flash-latest' });

const TAMANHO_MAXIMO_ARQUIVO = 8 * 1024 * 1024; // 8 MB, generoso para PDF/DOCX de dieta

type RefeicaoExtraida = { name: string; time: string; description: string };
type PlanoExtraido = {
  title: string;
  meals: RefeicaoExtraida[];
  proteinGoalG: number;
  kcalGoal: number;
  waterGoalMl: number;
};

const esquemaPlanoAlimentar = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: 'Nome/título do plano alimentar' },
    proteinGoalG: {
      type: Type.NUMBER,
      description: 'Meta diária de proteína em gramas, se o documento mencionar. 0 se não houver.',
    },
    kcalGoal: {
      type: Type.NUMBER,
      description: 'Meta diária de calorias em kcal, se o documento mencionar. 0 se não houver.',
    },
    waterGoalMl: {
      type: Type.NUMBER,
      description: 'Meta diária de água em mililitros, se o documento mencionar. 0 se não houver.',
    },
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
  required: ['title', 'meals', 'proteinGoalG', 'kcalGoal', 'waterGoalMl'],
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
      'Se um horário não estiver explícito, estime um horário plausível para o tipo de refeição. ' +
      'Identifique também metas diárias explícitas de proteína (g), calorias (kcal) e água (ml), ' +
      'se o documento as mencionar (ex.: "meta de 120g de proteína por dia", "beber 2L de água"). ' +
      'Não estime nem calcule essas metas a partir das refeições — só as extraia se estiverem ' +
      'explicitamente escritas no documento. Retorne 0 para qualquer meta que não esteja explícita.';

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
        proteinGoalG: Number(extraido.proteinGoalG) || 0,
        kcalGoal: Number(extraido.kcalGoal) || 0,
        waterGoalMl: Number(extraido.waterGoalMl) || 0,
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

type RefeicaoGerada = { name: string; time: string; description: string };
type PlanoGerado = { title: string; meals: RefeicaoGerada[] };

const esquemaPlanoGerado = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: 'Nome curto e motivador para o plano' },
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

const PROTEINA_G_POR_KG_PROMPT = 1.35;
const PISO_KCAL_PROMPT = 1200;

/**
 * Gera um plano alimentar provisório (título + refeições) a partir do peso
 * atual, para quem ainda não tem plano de nutricionista. O Gemini só cuida do
 * conteúdo (cardápio); as metas numéricas do plano (proteína/kcal/água) são
 * preenchidas depois no cliente por `completarMetasPlano`
 * (`src/features/dados/repositorio.ts`), com a mesma fórmula por peso usada
 * em qualquer outro plano — mantém uma única fonte para essas contas.
 */
export const gerarPlanoAlimentarIA = onCall(
  { secrets: [geminiApiKey], region: 'southamerica-east1', cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'É necessário estar logado.');
    }

    const { weightKg } = request.data as { weightKg?: number };
    if (!Number.isFinite(weightKg) || (weightKg as number) <= 0) {
      throw new HttpsError('invalid-argument', 'weightKg deve ser um número positivo.');
    }

    const proteinaAlvo = Math.round(weightKg! * PROTEINA_G_POR_KG_PROMPT);

    const genAI = new GoogleGenAI({ apiKey: geminiApiKey.value() });
    const prompt =
      `Monte um plano alimentar de exemplo, em português, para uma pessoa de ${weightKg}kg em uso de ` +
      'medicação para emagrecimento (GLP-1). Priorize alimentos ricos em proteína magra e fibras, ' +
      `distribuídos em café da manhã, almoço, lanche e jantar, somando aproximadamente ${proteinaAlvo}g ` +
      `de proteína no dia e no mínimo ${PISO_KCAL_PROMPT} kcal no total — o foco é proteger a massa magra ` +
      'durante o tratamento, não induzir déficit calórico agressivo.';

    try {
      const resposta = await genAI.models.generateContent({
        model: geminiModel.value(),
        contents: [{ text: prompt }],
        config: { responseMimeType: 'application/json', responseSchema: esquemaPlanoGerado },
      });

      const texto = resposta.text;
      if (!texto) throw new HttpsError('internal', 'A IA não retornou conteúdo.');

      const extraido = JSON.parse(texto) as PlanoGerado;
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
      console.error('[gerarPlanoAlimentarIA] falha ao gerar plano via Gemini', falha);
      throw new HttpsError('internal', 'Não foi possível gerar o plano provisório. Tente novamente.');
    }
  },
);

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

const TIMEOUT_ANALISE_REFEICAO_MS = 15_000;

/**
 * Corre `promessa` contra um cronômetro: se `promessa` não resolver dentro de
 * `ms`, rejeita com `deadline-exceeded` em vez de deixar a chamada pendurada
 * até o timeout da própria plataforma (bem mais longo e sem mensagem clara
 * pro usuário). Não cancela a chamada ao Gemini de fato — só para de esperar
 * por ela — mas é o suficiente pra função responder rápido em vez de travar
 * o app no estado "analisando".
 */
function comTimeout<T>(promessa: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promessa,
    new Promise<never>((_, reject) => {
      setTimeout(
        () =>
          reject(
            new HttpsError('deadline-exceeded', `A análise da refeição excedeu ${Math.round(ms / 1000)}s.`),
          ),
        ms,
      );
    }),
  ]);
}

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

    const inicio = Date.now();
    try {
      const [buffer] = await getStorage().bucket().file(storagePath).download();
      const imageBase64 = buffer.toString('base64');

      const resposta = await comTimeout(
        genAI.models.generateContent({
          model: geminiModel.value(),
          contents: [{ text: prompt }, { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } }],
          config: {
            responseMimeType: 'application/json',
            responseSchema: esquemaAnaliseRefeicao,
          },
        }),
        TIMEOUT_ANALISE_REFEICAO_MS,
      );

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
      const duracaoMs = Date.now() - inicio;
      const foiTimeout = falha instanceof HttpsError && falha.code === 'deadline-exceeded';
      console.error('[analisarRefeicaoIA] falha ao analisar refeição via Gemini', {
        uid,
        storagePath,
        duracaoMs,
        timeout: foiTimeout,
        erro:
          falha instanceof Error
            ? { nome: falha.name, mensagem: falha.message, stack: falha.stack }
            : falha,
      });
      if (falha instanceof HttpsError) throw falha;
      throw new HttpsError('internal', 'Não foi possível analisar a foto. Tente novamente.');
    }
  },
);

const TAMANHO_MAXIMO_DESCRICAO = 1000;

/**
 * Analisa uma refeição descrita em texto (em vez de foto), cruzando com o
 * plano alimentar ativo do usuário (se houver). Mesmo esquema de resposta e
 * mesma lógica de timeout/log de `analisarRefeicaoIA` — só troca a entrada
 * (texto em vez de imagem) e o prompt.
 */
export const analisarDescricaoRefeicaoIA = onCall(
  { secrets: [geminiApiKey], region: 'southamerica-east1', cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'É necessário estar logado.');
    }

    const uid = request.auth.uid;
    const { descricao, dietPlanGoals } = request.data as {
      descricao?: string;
      dietPlanGoals?: { title: string; meals: { name: string; time: string; description: string }[] } | null;
    };

    if (!descricao || !descricao.trim()) {
      throw new HttpsError('invalid-argument', 'descricao é obrigatória.');
    }
    if (descricao.length > TAMANHO_MAXIMO_DESCRICAO) {
      throw new HttpsError(
        'invalid-argument',
        `Descrição muito longa. Envie até ${TAMANHO_MAXIMO_DESCRICAO} caracteres.`,
      );
    }

    const genAI = new GoogleGenAI({ apiKey: geminiApiKey.value() });
    const promptContexto = dietPlanGoals
      ? `Plano alimentar ativo do usuário: "${dietPlanGoals.title}". Refeições planejadas: ${JSON.stringify(dietPlanGoals.meals)}.`
      : 'O usuário não possui um plano alimentar ativo cadastrado.';

    const prompt =
      'O usuário descreveu em texto o que comeu. Identifique os alimentos e quantidades mencionados ' +
      '(estime a quantidade quando não for explícita), calcule os macronutrientes totais (proteína, ' +
      'carboidrato, gordura em gramas, e calorias), e escreva um feedback curto (1-2 frases, em português, ' +
      'pode usar emoji) cruzando o que foi descrito com o plano alimentar do usuário abaixo.\n\n' +
      `${promptContexto}\n\nDescrição da refeição: "${descricao.trim()}"`;

    const inicio = Date.now();
    try {
      const resposta = await comTimeout(
        genAI.models.generateContent({
          model: geminiModel.value(),
          contents: [{ text: prompt }],
          config: {
            responseMimeType: 'application/json',
            responseSchema: esquemaAnaliseRefeicao,
          },
        }),
        TIMEOUT_ANALISE_REFEICAO_MS,
      );

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
      const duracaoMs = Date.now() - inicio;
      const foiTimeout = falha instanceof HttpsError && falha.code === 'deadline-exceeded';
      console.error('[analisarDescricaoRefeicaoIA] falha ao analisar refeição via Gemini', {
        uid,
        descricao,
        duracaoMs,
        timeout: foiTimeout,
        erro:
          falha instanceof Error
            ? { nome: falha.name, mensagem: falha.message, stack: falha.stack }
            : falha,
      });
      if (falha instanceof HttpsError) throw falha;
      throw new HttpsError('internal', 'Não foi possível analisar a descrição. Tente novamente.');
    }
  },
);
