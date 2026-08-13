import { NavLink } from 'react-router-dom';
import { useTheme } from '@/features/theme/ThemeProvider';
import { ABAS } from './abas';

/**
 * Navegação do celular: barra fixa no rodapé, ao alcance do polegar.
 *
 * Some no desktop (`lg:hidden`), onde a NavLateral assume — e `display: none`
 * a tira também da árvore de acessibilidade, evitando dois <nav> principais.
 */
export function BarraAbas() {
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
    <nav aria-label="Navegação principal" className="fixed inset-x-0 bottom-0 z-40 lg:hidden">
      {/*
       * A superfície acompanha a largura da coluna do app pela MESMA variável
       * que a coluna usa: se as duas não lerem o mesmo token, a barra
       * desalinha da moldura assim que a coluna muda de largura no tablet.
       */}
      <div
        className="mx-auto border-t sm:border-x"
        style={{
          maxWidth: 'var(--largura-casca)',
          background: 'var(--surface-card)',
          borderColor: 'var(--border-hair)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <ul className="flex">
          {ABAS.map((aba) => (
            <li key={aba.para} className="flex-1">
              <NavLink
                to={aba.para}
                end={aba.exato}
                className={({ isActive }) =>
                  `flex min-h-14 flex-col items-center justify-center gap-1 py-2 transition-colors ${getEstilosAba(isActive)}`
                }
              >
                {({ isActive }) => (
                  <>
                    <span aria-hidden="true" style={{ opacity: isActive ? 1 : 0.75 }}>
                      {aba.icone}
                    </span>
                    <span className="t-caption">{aba.rotulo}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
