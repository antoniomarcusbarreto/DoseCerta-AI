import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

const REGIAO = 'southamerica-east1';

/**
 * Exclui permanentemente a conta do usuário autenticado e todos os dados
 * associados (LGPD): fotos no Storage, documento e subcoleções no Firestore,
 * e por último a credencial no Firebase Auth. Ordem importa — Auth só morre
 * depois que o resto já foi limpo, para que uma falha no meio do caminho
 * ainda deixe o usuário logado e capaz de tentar de novo.
 */
export const excluirContaUsuario = onCall({ region: REGIAO, cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'É necessário estar logado.');
  }
  const uid = request.auth.uid;

  try {
    await getStorage().bucket().deleteFiles({ prefix: `users/${uid}/` });

    await getFirestore().recursiveDelete(getFirestore().collection('users').doc(uid));

    await getAuth().deleteUser(uid);

    return { sucesso: true };
  } catch (falha) {
    if (falha instanceof HttpsError) throw falha;
    console.error('[excluirContaUsuario] falha ao excluir conta', uid, falha);
    throw new HttpsError('internal', 'Não foi possível excluir a conta. Tente novamente.');
  }
});
