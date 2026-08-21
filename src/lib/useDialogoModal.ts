import { useEffect, useRef } from 'react';

/**
 * Comportamento de diálogo modal compartilhado por toda folha/modal do app:
 * fecha com Escape, trava o scroll do body enquanto aberto, move o foco para
 * dentro do diálogo ao abrir e devolve o foco a quem abriu ao fechar — sem
 * isso o Tab recomeça do topo do documento depois de fechar.
 *
 * Extraído do padrão original de FolhaRegistro.tsx para não duplicar a mesma
 * lógica de acessibilidade em cada novo diálogo.
 *
 * `ativo` existe para diálogos que vivem dentro de um componente sempre
 * montado (ex.: ConfirmContext, InstalacaoWizard) — sem ele, o efeito
 * travaria o scroll do body mesmo com o diálogo fechado.
 */
export function useDialogoModal<T extends HTMLElement>(onFechar: () => void, ativo = true) {
  const containerRef = useRef<T>(null);

  useEffect(() => {
    if (!ativo) return;

    const abriuCom = document.activeElement as HTMLElement | null;
    const rolagemAntes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === 'Escape') onFechar();
    }
    document.addEventListener('keydown', aoTeclar);

    containerRef.current?.querySelector<HTMLElement>('input, select, textarea, button')?.focus();

    return () => {
      document.removeEventListener('keydown', aoTeclar);
      document.body.style.overflow = rolagemAntes;
      abriuCom?.focus?.();
    };
  }, [onFechar, ativo]);

  return containerRef;
}
