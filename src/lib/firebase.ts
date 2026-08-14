import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';
import { getFunctions, type Functions } from 'firebase/functions';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { getMessaging, isSupported as mensagensSuportadas, type Messaging } from 'firebase/messaging';

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
 */
export const firebaseConfigurado = Boolean(config.apiKey && config.projectId && config.appId);

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
  if (!auth) auth = getAuth(garantirApp());
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

let messaging: Messaging | null = null;

/**
 * `null` quando o navegador não suporta Push API (Safari antigo, iOS fora do
 * modo instalado, contexto não-seguro) — `getMessaging` lançaria nesses casos.
 */
export async function getMessagingCliente(): Promise<Messaging | null> {
  if (messaging) return messaging;
  if (!(await mensagensSuportadas())) return null;
  messaging = getMessaging(garantirApp());
  return messaging;
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
