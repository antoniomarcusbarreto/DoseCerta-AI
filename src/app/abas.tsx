export type Aba = {
  para: string;
  rotulo: string;
  icone: JSX.Element;
  /** `end` evita que "Início" fique ativo em todas as rotas filhas. */
  exato?: boolean;
};

const traco = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

/**
 * Destinos da navegação principal, compartilhados pelas duas apresentações:
 * barra inferior no celular (BarraAbas) e menu lateral no desktop
 * (NavLateral). Ficam aqui para que as duas nunca divirjam.
 *
 * Quatro itens de propósito: a navegação não cresce quando surgirem
 * funcionalidades novas — elas entram na lista de Ajustes. Cinco rótulos já
 * ficam apertados em tela estreita, e o alvo de toque encolhe junto.
 */
export const ABAS: Aba[] = [
  {
    para: '/',
    rotulo: 'Início',
    exato: true,
    icone: (
      <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true">
        <path d="M4 10.5L12 4l8 6.5V19a1 1 0 01-1 1h-4v-6H9v6H5a1 1 0 01-1-1v-8.5z" {...traco} />
      </svg>
    ),
  },
  {
    para: '/historico',
    rotulo: 'Histórico',
    icone: (
      <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true">
        <path d="M4 6h16M4 12h16M4 18h10" {...traco} />
      </svg>
    ),
  },
  {
    para: '/evolucao',
    rotulo: 'Evolução',
    icone: (
      <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true">
        <path d="M4 17l5-5 3.5 3.5L20 8M20 8h-4.5M20 8v4.5" {...traco} />
      </svg>
    ),
  },
  {
    para: '/ajustes',
    rotulo: 'Ajustes',
    icone: (
      <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true">
        <circle cx="12" cy="12" r="3" {...traco} />
        <path
          d="M12 3.5v2M12 18.5v2M20.5 12h-2M5.5 12h-2M17.9 6.1l-1.4 1.4M7.5 16.5l-1.4 1.4M17.9 17.9l-1.4-1.4M7.5 7.5L6.1 6.1"
          {...traco}
        />
      </svg>
    ),
  },
];
