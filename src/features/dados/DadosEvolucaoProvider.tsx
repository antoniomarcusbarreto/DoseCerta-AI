import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useDados } from '@/features/dados/DadosProvider';
import { useColecao } from '@/lib/useConsulta';
import type {
  PlanoAlimentar,
  RegistroFoto,
  RegistroHidratacao,
  RegistroIntestino,
  RegistroPeso,
  RegistroRefeicao,
  RegistroSintoma,
} from '@/domain/tipos';
import {
  consultaFotosProgresso,
  consultaHidratacaoDesde,
  consultaHidratacaoHoje,
  consultaHistoricoPeso,
  consultaIntestinoRecentes,
  consultaPlanosAlimentares,
  consultaRefeicoesDeHojeConcluidas,
  consultaSintomasDesde,
  consultaSintomasUltimos7Dias,
  consultaTodasRefeicoesConcluidas,
} from './repositorio';

/** Início da janela de 30 dias usada pelo card de evolução da Home — cobre os
 * 3 períodos de seleção (7/15/30 dias) via filtro client-side, mesmo padrão já
 * usado para `historicoPeso`. Calculado uma vez por montagem do provider; o
 * mesmo risco pré-existente de virar o dia com o app aberto já existe em
 * `consultaHidratacaoHoje`/`consultaSintomasUltimos7Dias`, não é regressão. */
function inicioDaJanelaDe30Dias(): Date {
  const data = new Date();
  data.setHours(0, 0, 0, 0);
  data.setDate(data.getDate() - 29);
  return data;
}

export type DadosEvolucao = {
  historicoPeso: RegistroPeso[];
  historicoPesoCarregando: boolean;
  planos: PlanoAlimentar[];
  planosCarregando: boolean;
  refeicoesHoje: RegistroRefeicao[];
  refeicoesHojeCarregando: boolean;
  hidratacaoHoje: RegistroHidratacao[];
  hidratacaoHojeCarregando: boolean;
  sintomas: RegistroSintoma[];
  sintomasCarregando: boolean;
  intestino: RegistroIntestino[];
  intestinoCarregando: boolean;
  fotos: RegistroFoto[];
  fotosCarregando: boolean;
  refeicoesTodas: RegistroRefeicao[];
  refeicoesTodasCarregando: boolean;
  hidratacao30d: RegistroHidratacao[];
  hidratacao30dCarregando: boolean;
  sintomas30d: RegistroSintoma[];
  sintomas30dCarregando: boolean;
  erro: Error | null;
};

const Contexto = createContext<DadosEvolucao | null>(null);

/**
 * Mesma razão de existir do DadosProvider: sem isso, cada tela de Evolução
 * (e a Início, que reusa peso/plano/hidratação) abriria seu próprio listener
 * onSnapshot toda vez que fosse montada — inclusive coleções assinadas em
 * paralelo por mais de uma tela (ex.: planos alimentares em Início, Dieta,
 * Scanner e Hidratação). Aqui é um listener por coleção, vivo enquanto a
 * sessão autenticada durar.
 */
export function DadosEvolucaoProvider({ children }: { children: ReactNode }) {
  const { uid } = useDados();

  const historicoPeso = useColecao(
    uid ? consultaHistoricoPeso(uid, 60) : null,
    uid ? `${uid}/weight_history` : null,
  );
  const planos = useColecao(
    uid ? consultaPlanosAlimentares(uid) : null,
    uid ? `${uid}/diet_plans` : null,
  );
  const refeicoesHoje = useColecao(
    uid ? consultaRefeicoesDeHojeConcluidas(uid) : null,
    uid ? `${uid}/meals/hoje` : null,
  );
  const hidratacaoHoje = useColecao(
    uid ? consultaHidratacaoHoje(uid) : null,
    uid ? `${uid}/hydration_logs/hoje` : null,
  );
  const sintomas = useColecao(
    uid ? consultaSintomasUltimos7Dias(uid) : null,
    uid ? `${uid}/sintomas` : null,
  );
  const intestino = useColecao(
    uid ? consultaIntestinoRecentes(uid, 10) : null,
    uid ? `${uid}/intestino` : null,
  );
  const fotos = useColecao(
    uid ? consultaFotosProgresso(uid) : null,
    uid ? `${uid}/fotos_progresso` : null,
  );
  const refeicoesTodas = useColecao(
    uid ? consultaTodasRefeicoesConcluidas(uid, 200) : null,
    uid ? `${uid}/meals/todas` : null,
  );
  const hidratacao30d = useColecao(
    uid ? consultaHidratacaoDesde(uid, inicioDaJanelaDe30Dias()) : null,
    uid ? `${uid}/hydration_logs/30d` : null,
  );
  const sintomas30d = useColecao(
    uid ? consultaSintomasDesde(uid, inicioDaJanelaDe30Dias()) : null,
    uid ? `${uid}/sintomas/30d` : null,
  );

  const valor = useMemo<DadosEvolucao>(
    () => ({
      historicoPeso: historicoPeso.dados,
      historicoPesoCarregando: historicoPeso.carregando,
      planos: planos.dados,
      planosCarregando: planos.carregando,
      refeicoesHoje: refeicoesHoje.dados,
      refeicoesHojeCarregando: refeicoesHoje.carregando,
      hidratacaoHoje: hidratacaoHoje.dados,
      hidratacaoHojeCarregando: hidratacaoHoje.carregando,
      sintomas: sintomas.dados,
      sintomasCarregando: sintomas.carregando,
      intestino: intestino.dados,
      intestinoCarregando: intestino.carregando,
      fotos: fotos.dados,
      fotosCarregando: fotos.carregando,
      refeicoesTodas: refeicoesTodas.dados,
      refeicoesTodasCarregando: refeicoesTodas.carregando,
      hidratacao30d: hidratacao30d.dados,
      hidratacao30dCarregando: hidratacao30d.carregando,
      sintomas30d: sintomas30d.dados,
      sintomas30dCarregando: sintomas30d.carregando,
      erro:
        historicoPeso.erro ??
        planos.erro ??
        refeicoesHoje.erro ??
        hidratacaoHoje.erro ??
        sintomas.erro ??
        intestino.erro ??
        fotos.erro ??
        refeicoesTodas.erro ??
        hidratacao30d.erro ??
        sintomas30d.erro,
    }),
    [
      historicoPeso,
      planos,
      refeicoesHoje,
      hidratacaoHoje,
      sintomas,
      intestino,
      fotos,
      refeicoesTodas,
      hidratacao30d,
      sintomas30d,
    ],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useEvolucao(): DadosEvolucao {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error('useEvolucao precisa estar dentro de <DadosEvolucaoProvider>.');
  return contexto;
}
