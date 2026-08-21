import { useEffect, useState } from 'react';
import { onSnapshot, type DocumentReference, type Query } from 'firebase/firestore';

export type Consulta<T> = {
  dados: T;
  carregando: boolean;
  erro: Error | null;
};

/**
 * Assina uma query em tempo real.
 *
 * `onSnapshot` entrega primeiro o que está no cache local e depois o servidor,
 * então a tela aparece preenchida mesmo offline — o comportamento que faz
 * registrar aplicação sem rede valer a pena.
 *
 * `chave` é o identificador estável da assinatura. A referência da query é
 * recriada a cada render e não serve como dependência de efeito; sem a chave, o
 * hook re-assinaria sem parar. Em troca, a chave é o único jeito de reassinar:
 * uma consulta cujos limites dependem do tempo (as janelas de "hoje", por
 * exemplo) precisa carregar o dia corrente na chave, senão fica presa para
 * sempre à janela do momento em que foi montada.
 */
export function useColecao<T>(consulta: Query<T> | null, chave: string | null): Consulta<T[]> {
  const [estado, setEstado] = useState<Consulta<T[]>>({
    dados: [],
    carregando: consulta !== null,
    erro: null,
  });

  useEffect(() => {
    if (!consulta || !chave) {
      setEstado({ dados: [], carregando: false, erro: null });
      return;
    }

    // Zera os dados junto, e não só `carregando`: quando a chave muda os
    // resultados antigos deixaram de valer (é outra janela de tempo, ou outro
    // usuário). Mantê-los até o primeiro snapshot faria a Home somar o consumo
    // de ontem sob a data de hoje por um instante — o próprio bug que a chave
    // com o dia corrente existe para corrigir.
    setEstado({ dados: [], carregando: true, erro: null });

    return onSnapshot(
      consulta,
      (snap) => setEstado({ dados: snap.docs.map((d) => d.data()), carregando: false, erro: null }),
      (erro) => setEstado({ dados: [], carregando: false, erro }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  return estado;
}

export function useDocumento<T>(referencia: DocumentReference<T> | null): Consulta<T | null> {
  const caminho = referencia?.path ?? null;

  const [estado, setEstado] = useState<{ caminho: string | null; consulta: Consulta<T | null> }>(() => ({
    caminho,
    consulta: { dados: null, carregando: referencia !== null, erro: null },
  }));

  // O caminho mudou desde o último render: ajusta o estado já nesta
  // renderização (padrão React de "reset ao mudar de chave"), em vez de
  // esperar o efeito — sem isso, há um render intermediário com `carregando`
  // e `dados` desatualizados sempre que a referência troca de null para um
  // doc (ou de um doc para outro), o que engana quem usa `carregando` para
  // decidir se o doc já foi confirmado como inexistente.
  let consulta = estado.consulta;
  if (estado.caminho !== caminho) {
    consulta = { dados: null, carregando: referencia !== null, erro: null };
    setEstado({ caminho, consulta });
  }

  useEffect(() => {
    if (!referencia || !caminho) {
      setEstado((anterior) => ({ ...anterior, consulta: { dados: null, carregando: false, erro: null } }));
      return;
    }

    return onSnapshot(
      referencia,
      (snap) =>
        setEstado((anterior) => ({
          ...anterior,
          consulta: { dados: snap.data() ?? null, carregando: false, erro: null },
        })),
      (erro) =>
        setEstado((anterior) => ({ ...anterior, consulta: { dados: null, carregando: false, erro } })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caminho]);

  return consulta;
}
