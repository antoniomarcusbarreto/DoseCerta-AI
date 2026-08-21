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
         * O service worker de push não é asset do app: quem cuida do ciclo de
         * vida dele é o navegador, ao registrá-lo. Deixá-lo no precache só
         * guardaria uma cópia paralela que nunca é usada para servir o script
         * e ainda mascara qual versão está de fato ativa.
         */
        globIgnores: ['firebase-messaging-sw.js'],
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
