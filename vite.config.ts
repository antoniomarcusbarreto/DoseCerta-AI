import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false, // registro manual via ReloadPrompt (useRegisterSW)
      manifest: false, // public/manifest.webmanifest já existe e já é linkado no index.html
      filename: 'sw.js',
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        /*
         * O handler de push entra DENTRO deste service worker, em vez de viver
         * num worker próprio. É o ponto central da arquitetura de notificações,
         * não uma escolha de organização: a inscrição de push pertence ao
         * worker que a cria, e o iOS só entrega de forma confiável com o app
         * encerrado quando esse worker é o mesmo que controla o PWA instalado
         * (escopo `/`, que é o deste aqui). A versão anterior registrava um
         * worker separado do FCM num escopo dedicado que nenhuma página
         * navegava; ele funcionava com o app aberto (já estava vivo) e falhava
         * com o app fechado, quando o iOS teria de acordar uma registration
         * órfã.
         */
        importScripts: ['/push-sw.js'],
        /*
         * O script de push não é asset do app: ele é concatenado ao worker via
         * `importScripts` acima. Deixá-lo no precache guardaria uma cópia
         * paralela que nunca serve para nada e ainda mascara qual versão está
         * de fato ativa.
         */
        globIgnores: ['push-sw.js'],
        navigateFallback: '/index.html',
        /*
         * `/__/auth/*` é o handler de login do Firebase, servido no nosso
         * domínio por um proxy em vercel.json (ver "self-host the sign-in
         * helper code" na doc do Firebase). Sem esta exceção o service worker
         * responderia essas navegações com o index.html cacheado e o login
         * por redirect nunca se completaria.
         */
        navigateFallbackDenylist: [/^\/__\/auth\//],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: {
        /*
         * Firebase e Recharts são as duas dependências mais pesadas do
         * bundle e só entram em uso depois do primeiro carregamento (auth já
         * consome Firebase, mas os gráficos só aparecem na Evolução) — vão
         * em chunks próprios para não inflar o JS inicial em 3G/4G.
         */
        manualChunks: {
          firebase: [
            'firebase/app',
            'firebase/auth',
            'firebase/firestore',
            'firebase/functions',
            'firebase/storage',
            'firebase/messaging',
          ],
          recharts: ['recharts'],
        },
      },
    },
  },
});
