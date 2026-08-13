import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Volta ao topo a cada troca de rota.
 *
 * O react-router não faz isso sozinho: navegar do fim de um Histórico longo
 * para os Ajustes deixava a página na mesma altura de rolagem, e a tela nova
 * abria "pelo meio". No celular a barra de abas fica sempre visível e o
 * sintoma passa despercebido; no desktop, com a navegação lateral fixa, é
 * evidente.
 */
export function RolarAoTopo() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname]);

  return null;
}
