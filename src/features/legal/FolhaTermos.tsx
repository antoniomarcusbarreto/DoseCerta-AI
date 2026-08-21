import { useEffect } from 'react';
import { ConteudoTermos, ConteudoPrivacidade } from './conteudoLegal';

type Props = {
  aberto: boolean;
  conteudo: 'termos' | 'privacidade';
  aoFechar: () => void;
};

const TITULO: Record<Props['conteudo'], string> = {
  termos: 'Termos de Uso',
  privacidade: 'Política de Privacidade',
};

export function FolhaTermos({ aberto, conteudo, aoFechar }: Props) {
  useEffect(() => {
    if (!aberto) return;
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === 'Escape') aoFechar();
    }
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [aberto, aoFechar]);

  if (!aberto) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center"
      onClick={aoFechar}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={TITULO[conteudo]}
        onClick={(evento) => evento.stopPropagation()}
        className="flex max-h-[88dvh] w-full flex-col rounded-t-2xl bg-[#3b4c5e] md:max-w-lg md:rounded-2xl"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
          <h2 className="text-lg font-bold text-white">{TITULO[conteudo]}</h2>
          <button
            type="button"
            onClick={aoFechar}
            aria-label="Fechar"
            className="inline-flex size-11 items-center justify-center rounded-full border border-white/20 bg-white/5 text-white backdrop-blur-md hover:opacity-85 transition-opacity"
          >
            <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6L6 18"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
          {conteudo === 'termos' ? <ConteudoTermos /> : <ConteudoPrivacidade />}
        </div>

        <div className="border-t border-white/10 px-4 py-4">
          <button
            type="button"
            onClick={aoFechar}
            className="w-full inline-flex items-center justify-center gap-2 rounded-full px-6 h-12 bg-teal-600 hover:bg-teal-700 text-white font-bold transition-opacity hover:opacity-85"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
