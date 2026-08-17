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
 * Cinco itens de propósito: o Co-piloto ganhou destaque aqui porque é uso
 * diário, não uma seção de configuração — o resto das funcionalidades novas
 * continua entrando na lista de Ajustes. `flex-1` em cada botão (BarraAbas)
 * absorve o item a mais; o alvo de toque só encolhe um pouco.
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
    rotulo: 'Aplicações',
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
    para: '/copiloto',
    rotulo: 'Co-piloto',
    icone: (
      <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true">
        <path
          d="M12 3.5l1.4 4.2 4.2 1.4-4.2 1.4-1.4 4.2-1.4-4.2-4.2-1.4 4.2-1.4L12 3.5zM19 14l.8 2.3 2.3.8-2.3.8-.8 2.3-.8-2.3-2.3-.8 2.3-.8.8-2.3z"
          {...traco}
          strokeLinejoin="round"
        />
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
