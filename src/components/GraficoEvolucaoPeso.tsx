import { memo, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TooltipContentProps } from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import type { ContentType } from "recharts/types/component/Tooltip";
import { useDados } from "@/features/dados/DadosProvider";
import { useEvolucao } from "@/features/dados/DadosEvolucaoProvider";
import type { Aplicacao, RegistroPeso } from "@/domain/tipos";
import { SeletorPeriodo } from "./GraficoEvolucao/SeletorPeriodo";
import {
  COR_EIXO,
  COR_GRADE,
  COR_INJECAO,
  COR_PESO,
  chaveDoDia,
  filtrarPorPeriodo,
  formatarRotuloDia,
  larguraMinima,
  type PeriodoDias,
} from "./GraficoEvolucao/compartilhado";

/**
 * Wrapper preservando a API pública anterior deste componente (é usado com a
 * prop `dados` pronta, sem seletor de período, em algum consumidor fora da
 * Home). A versão com abas (Peso/Cintura/Nutrição/Hidratação) usada na Home
 * vive em `./GraficoEvolucao`.
 */
export type PontoEvolucaoPeso = {
  data: string;
  peso: number;
  /** `true` quando este dia não tem peso registrado e o valor é o último peso conhecido, carregado adiante só para o marcador de aplicação ter onde pousar. */
  pesoEstimado: boolean;
  teveInjecao: boolean;
};

type PontoInterno = {
  dia: Date;
  peso: number;
  pesoEstimado: boolean;
  teveInjecao: boolean;
};

function montarPontosInternos(historico: RegistroPeso[], aplicacoes: Aplicacao[]): PontoInterno[] {
  const pesoPorDia = new Map<string, { data: Date; peso: number }>();
  for (const registro of historico) {
    pesoPorDia.set(chaveDoDia(registro.recordedAt), { data: registro.recordedAt, peso: registro.weight });
  }

  const doseDoDia = new Map<string, Date>();
  for (const aplicacao of aplicacoes) {
    if (aplicacao.status !== "aplicada") continue;
    const chave = chaveDoDia(aplicacao.dataHora);
    if (!doseDoDia.has(chave)) doseDoDia.set(chave, aplicacao.dataHora);
  }

  const chaves = new Set<string>([...pesoPorDia.keys(), ...doseDoDia.keys()]);
  const diasOrdenados = [...chaves]
    .map((chave) => pesoPorDia.get(chave)?.data ?? doseDoDia.get(chave)!)
    .sort((a, b) => a.getTime() - b.getTime());

  const primeiroPesoConhecido = diasOrdenados
    .map((dia) => pesoPorDia.get(chaveDoDia(dia))?.peso)
    .find((peso) => peso !== undefined);

  let ultimoPesoConhecido: number | null = primeiroPesoConhecido ?? null;
  const pontos: PontoInterno[] = [];
  for (const dia of diasOrdenados) {
    const chave = chaveDoDia(dia);
    const registroPeso = pesoPorDia.get(chave);
    if (registroPeso) ultimoPesoConhecido = registroPeso.peso;
    if (ultimoPesoConhecido === null) continue;

    pontos.push({
      dia,
      peso: ultimoPesoConhecido,
      pesoEstimado: !registroPeso,
      teveInjecao: doseDoDia.has(chave),
    });
  }
  return pontos;
}

function formatarPontos(pontos: PontoInterno[]): PontoEvolucaoPeso[] {
  return pontos.map(({ dia, ...resto }) => ({
    data: formatarRotuloDia(dia),
    ...resto,
  }));
}

type PontoDoGrafico = {
  cx?: number;
  cy?: number;
  payload?: PontoEvolucaoPeso;
};

function DotInjecao({ cx, cy, payload }: PontoDoGrafico) {
  if (cx === undefined || cy === undefined || !payload) return null;

  if (payload.teveInjecao) {
    return payload.pesoEstimado ? (
      <circle cx={cx} cy={cy} r={6} fill="none" stroke={COR_INJECAO} strokeWidth={2} strokeDasharray="2 2" />
    ) : (
      <circle cx={cx} cy={cy} r={6} fill={COR_INJECAO} stroke="#fff" strokeWidth={1.5} />
    );
  }

  return <circle cx={cx} cy={cy} r={3} fill={COR_PESO} />;
}

function TooltipEvolucao({ active, payload, label, labelFormatter }: TooltipContentProps<ValueType, NameType>) {
  if (!active || !payload || payload.length === 0) return null;

  const ponto = payload[0].payload as PontoEvolucaoPeso;
  const rotulo = typeof labelFormatter === "function" ? labelFormatter(label, payload) : label;

  return (
    <div
      style={{
        background: "rgba(17, 24, 39, 0.92)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        borderRadius: 8,
        padding: "8px 12px",
        color: "#f3f4f6",
        fontSize: 13,
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
      }}
    >
      <div style={{ color: COR_EIXO, marginBottom: 4 }}>{rotulo}</div>
      <div style={{ fontWeight: 600 }}>Peso: {ponto.peso.toLocaleString("pt-BR")} kg</div>
      {ponto.teveInjecao && (
        <div
          style={{
            marginTop: 6,
            display: "inline-block",
            background: "rgba(168, 85, 247, 0.2)",
            color: COR_INJECAO,
            borderRadius: 999,
            padding: "2px 8px",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          Aplicação
        </div>
      )}
    </div>
  );
}

type GraficoEvolucaoPesoProps = {
  dados?: PontoEvolucaoPeso[];
};

function GraficoEvolucaoPesoBase({ dados }: GraficoEvolucaoPesoProps) {
  const { aplicacoes } = useDados();
  const { historicoPeso: historico, historicoPesoCarregando: carregando } = useEvolucao();
  const [periodo, setPeriodo] = useState<PeriodoDias>(7);

  const usaSeletor = dados === undefined;

  const pontosInternos = useMemo(
    () => (usaSeletor ? montarPontosInternos(historico, aplicacoes) : []),
    [usaSeletor, historico, aplicacoes],
  );

  const dadosGrafico = useMemo(() => {
    if (dados) return dados;
    return formatarPontos(filtrarPorPeriodo(pontosInternos, periodo));
  }, [dados, pontosInternos, periodo]);

  if (usaSeletor && carregando && historico.length === 0) {
    return (
      <div
        className="animate-pulse"
        style={{ height: 300, borderRadius: 12, background: "rgba(156, 163, 175, 0.08)" }}
      />
    );
  }

  if (dadosGrafico.length === 0) {
    return (
      <div>
        {usaSeletor && <SeletorPeriodo periodo={periodo} aoMudar={setPeriodo} />}
        <div
          style={{
            height: 300,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: "0 24px",
            color: COR_EIXO,
            fontSize: 14,
          }}
        >
          {usaSeletor && pontosInternos.length > 0
            ? `Nenhum peso registrado nos últimos ${periodo} dias.`
            : "Nenhum peso registrado ainda. Seu gráfico aparecerá aqui."}
        </div>
      </div>
    );
  }

  return (
    <div>
      {usaSeletor && <SeletorPeriodo periodo={periodo} aoMudar={setPeriodo} />}
      <div className="overflow-x-auto overflow-y-hidden touch-pan-x">
        <div style={{ minWidth: usaSeletor ? larguraMinima(periodo) : "100%" }}>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dadosGrafico} margin={{ top: 12, right: 10, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={COR_GRADE} vertical={false} />
              <XAxis
                dataKey="data"
                stroke={COR_EIXO}
                tick={{ fill: COR_EIXO, fontSize: 12 }}
                axisLine={{ stroke: COR_GRADE }}
                tickLine={false}
                minTickGap={30}
                angle={-45}
                textAnchor="end"
                height={40}
              />
              <YAxis
                width={50}
                stroke={COR_EIXO}
                tick={{ fill: COR_EIXO, fontSize: 12 }}
                axisLine={{ stroke: COR_GRADE }}
                tickLine={false}
                domain={["dataMin - 2", "dataMax + 2"]}
              />
              <Tooltip
                content={TooltipEvolucao as unknown as ContentType<ValueType, NameType>}
                labelFormatter={(rotulo) => (typeof rotulo === "string" ? rotulo.slice(0, 5) : rotulo)}
              />
              <Line
                type="monotone"
                dataKey="peso"
                stroke={COR_PESO}
                strokeWidth={3}
                dot={<DotInjecao />}
                activeDot={{ r: 8, fill: COR_PESO, strokeWidth: 0 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export const GraficoEvolucaoPeso = memo(GraficoEvolucaoPesoBase);
