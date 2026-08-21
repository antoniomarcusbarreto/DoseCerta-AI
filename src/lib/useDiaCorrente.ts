import { useEffect, useState } from 'react';
import { chaveDoDia, inicioDoDia, somarDias } from '@/domain/datas';

/** Milissegundos até o primeiro instante do próximo dia local, com uma folga de
 * um segundo para o timer nunca acordar do lado de cá da meia-noite. */
function msAteAProximaMeiaNoite(agora: Date): number {
  return inicioDoDia(somarDias(agora, 1)).getTime() - agora.getTime() + 1000;
}

/**
 * A chave do dia local corrente, reavaliada sempre que ela pode ter mudado.
 *
 * Quem assina uma consulta de "hoje" precisa reassinar quando o dia vira: os
 * limites do dia ficam gravados no objeto da query, e um listener aberto ontem
 * continua servindo a janela de ontem para sempre. Com o cache persistente do
 * Firestore isso não aparece como tela vazia — aparece como o progresso de
 * ontem exibido sob o rótulo de hoje.
 *
 * Três gatilhos, porque nenhum sozinho cobre o app real:
 * - `visibilitychange`: em PWA (sobretudo iOS) trocar de app — ou "fechar" pelo
 *   app switcher — não recarrega a página, então a virada do dia acontece com o
 *   app congelado. Mesmo motivo do recheck de token em `useNotificacoes`.
 * - `focus`: no desktop a aba pode ficar visível e sem foco por horas.
 * - timer da meia-noite: cobre o app deixado aberto e à vista na virada.
 *
 * O timer é sempre calculado a partir da próxima meia-noite, nunca como um
 * intervalo fixo de 24h — no horário de verão o dia tem 23 ou 25 horas.
 */
export function useDiaCorrente(): string {
  const [dia, setDia] = useState(() => chaveDoDia(new Date()));

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    function agendarProximaMeiaNoite() {
      clearTimeout(timer);
      timer = setTimeout(reavaliar, msAteAProximaMeiaNoite(new Date()));
    }

    // Só troca o estado quando o dia realmente virou: reassinar as consultas a
    // cada foco custaria uma leitura no servidor e um piscar de tela.
    function reavaliar() {
      setDia((anterior) => {
        const atual = chaveDoDia(new Date());
        return atual === anterior ? anterior : atual;
      });
      agendarProximaMeiaNoite();
    }

    const aoVoltar = () => {
      if (document.visibilityState !== 'visible') return;
      reavaliar();
    };

    agendarProximaMeiaNoite();
    document.addEventListener('visibilitychange', aoVoltar);
    window.addEventListener('focus', reavaliar);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', aoVoltar);
      window.removeEventListener('focus', reavaliar);
    };
  }, []);

  return dia;
}
