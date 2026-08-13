import { NavLink } from 'react-router-dom';
import { useTheme } from '@/features/theme/ThemeProvider';
import { ABAS } from './abas';

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
    </nav>
  );
}
