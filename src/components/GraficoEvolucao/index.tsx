import { useState } from "react";
import { useDados } from "@/features/dados/DadosProvider";
import { useEvolucao } from "@/features/dados/DadosEvolucaoProvider";
import { GraficoLinhaMetrica } from "./GraficoLinhaMetrica";
import { GraficoNutricao } from "./GraficoNutricao";
import { GraficoHidratacao } from "./GraficoHidratacao";
import { Legenda, type ItemLegenda } from "./Legenda";
import { SeletorAba, type OpcaoAba } from "./SeletorAba";
import { SeletorPeriodo } from "./SeletorPeriodo";
import {
  COR_AGUA,
  COR_ALERTA_SINTOMA,
  COR_CALORIAS,
  COR_CINTURA,
  COR_INJECAO,
  COR_PESO,
  COR_PROTEINA,
  OPCOES_PERIODO,
  type PeriodoDias,
} from "./compartilhado";

type Aba = "peso" | "cintura" | "nutricao" | "hidratacao";

const OPCOES_ABA: readonly OpcaoAba<Aba>[] = [
  { valor: "peso", rotulo: "Peso" },
  { valor: "cintura", rotulo: "Cintura" },
  { valor: "nutricao", rotulo: "Nutrição" },
  { valor: "hidratacao", rotulo: "Hidratação" },
];

export function GraficoEvolucaoCard() {
  const { aplicacoes } = useDados();
  const {
    historicoPeso,
    historicoPesoCarregando,
    refeicoesTodas,
    refeicoesTodasCarregando,
    hidratacao30d,
    hidratacao30dCarregando,
    sintomas30d,
    sintomas30dCarregando,
  } = useEvolucao();

  const [aba, setAba] = useState<Aba>("peso");
  const [periodo, setPeriodo] = useState<PeriodoDias>(OPCOES_PERIODO[0].dias);

  const itensLegenda: ItemLegenda[] =
    aba === "peso"
      ? [
          { cor: COR_PESO, forma: "linha", rotulo: "Peso (kg)" },
          { cor: COR_INJECAO, forma: "circulo", rotulo: "Dia de aplicação" },
        ]
      : aba === "cintura"
        ? [
            { cor: COR_CINTURA, forma: "linha", rotulo: "Cintura (cm)" },
            { cor: COR_INJECAO, forma: "circulo", rotulo: "Dia de aplicação" },
          ]
        : aba === "nutricao"
          ? [
              { cor: COR_CALORIAS, forma: "quadrado", rotulo: "Calorias (kcal) · eixo esq." },
              { cor: COR_PROTEINA, forma: "linha", rotulo: "Proteína (g) · eixo dir." },
            ]
          : [
              { cor: COR_AGUA, forma: "quadrado", rotulo: "Água (ml)" },
              { cor: COR_ALERTA_SINTOMA, forma: "circulo", rotulo: "Sintomas relatados" },
            ];

  const carregando =
    (aba === "peso" || aba === "cintura") && historicoPesoCarregando && historicoPeso.length === 0
      ? true
      : aba === "nutricao" && refeicoesTodasCarregando && refeicoesTodas.length === 0
        ? true
        : aba === "hidratacao" &&
            (hidratacao30dCarregando || sintomas30dCarregando) &&
            hidratacao30d.length === 0 &&
            sintomas30d.length === 0
          ? true
          : false;

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <SeletorAba opcoes={OPCOES_ABA} abaAtiva={aba} aoMudar={setAba} />
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
          <SeletorPeriodo periodo={periodo} aoMudar={setPeriodo} />
        </div>
      </div>

      <Legenda itens={itensLegenda} />

      {carregando ? (
        <div
          className="animate-pulse"
          style={{ height: 300, borderRadius: 12, background: "rgba(156, 163, 175, 0.08)" }}
        />
      ) : (
        <>
          {aba === "peso" && (
            <GraficoLinhaMetrica
              historico={historicoPeso}
              aplicacoes={aplicacoes}
              periodo={periodo}
              extrair={(registro) => registro.weight}
              comHeranca
              corLinha={COR_PESO}
              rotuloMetrica="Peso"
              unidade="kg"
              mensagemVazio="Nenhum peso registrado ainda. Seu gráfico aparecerá aqui."
            />
          )}
          {aba === "cintura" && (
            <GraficoLinhaMetrica
              historico={historicoPeso}
              aplicacoes={aplicacoes}
              periodo={periodo}
              extrair={(registro) => registro.waist}
              comHeranca={false}
              corLinha={COR_CINTURA}
              rotuloMetrica="Cintura"
              unidade="cm"
              mensagemVazio="Nenhuma medida de cintura registrada ainda."
            />
          )}
          {aba === "nutricao" && <GraficoNutricao refeicoes={refeicoesTodas} periodo={periodo} />}
          {aba === "hidratacao" && (
            <GraficoHidratacao hidratacao={hidratacao30d} sintomas={sintomas30d} periodo={periodo} />
          )}
        </>
      )}
    </div>
  );
}
