import { randomUUID } from 'node:crypto';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { defineString } from 'firebase-functions/params';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server';
import { isoBase64URL, isoUint8Array } from '@simplewebauthn/server/helpers';

const REGIAO = 'southamerica-east1';
const RP_NAME = 'DoseCerta AI';

/**
 * Fica no apex de propósito, mesmo com o site servido em `www`: o RP ID só
 * precisa ser um sufixo registrável da origem, e mantê-lo aqui faz a passkey
 * valer nos dois hostnames e sobreviver a uma eventual troca de canônico.
 * No emulador: `WEBAUTHN_RP_ID=localhost`.
 */
const rpIdParam = defineString('WEBAUTHN_RP_ID', { default: 'dosecerta-ai.com' });

/**
 * Separado do RP ID porque os dois legitimamente divergem: o WebAuthn exige
 * correspondência EXATA de origem, e o domínio canônico tem `www` (o apex
 * responde 308 para ele). Derivar a origem do RP ID, como era feito antes,
 * gerava `https://dosecerta-ai.com` e reprovava toda cerimônia em produção.
 * No emulador: `WEBAUTHN_ORIGIN=http://localhost:5173`.
 */
const origemParam = defineString('WEBAUTHN_ORIGIN', {
  default: 'https://www.dosecerta-ai.com',
});

/** Cerimônia do navegador é síncrona — não faz sentido um TTL longo como o dos códigos por e-mail. */
const DESAFIO_TTL_MS = 60 * 1000;

const MENSAGEM_FALHA_LOGIN = 'Não foi possível entrar com biometria. Use sua senha.';

type CredencialArmazenada = {
  publicKey: string; // base64url
  counter: number;
  transports?: AuthenticatorTransportFuture[];
};

function origem(): string {
  return origemParam.value();
}

/**
 * `webauthnPasskeys/{uid}` e `webauthnCredentials/{credentialId}` ficam fora
 * de `/users/{uid}` de propósito: são coleções de topo cobertas pelo
 * `allow read, write: if false` genérico no fim de `firestore.rules` — só a
 * Cloud Function (Admin SDK) as toca, igual a `codigosAdmin`/`codigosRecuperacao`.
 */
export const webauthnIniciarRegistro = onCall({ region: REGIAO, cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'É necessário estar logado.');
  }
  const uid = request.auth.uid;
  const email = (request.auth.token.email as string | undefined) ?? uid;

  const db = getFirestore();
  const passkeysDoc = await db.collection('webauthnPasskeys').doc(uid).get();
  const credenciais = (passkeysDoc.data()?.credenciais ?? {}) as Record<string, CredencialArmazenada>;
  const excludeCredentials = Object.entries(credenciais).map(([id, dados]) => ({
    id,
    transports: dados.transports,
  }));

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: rpIdParam.value(),
    userID: isoUint8Array.fromUTF8String(uid),
    userName: email,
    attestationType: 'none',
    excludeCredentials,
    authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
  });

  await db.collection('webauthnDesafios').doc(uid).set({
    challenge: options.challenge,
    expiraEm: Timestamp.fromMillis(Date.now() + DESAFIO_TTL_MS),
    criadoEm: Timestamp.now(),
  });

  return options;
});

export const webauthnConcluirRegistro = onCall({ region: REGIAO, cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'É necessário estar logado.');
  }
  const uid = request.auth.uid;
  const { credencial } = request.data as { credencial?: RegistrationResponseJSON };
  if (!credencial) {
    throw new HttpsError('invalid-argument', 'Credencial é obrigatória.');
  }

  const db = getFirestore();
  const desafioRef = db.collection('webauthnDesafios').doc(uid);
  const desafioDoc = await desafioRef.get();
  if (!desafioDoc.exists) {
    throw new HttpsError('failed-precondition', 'Inicie o cadastro da biometria novamente.');
  }

  const { challenge, expiraEm } = desafioDoc.data() as { challenge: string; expiraEm: Timestamp };
  if (expiraEm.toMillis() < Date.now()) {
    await desafioRef.delete();
    throw new HttpsError('deadline-exceeded', 'Tempo esgotado. Inicie o cadastro novamente.');
  }

  let verificacao;
  try {
    verificacao = await verifyRegistrationResponse({
      response: credencial,
      expectedChallenge: challenge,
      expectedOrigin: origem(),
      expectedRPID: rpIdParam.value(),
    });
  } catch (falha) {
    console.error('[webauthnConcluirRegistro] falha ao verificar', uid, falha);
    throw new HttpsError('invalid-argument', 'Não foi possível validar a credencial biométrica.');
  }

  if (!verificacao.verified || !verificacao.registrationInfo) {
    throw new HttpsError('invalid-argument', 'Não foi possível validar a credencial biométrica.');
  }

  const { credential } = verificacao.registrationInfo;

  await db.runTransaction(async (tx) => {
    tx.set(
      db.collection('webauthnPasskeys').doc(uid),
      {
        credenciais: {
          [credential.id]: {
            publicKey: isoBase64URL.fromBuffer(credential.publicKey),
            counter: credential.counter,
            transports: credential.transports ?? [],
            criadoEm: Timestamp.now(),
          },
        },
      },
      { merge: true },
    );
    tx.set(db.collection('webauthnCredentials').doc(credential.id), { uid });
    tx.delete(desafioRef);
  });

  return { sucesso: true };
});

/** Fluxo usernameless/discoverable: sem `allowCredentials`, o próprio autenticador decide qual passkey oferecer. */
export const webauthnIniciarLogin = onCall({ region: REGIAO, cors: true }, async () => {
  const options = await generateAuthenticationOptions({
    rpID: rpIdParam.value(),
    userVerification: 'required',
  });

  const sessionId = randomUUID();
  await getFirestore()
    .collection('webauthnDesafios')
    .doc(sessionId)
    .set({
      challenge: options.challenge,
      expiraEm: Timestamp.fromMillis(Date.now() + DESAFIO_TTL_MS),
      criadoEm: Timestamp.now(),
    });

  return { sessionId, options };
});

export const webauthnConcluirLogin = onCall({ region: REGIAO, cors: true }, async (request) => {
  const { sessionId, credencial } = request.data as {
    sessionId?: string;
    credencial?: AuthenticationResponseJSON;
  };
  if (!sessionId || !credencial) {
    throw new HttpsError('invalid-argument', 'Dados de login incompletos.');
  }

  const db = getFirestore();
  const desafioRef = db.collection('webauthnDesafios').doc(sessionId);

  try {
    const desafioDoc = await desafioRef.get();
    if (!desafioDoc.exists) throw new HttpsError('failed-precondition', MENSAGEM_FALHA_LOGIN);

    const { challenge, expiraEm } = desafioDoc.data() as { challenge: string; expiraEm: Timestamp };
    if (expiraEm.toMillis() < Date.now()) {
      throw new HttpsError('deadline-exceeded', MENSAGEM_FALHA_LOGIN);
    }

    // Nunca revela qual etapa falhou (credencial inexistente, challenge errado,
    // assinatura inválida) — mesmo cuidado anti-oracle de `iniciarLoginAdmin`.
    const indiceDoc = await db.collection('webauthnCredentials').doc(credencial.id).get();
    if (!indiceDoc.exists) throw new HttpsError('failed-precondition', MENSAGEM_FALHA_LOGIN);
    const uid = (indiceDoc.data() as { uid: string }).uid;

    const passkeysDoc = await db.collection('webauthnPasskeys').doc(uid).get();
    const credenciais = (passkeysDoc.data()?.credenciais ?? {}) as Record<string, CredencialArmazenada>;
    const armazenada = credenciais[credencial.id];
    if (!armazenada) throw new HttpsError('failed-precondition', MENSAGEM_FALHA_LOGIN);

    const verificacao = await verifyAuthenticationResponse({
      response: credencial,
      expectedChallenge: challenge,
      expectedOrigin: origem(),
      expectedRPID: rpIdParam.value(),
      credential: {
        id: credencial.id,
        publicKey: isoBase64URL.toBuffer(armazenada.publicKey),
        counter: armazenada.counter,
        transports: armazenada.transports,
      },
    });

    if (!verificacao.verified) throw new HttpsError('failed-precondition', MENSAGEM_FALHA_LOGIN);

    await db
      .collection('webauthnPasskeys')
      .doc(uid)
      .set(
        { credenciais: { [credencial.id]: { counter: verificacao.authenticationInfo.newCounter } } },
        { merge: true },
      );

    const token = await getAuth().createCustomToken(uid);
    return { token };
  } catch (falha) {
    if (falha instanceof HttpsError) throw falha;
    console.error('[webauthnConcluirLogin] falha inesperada', falha);
    throw new HttpsError('internal', MENSAGEM_FALHA_LOGIN);
  } finally {
    await desafioRef.delete().catch(() => {});
  }
});
