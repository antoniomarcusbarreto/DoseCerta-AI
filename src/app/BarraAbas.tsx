import { NavLink } from 'react-router-dom';
import { ABAS } from './abas';

/**
 * Navegação do celular: barra fixa no rodapé, ao alcance do polegar.
 *
 * Some no desktop (`lg:hidden`), onde a NavLateral assume — e `display: none`
 * a tira também da árvore de acessibilidade, evitando dois <nav> principais.
 *
 * A cor da aba ativa/inativa vem só de `--nav-ativo`/`--ink`/`--ink-muted`:
 * nenhum tema precisa de código aqui, só de definir os tokens em tokens.css.
 */
export function BarraAbas() {
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
                className="flex min-h-14 flex-col items-center justify-center gap-1 py-2 transition-colors"
                style={({ isActive }) => ({
                  background: isActive ? 'var(--nav-ativo)' : undefined,
                  color: isActive ? 'var(--ink)' : 'var(--ink-muted)',
                })}
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
