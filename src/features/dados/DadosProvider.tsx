import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { firebaseConfigurado } from '@/lib/firebase';
import { useColecao } from '@/lib/useConsulta';
import { statusDoDia, type StatusDoDia } from '@/domain/aplicacao';
import { ordenarMedicamentos } from '@/domain/catalogo';
import { useSemearCatalogo } from '@/features/medicamento/useSemearCatalogo';
import type { Aplicacao, Caneta, Medicamento, Protocolo } from '@/domain/tipos';
import {
  consultaAplicacoes,
  consultaCanetasAtivas,
  consultaMedicamentos,
  consultaProtocolos,
} from './repositorio';

export type Dados = {
  uid: string | null;
  /** O protocolo em vigor. */
  protocolo: Protocolo | null;
  /** Todos os protocolos, do mais recente ao mais antigo (inclui arquivados). */
  protocolos: Protocolo[];
  aplicacoes: Aplicacao[];
  canetaAtiva: Caneta | null;
  /** Todas as canetas ativas — o catálogo precisa delas para avisar antes de excluir. */
  canetas: Caneta[];
  /** Catálogo da conta, já em ordem de exibição. */
  medicamentos: Medicamento[];
  status: StatusDoDia | null;
  carregando: boolean;
  /**
   * Separado de `carregando` de propósito: aquele é o portão do splash de tela
   * cheia, e segurá-lo por uma coleção que só dois formulários consomem
   * atrasaria a abertura para todo mundo.
   */
  medicamentosCarregando: boolean;
  erro: Error | null;
};

const Contexto = createContext<Dados | null>(null);

/**
 * Assinatura única dos dados da conta.
 *
 * Ficar chamando os hooks de consulta em cada tela abriria um listener novo
 * por tela montada. Com o provider é um listener por coleção, e todas as
 * telas leem do mesmo estado.
 */
export function DadosProvider({ children }: { children: ReactNode }) {
  const { usuario } = useAuth();
  const uid = firebaseConfigurado ? (usuario?.uid ?? null) : null;

  const protocolos = useColecao(
    uid ? consultaProtocolos(uid) : null,
    uid ? `${uid}/protocolos` : null,
  );
  const aplicacoes = useColecao(
    uid ? consultaAplicacoes(uid) : null,
    uid ? `${uid}/aplicacoes` : null,
  );
  const canetas = useColecao(
    uid ? consultaCanetasAtivas(uid) : null,
    uid ? `${uid}/canetas-ativas` : null,
  );
  const medicamentos = useColecao(
    uid ? consultaMedicamentos(uid) : null,
    uid ? `${uid}/medicamentos` : null,
  );

  useSemearCatalogo(uid);

  const valor = useMemo<Dados>(() => {
    const protocolo = protocolos.dados.find((p) => p.ativo) ?? null;
    return {
      uid,
      protocolo,
      protocolos: protocolos.dados,
      aplicacoes: aplicacoes.dados,
      canetaAtiva: canetas.dados[0] ?? null,
      canetas: canetas.dados,
      medicamentos: ordenarMedicamentos(medicamentos.dados),
      status: protocolo ? statusDoDia(protocolo, aplicacoes.dados) : null,
      carregando: protocolos.carregando || aplicacoes.carregando,
      medicamentosCarregando: medicamentos.carregando,
      erro: protocolos.erro ?? aplicacoes.erro ?? canetas.erro ?? medicamentos.erro,
    };
  }, [uid, protocolos, aplicacoes, canetas, medicamentos]);

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useDados(): Dados {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error('useDados precisa estar dentro de <DadosProvider>.');
  return contexto;
}
