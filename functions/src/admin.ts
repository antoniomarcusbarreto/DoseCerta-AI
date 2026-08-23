import { createHash, randomInt } from 'node:crypto';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { enviarParaUsuario } from './notificacoes.js';

const REGIAO = 'southamerica-east1';
const REMETENTE = 'Dose Certa-AI <suporte@notificacoes.codehatch.com.br>';
const RESPONDER_PARA = 'suporte@codehatch.com.br';

/** Único e-mail autorizado a entrar no painel. Nunca vira e-mail de conta Auth. */
const ADMIN_EMAIL = 'antoniomarcuscb@hotmail.com';
/** UID sintético fixo do admin no Firebase Auth — sem e-mail, sem doc em `users/`. */
const ADMIN_UID = 'admin-painel';

const ADMIN_OTP_COOLDOWN_MS = 60 * 1000;
// Fácil de reduzir para testes, ex.: 25_000 (25s).
const ADMIN_OTP_TTL_MS = 2 * 60 * 1000;
const ADMIN_OTP_TTL_MINUTOS = ADMIN_OTP_TTL_MS / 60_000;
const ADMIN_OTP_MAX_TENTATIVAS = 5;

const resendApiKey = defineSecret('RESEND_API_KEY');

function hashCodigo(codigo: string): string {
  return createHash('sha256').update(codigo).digest('hex');
}

function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}

function montarEmailHtml(codigo: string): string {
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Código de acesso ao painel</title>
    <style>
      @media (max-width: 600px) {
        .container { width: 100% !important; }
        .codigo { font-size: 28px !important; letter-spacing: 6px !important; padding: 16px 20px !important; }
      }
    </style>
  </head>
  <body style="margin:0; padding:0; background-color:#eef1f4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#eef1f4; padding: 32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" style="width:600px; max-width:100%; background-color:#ffffff; border-radius:16px; overflow:hidden; box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08);">
            <tr>
              <td style="background-color:#3b4c5e; padding: 28px 32px;">
                <span style="font-size:22px; font-weight:800; color:#ffffff;">Dose Certa<span style="color:#2dd4bf;">-AI</span></span>
              </td>
            </tr>
            <tr>
              <td style="padding: 32px;">
                <p style="margin:0 0 8px; font-size:16px; color:#1e293b;">Olá,</p>
                <p style="margin:0 0 24px; font-size:15px; line-height:1.6; color:#475569;">
                  Foi solicitado acesso ao painel administrativo. Use o código abaixo para continuar:
                </p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="center">
                      <div class="codigo" style="display:inline-block; background-color:#e6f7f5; border:2px solid #0d9488; border-radius:14px; padding:20px 32px; font-family: 'Courier New', Courier, monospace; font-size:36px; font-weight:700; letter-spacing:10px; color:#0f766e;">
                        ${codigo}
                      </div>
                    </td>
                  </tr>
                </table>
                <p style="margin:24px 0 0; text-align:center; font-size:13px; color:#94a3b8;">
                  ⏱️ Este código expira em ${ADMIN_OTP_TTL_MINUTOS} minuto(s).
                </p>
                <p style="margin:24px 0 0; font-size:14px; line-height:1.6; color:#475569;">
                  Se você não solicitou este acesso, ignore este e-mail.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding: 20px 32px; background-color:#f8fafc; border-top:1px solid #e2e8f0;">
                <p style="margin:0; font-size:12px; color:#94a3b8;">
                  Precisa de ajuda? Responda este e-mail ou fale com a gente em
                  <a href="mailto:${RESPONDER_PARA}" style="color:#0d9488; text-decoration:none;">${RESPONDER_PARA}</a>.
                </p>
                <p style="margin:8px 0 0; font-size:12px; color:#cbd5e1;">Equipe Dose Certa-AI</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function montarEmailTexto(codigo: string): string {
  return [
    'Olá,',
    '',
    'Foi solicitado acesso ao painel administrativo do Dose Certa-AI.',
    `Código: ${codigo}`,
    '',
    `Este código expira em ${ADMIN_OTP_TTL_MINUTOS} minuto(s).`,
    'Se você não solicitou este acesso, ignore este e-mail.',
  ].join('\n');
}

async function enviarEmailComCodigo(codigo: string): Promise<void> {
  const resposta = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey.value()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: REMETENTE,
      to: ADMIN_EMAIL,
      reply_to: RESPONDER_PARA,
      subject: 'Código de acesso ao painel - Dose Certa-AI',
      html: montarEmailHtml(codigo),
      text: montarEmailTexto(codigo),
    }),
  });

  if (!resposta.ok) {
    const corpo = await resposta.text();
    console.error('[iniciarLoginAdmin] falha ao enviar via Resend', resposta.status, corpo);
    throw new HttpsError('internal', 'Não foi possível enviar o e-mail. Tente novamente.');
  }
}

/**
 * Sempre responde com sucesso, envie ou não o código — tentar e-mails
 * aleatórios em /painel não pode revelar qual é o e-mail do admin.
 */
export const iniciarLoginAdmin = onCall(
  { region: REGIAO, cors: true, secrets: [resendApiKey] },
  async (request) => {
    const { email } = request.data as { email?: string };
    if (!email) {
      throw new HttpsError('invalid-argument', 'E-mail é obrigatório.');
    }

    if (normalizarEmail(email) !== ADMIN_EMAIL) {
      // Log só nosso, nunca chega ao client — mantém o anti-oracle na resposta.
      console.log('[iniciarLoginAdmin] e-mail informado não é o admin, ignorando.');
      return { sucesso: true };
    }

    const db = getFirestore();
    const ref = db.collection('codigosAdmin').doc('painel');

    const existente = await ref.get();
    if (existente.exists) {
      const criadoEm = (existente.data()?.criadoEm as Timestamp | undefined)?.toMillis() ?? 0;
      const restanteMs = ADMIN_OTP_COOLDOWN_MS - (Date.now() - criadoEm);
      if (restanteMs > 0) {
        console.log(`[iniciarLoginAdmin] em cooldown, ignorando envio. Faltam ${restanteMs}ms.`);
        return { sucesso: true };
      }
    }

    const codigo = randomInt(100000, 1000000).toString();

    try {
      await enviarEmailComCodigo(codigo);
    } catch (falha) {
      console.error('[iniciarLoginAdmin] falha inesperada ao enviar código', falha);
      return { sucesso: true };
    }

    await ref.set({
      hash: hashCodigo(codigo),
      expiraEm: Timestamp.fromMillis(Date.now() + ADMIN_OTP_TTL_MS),
      tentativas: 0,
      criadoEm: Timestamp.now(),
    });

    console.log('[iniciarLoginAdmin] código enviado com sucesso via Resend.');
    return { sucesso: true };
  },
);

/** Garante o Auth user sintético do admin e devolve seu uid. */
async function garantirUsuarioAdmin(): Promise<string> {
  try {
    await getAuth().getUser(ADMIN_UID);
  } catch {
    await getAuth().createUser({ uid: ADMIN_UID });
  }
  await getAuth().setCustomUserClaims(ADMIN_UID, { admin: true });
  return ADMIN_UID;
}

export const verificarLoginAdmin = onCall({ region: REGIAO, cors: true }, async (request) => {
  const { codigo } = request.data as { codigo?: string };
  if (!codigo) {
    throw new HttpsError('invalid-argument', 'Código é obrigatório.');
  }

  const db = getFirestore();
  const ref = db.collection('codigosAdmin').doc('painel');
  const doc = await ref.get();

  if (!doc.exists) {
    throw new HttpsError('failed-precondition', 'Solicite um novo código.');
  }

  const dados = doc.data() as { hash: string; expiraEm: Timestamp; tentativas: number };

  if (dados.expiraEm.toMillis() < Date.now()) {
    await ref.delete();
    throw new HttpsError('deadline-exceeded', 'Código expirado. Solicite um novo.');
  }

  if (dados.tentativas >= ADMIN_OTP_MAX_TENTATIVAS) {
    await ref.delete();
    throw new HttpsError('resource-exhausted', 'Muitas tentativas. Solicite um novo código.');
  }

  if (hashCodigo(codigo) !== dados.hash) {
    await ref.update({ tentativas: dados.tentativas + 1 });
    throw new HttpsError('invalid-argument', 'Código incorreto.');
  }

  const uid = await garantirUsuarioAdmin();
  const token = await getAuth().createCustomToken(uid, { admin: true });

  await ref.delete();

  return { token };
});

/** Guard compartilhado por toda callable do painel — exige o custom claim `admin`. */
function exigirAdmin(request: CallableRequest): void {
  if (request.auth?.token?.admin !== true) {
    throw new HttpsError('permission-denied', 'Acesso restrito ao painel administrativo.');
  }
}

type UsuarioPainel = {
  uid: string;
  email: string | null;
  displayName: string | null;
  disabled: boolean;
  criadoEm: string;
  freeTrialEndsAt: string | null;
  /*
   * Estado das notificações por usuário. Sem isto, "fulano não recebe
   * lembretes" só era investigável pedindo que a própria pessoa rodasse o
   * diagnóstico no aparelho dela — e um usuário sem token nenhum é
   * silenciosamente ignorado pelas rotinas, que iteram apenas quem tem token.
   * `tokens: 0` é o suficiente para explicar o sintoma inteiro.
   */
  tokens: number;
  ultimoPushEnviadoEm: string | null;
  ultimoPushRecebidoEm: string | null;
};

export const adminListarUsuarios = onCall({ region: REGIAO, cors: true }, async (request) => {
  exigirAdmin(request);

  const auth = getAuth();
  const usuariosAuth: import('firebase-admin/auth').UserRecord[] = [];
  let proximaPagina: string | undefined;
  do {
    const pagina = await auth.listUsers(1000, proximaPagina);
    usuariosAuth.push(...pagina.users);
    proximaPagina = pagina.pageToken;
  } while (proximaPagina);

  const db = getFirestore();
  const perfisSnap = await db.collection('users').get();
  const perfisPorUid = new Map(perfisSnap.docs.map((doc) => [doc.id, doc.data()]));

  const usuarios: UsuarioPainel[] = usuariosAuth
    .filter((usuario) => usuario.uid !== ADMIN_UID)
    .map((usuario) => {
      const perfil = perfisPorUid.get(usuario.uid);
      const freeTrialEndsAt = perfil?.freeTrialEndsAt as Timestamp | undefined;
      const tokens = perfil?.fcmTokens;
      const enviadoEm = perfil?.ultimoPushEnviadoEm;
      const recebidoEm = perfil?.ultimoPushRecebidoEm;
      return {
        uid: usuario.uid,
        email: usuario.email ?? null,
        displayName: usuario.displayName ?? (perfil?.name as string | undefined) ?? null,
        disabled: usuario.disabled,
        criadoEm: usuario.metadata.creationTime,
        freeTrialEndsAt: freeTrialEndsAt ? freeTrialEndsAt.toDate().toISOString() : null,
        tokens: Array.isArray(tokens) ? tokens.length : 0,
        ultimoPushEnviadoEm:
          enviadoEm instanceof Timestamp ? enviadoEm.toDate().toISOString() : null,
        ultimoPushRecebidoEm:
          recebidoEm instanceof Timestamp ? recebidoEm.toDate().toISOString() : null,
      };
    });

  return { usuarios };
});

export const adminAlterarSenha = onCall({ region: REGIAO, cors: true }, async (request) => {
  exigirAdmin(request);

  const { uid, novaSenha } = request.data as { uid?: string; novaSenha?: string };
  if (!uid || !novaSenha) {
    throw new HttpsError('invalid-argument', 'uid e novaSenha são obrigatórios.');
  }
  if (novaSenha.length < 6) {
    throw new HttpsError('invalid-argument', 'A nova senha precisa de pelo menos 6 caracteres.');
  }

  try {
    await getAuth().updateUser(uid, { password: novaSenha });
  } catch (falha) {
    console.error('[adminAlterarSenha] falha ao atualizar senha', uid, falha);
    throw new HttpsError('internal', 'Não foi possível alterar a senha. Tente novamente.');
  }

  return { sucesso: true };
});

export const adminDefinirBloqueio = onCall({ region: REGIAO, cors: true }, async (request) => {
  exigirAdmin(request);

  const { uid, bloqueado } = request.data as { uid?: string; bloqueado?: boolean };
  if (!uid || typeof bloqueado !== 'boolean') {
    throw new HttpsError('invalid-argument', 'uid e bloqueado são obrigatórios.');
  }

  try {
    await getAuth().updateUser(uid, { disabled: bloqueado });
    if (bloqueado) {
      await getAuth().revokeRefreshTokens(uid);
    }
  } catch (falha) {
    console.error('[adminDefinirBloqueio] falha ao atualizar usuário', uid, falha);
    throw new HttpsError('internal', 'Não foi possível atualizar o usuário. Tente novamente.');
  }

  /*
   * Espelha o `disabled` do Auth num doc do Firestore que o próprio cliente
   * consegue assinar em tempo real (o Auth não expõe esse estado via
   * listener). As regras do Firestore bloqueiam escrita do cliente nesse
   * doc — só o Admin SDK, aqui, pode escrevê-lo.
   */
  try {
    await getFirestore()
      .collection('users')
      .doc(uid)
      .collection('estado')
      .doc('conta')
      .set({ bloqueado, atualizadoEm: Timestamp.now() }, { merge: true });
  } catch (falha) {
    console.error('[adminDefinirBloqueio] falha ao espelhar estado no Firestore', uid, falha);
    throw new HttpsError('internal', 'Usuário atualizado no Auth, mas falhou ao sincronizar o Firestore.');
  }

  return { sucesso: true };
});

export const adminDefinirGratuidade = onCall({ region: REGIAO, cors: true }, async (request) => {
  exigirAdmin(request);

  const { uid, freeTrialEndsAt } = request.data as { uid?: string; freeTrialEndsAt?: number };
  if (!uid || !Number.isFinite(freeTrialEndsAt)) {
    throw new HttpsError('invalid-argument', 'uid e freeTrialEndsAt (timestamp em ms) são obrigatórios.');
  }

  await getFirestore()
    .collection('users')
    .doc(uid)
    .set({ freeTrialEndsAt: Timestamp.fromMillis(freeTrialEndsAt as number) }, { merge: true });

  return { sucesso: true };
});

export const adminMetricas = onCall({ region: REGIAO, cors: true }, async (request) => {
  exigirAdmin(request);

  const auth = getAuth();
  let total = 0;
  let proximaPagina: string | undefined;
  do {
    const pagina = await auth.listUsers(1000, proximaPagina);
    total += pagina.users.filter((usuario) => usuario.uid !== ADMIN_UID).length;
    proximaPagina = pagina.pageToken;
  } while (proximaPagina);

  // Sem gateway de pagamento integrado ainda — layout já preparado no painel.
  return { totalUsuarios: total, totalAssinantes: 0 };
});

export const adminEnviarBroadcast = onCall({ region: REGIAO, cors: true }, async (request) => {
  exigirAdmin(request);

  const { titulo, corpo } = request.data as { titulo?: string; corpo?: string };
  if (!titulo || !corpo) {
    throw new HttpsError('invalid-argument', 'titulo e corpo são obrigatórios.');
  }

  const db = getFirestore();
  const usuarios = await db.collection('users').where('fcmTokens', '!=', []).get();

  let enviados = 0;
  for (const usuario of usuarios.docs) {
    enviados += await enviarParaUsuario(usuario.id, titulo, corpo);
  }

  return { enviados, totalUsuarios: usuarios.size };
});
