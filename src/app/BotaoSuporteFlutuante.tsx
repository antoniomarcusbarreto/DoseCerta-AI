import { useNavigate } from 'react-router-dom';

const IconeSuporte = () => (
  <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true">
    <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.75" />
    <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.75" />
    <path
      d="M6.5 6.5l3 3M17.5 6.5l-3 3M6.5 17.5l3-3M17.5 17.5l-3-3"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
    />
  </svg>
);

/**
 * Atalho de suporte no celular.
 *
 * A BarraAbas é de propósito fixo em quatro itens (ver abas.tsx), então
 * suporte não entra lá — vira um FAB discreto acima dela. Some no desktop
 * (`lg:hidden`), onde a NavLateral já tem o link fixo no rodapé.
 */
export function BotaoSuporteFlutuante() {
  const navegar = useNavigate();

  return (
    <button
      type="button"
      onClick={() => navegar('/ajustes/suporte')}
      aria-label="Suporte e Feedback"
      className="fixed z-40 grid size-12 place-items-center rounded-full border text-ink-muted transition-transform hover:scale-105 active:scale-95 lg:hidden"
      style={{
        right: '1rem',
        bottom: 'calc(4.5rem + env(safe-area-inset-bottom, 0px))',
        background: 'var(--surface-card)',
        borderColor: 'var(--border-hair)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <IconeSuporte />
    </button>
  );
}
