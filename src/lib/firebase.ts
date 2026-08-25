import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  initializeAuth,
  browserLocalPersistence,
  indexedDBLocalPersistence,
  browserPopupRedirectResolver,
  GoogleAuthProvider,
  type Auth,
} from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';
import { getFunctions, type Functions } from 'firebase/functions';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

/**
 * O app precisa subir mesmo sem credenciais — é o que permite abrir o
 * /kitchen-sink e revisar o visual antes de existir um projeto Firebase.
 *
 * `authDomain` entra na checagem porque, sem ele, `signInWithRedirect` falha
 * de um jeito silencioso: a navegação para o Google acontece, mas o retorno
 * não sabe para onde voltar — sintoma idêntico a "perde a sessão depois do
 * redirect", só que causado por env var faltando em produção (ex.: esquecida
 * na Vercel), não por bug de código.
 */
export const firebaseConfigurado = Boolean(
  config.apiKey && config.authDomain && config.projectId && config.appId,
);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let functions: Functions | null = null;
let storage: FirebaseStorage | null = null;

function garantirApp(): FirebaseApp {
  if (!firebaseConfigurado) {
    throw new Error(
      'Firebase não configurado. Copie .env.example para .env.local e preencha as chaves VITE_FIREBASE_*.',
    );
  }
  if (!app) app = initializeApp(config);
  return app;
}

export function getAuthCliente(): Auth {
  if (!auth) {
    // Persistência explícita — sem isto o app fica dependendo do default
    // implícito do SDK pra não deslogar o usuário ao fechar o PWA.
    // IndexedDB primeiro (mais robusto em PWA instalado), com localStorage
    // como fallback pra navegadores/contextos sem IndexedDB.
    auth = initializeAuth(garantirApp(), {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence],
      popupRedirectResolver: browserPopupRedirectResolver,
    });
  }
  return auth;
}

export function getDb(): Firestore {
  if (!db) {
    // Persistência local é o que faz registrar aplicação funcionar sem rede —
    // o caso de uso mais crítico do app.
    db = initializeFirestore(garantirApp(), {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  }
  return db;
}

export function getFunctionsCliente(): Functions {
  // Mesma região declarada em functions/src/index.ts (onCall).
  if (!functions) functions = getFunctions(garantirApp(), 'southamerica-east1');
  return functions;
}

export function getStorageCliente(): FirebaseStorage {
  if (!storage) storage = getStorage(garantirApp());
  return storage;
}

let googleProvider: GoogleAuthProvider | null = null;

export function getGoogleProvider(): GoogleAuthProvider {
  if (!googleProvider) {
    googleProvider = new GoogleAuthProvider();
    // Sempre mostra a tela de escolha de conta, em vez de logar direto na
    // última conta Google usada no dispositivo.
    googleProvider.setCustomParameters({ prompt: 'select_account' });
  }
  return googleProvider;
}
