/* eslint-disable */
// Service Worker dedicado ao FCM. Fica separado de /sw.js (que só cuida de
// cache/offline das rotas do próprio app) porque o FCM exige um SW registrado
// na raiz com esse nome exato, escutando push em segundo plano.
//
// Não dá para ler `import.meta.env` aqui — este arquivo é servido estático,
// sem passar pelo bundler. As chaves abaixo são públicas por natureza (mesmo
// valor que vai pro bundle do cliente); o que protege os dados são as
// firestore.rules, não o sigilo desta config. Se o projeto Firebase mudar,
// atualize os valores aqui junto com o .env.local.
importScripts('https://www.gstatic.com/firebasejs/11.3.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.3.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyBAKYxU99KS4urVzUbgrmpaNM6ClNQPumc',
  authDomain: 'dosecertaai-edaa2.firebaseapp.com',
  projectId: 'dosecertaai-edaa2',
  storageBucket: 'dosecertaai-edaa2.firebasestorage.app',
  messagingSenderId: '771286000292',
  appId: '1:771286000292:web:dedc95743ab9f24c14bc31',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const titulo = payload.notification?.title ?? 'DoseCerta';
  const corpo = payload.notification?.body ?? '';

  self.registration.showNotification(titulo, {
    body: corpo,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
  });
});
