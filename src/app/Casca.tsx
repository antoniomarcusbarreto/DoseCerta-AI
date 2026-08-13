import type { ReactNode } from 'react';
import { BarraAbas } from './BarraAbas';
import { BotaoSuporteFlutuante } from './BotaoSuporteFlutuante';
import { NavLateral } from './NavLateral';

type CascaProps = {
  /**
   * Renderiza a navegação e reserva o espaço dela. Falso no onboarding, que
   * roda antes de haver o que navegar.
   */
  comNavegacao?: boolean;
  children: ReactNode;
};

/**
 * Moldura externa do app.
 *
 * Até 1023px o conteúdo é a coluna de celular centralizada (`.casca-app`); a
 * partir de 1024px a coluna dissolve e o conteúdo ocupa a área ao lado da
 * navegação lateral — é isso que faz o app parar de parecer um celular no
 * meio de uma tela grande.
 *
 * Cuidado ao mexer: nada aqui pode ganhar `transform`, `filter`,
 * `backdrop-filter`, `will-change` ou `contain`. Qualquer um deles cria um
 * bloco contedor novo e reancora a NavLateral e a FolhaRegistro, que são
 * `position: fixed` e esperam o viewport.
 */
export function Casca({ comNavegacao = true, children }: CascaProps) {
  return (
    <div className="min-h-dvh bg-desk">
      {comNavegacao ? <NavLateral /> : null}

      <div className={comNavegacao ? 'casca-conteudo' : undefined}>
        <div className="casca-app min-h-dvh">{children}</div>
      </div>

      {comNavegacao ? <BotaoSuporteFlutuante /> : null}
      {comNavegacao ? <BarraAbas /> : null}
    </div>
  );
}
