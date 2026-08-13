/**
 * Registro do service worker.
 *
 * O `controllerchange` é o que faz uma aba já aberta receber a correção:
 * quando um SW novo assume, a página recarrega sozinha. Sem isso, quem
 * deixou o app instalado continua no shell antigo indefinidamente.
 */
export function registrarSW() {
  if (!('serviceWorker' in navigator)) return;
  if (import.meta.env.DEV) return; // em dev o SW só atrapalha o HMR

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((erro) => {
      console.warn('[DoseCerta] falha ao registrar o service worker:', erro);
    });
  });

  let recarregando = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (recarregando) return;
    recarregando = true;
    window.location.reload();
  });
}
