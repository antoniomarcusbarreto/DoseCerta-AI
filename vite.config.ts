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
});
