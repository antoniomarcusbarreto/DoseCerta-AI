import { Link, NavLink } from 'react-router-dom';
import { useTheme } from '@/features/theme/ThemeProvider';
import { ABAS } from './abas';

const IconeSuporte = () => (
  <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true">
    <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
    <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.6" />
    <path
      d="M6.5 6.5l3 3M17.5 6.5l-3 3M6.5 17.5l3-3M17.5 17.5l-3-3"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  </svg>
);

/**
 * Navegação do desktop: coluna fixa à esquerda, sempre visível.
 *
 * Só existe a partir de `lg` — abaixo disso quem navega é a BarraAbas. As duas
 * leem a mesma lista (`abas.tsx`) para não divergirem, e ambas usam `NavLink`,
 * que já emite `aria-current="page"` no item em uso.
 *
 * Não colocar `backdrop-filter` nem `transform` aqui: o elemento é `fixed`, e
 * qualquer um dos dois num ancestral reancoraria o posicionamento.
 */
export function NavLateral() {
  const { theme } = useTheme();

  const getEstilosAba = (isActive: boolean) => {
    if (theme === 'menta-claro') {
      return isActive ? 'bg-teal-100 text-teal-900' : 'text-slate-600';
    }
    if (theme === 'lavanda-clara') {
      return isActive ? 'bg-fuchsia-100 text-fuchsia-900' : 'text-slate-600';
    }
    return isActive ? 'bg-white/10 text-white' : 'text-slate-400';
  };

  const corSuporte = theme === 'oceano-escuro' ? 'text-slate-400' : 'text-slate-600';

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-y-0 left-0 z-40 hidden flex-col border-r px-3 py-6 lg:flex"
      style={{
        width: 'var(--largura-nav)',
        background: 'var(--surface-card)',
        borderColor: 'var(--border-hair)',
      }}
    >
      <p className="t-caption px-3 pb-6 text-ink font-extrabold">
        Dose Certa<span className="text-teal-500">-AI</span>
      </p>

      <ul className="flex flex-col gap-1">
        {ABAS.map((aba) => (
          <li key={aba.para}>
            <NavLink
              to={aba.para}
              end={aba.exato}
              className={({ isActive }) =>
                `flex min-h-11 items-center gap-3 rounded-[var(--r-field)] px-3 transition-colors hover:bg-sunken ${getEstilosAba(isActive)}`
              }
            >
              {({ isActive }) => (
                <>
                  <span aria-hidden="true" style={{ opacity: isActive ? 1 : 0.75 }}>
                    {aba.icone}
                  </span>
                  <span className="t-label">{aba.rotulo}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>

      {/* Empurrado para o rodapé pelo mt-auto: suporte é uma saída, não um
          destino de uso diário, então fica separado da navegação principal.
          O Co-piloto já vem pela lista de ABAS acima — é uso diário, não uma
          saída — então não se repete aqui. */}
      <div className="mt-auto border-t pt-3" style={{ borderColor: 'var(--border-hair)' }}>
        <Link
          to="/ajustes/suporte"
          className={`flex min-h-11 items-center gap-3 rounded-[var(--r-field)] px-3 transition-colors hover:bg-sunken ${corSuporte}`}
        >
          <span aria-hidden="true" style={{ opacity: 0.75 }}>
            <IconeSuporte />
          </span>
          <span className="t-label">Suporte e Feedback</span>
        </Link>
      </div>
    </nav>
  );
}
