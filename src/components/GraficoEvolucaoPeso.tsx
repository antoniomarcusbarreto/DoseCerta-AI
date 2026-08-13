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
import { useDados } from "@/features/dados/DadosProvider";
import { consultaHistoricoPeso } from "@/features/dados/repositorio";
import { useColecao } from "@/lib/useConsulta";
import type { Aplicacao, RegistroPeso } from "@/domain/tipos";

export type PontoEvolucaoPeso = {
  data: string;
  peso: number;
  teveInjecao: boolean;
};

const COR_LINHA = "#14b8a6";
const COR_INJECAO = "#a855f7";
const COR_EIXO = "#9ca3af";
const COR_GRADE = "rgba(156, 163, 175, 0.2)";

function chaveDoDia(data: Date): string {
  return `${data.getFullYear()}-${data.getMonth()}-${data.getDate()}`;
}

function montarDadosGrafico(
  historico: RegistroPeso[],
  aplicacoes: Aplicacao[],
): PontoEvolucaoPeso[] {
  const diasComDose = new Set(
    aplicacoes.filter((a) => a.status === "aplicada").map((a) => chaveDoDia(a.dataHora)),
  );

  return [...historico]
    .sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime())
    .map((registro) => ({
      data: registro.recordedAt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      peso: registro.weight,
      teveInjecao: diasComDose.has(chaveDoDia(registro.recordedAt)),
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
    return (
      <circle
        cx={cx}
        cy={cy}
        r={6}
        fill={COR_INJECAO}
        stroke="#fff"
        strokeWidth={1.5}
      />
    );
  }

  return <circle cx={cx} cy={cy} r={3} fill={COR_LINHA} />;
}

function TooltipEvolucao({ active, payload, label }: TooltipContentProps<ValueType, NameType>) {
  if (!active || !payload || payload.length === 0) return null;

  const ponto = payload[0].payload as PontoEvolucaoPeso;

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
      <div style={{ color: COR_EIXO, marginBottom: 4 }}>{label}</div>
      <div style={{ fontWeight: 600 }}>Peso: {ponto.peso} kg</div>
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
          💉 Dia da Dose
        </div>
      )}
    </div>
  );
}

type GraficoEvolucaoPesoProps = {
  dados?: PontoEvolucaoPeso[];
};

export function GraficoEvolucaoPeso({ dados }: GraficoEvolucaoPesoProps) {
  const { uid, aplicacoes } = useDados();
  const consulta = uid ? consultaHistoricoPeso(uid, 30) : null;
  const { dados: historico, carregando } = useColecao(
    consulta,
    uid ? `${uid}/weight_history/grafico-evolucao` : null,
  );

  const dadosGrafico = dados ?? montarDadosGrafico(historico, aplicacoes);

  if (dados === undefined && carregando) {
    return (
      <div
        className="animate-pulse"
        style={{ height: 300, borderRadius: 12, background: "rgba(156, 163, 175, 0.08)" }}
      />
    );
  }

  if (dadosGrafico.length === 0) {
    return (
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
        Nenhum peso registrado ainda. Seu gráfico aparecerá aqui.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={dadosGrafico} margin={{ top: 12, right: 10, bottom: 8, left: -20 }}>
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
          stroke={COR_EIXO}
          tick={{ fill: COR_EIXO, fontSize: 12 }}
          axisLine={{ stroke: COR_GRADE }}
          tickLine={false}
          domain={["dataMin - 2", "dataMax + 2"]}
        />
        <Tooltip content={TooltipEvolucao} />
        <Line
          type="monotone"
          dataKey="peso"
          stroke={COR_LINHA}
          strokeWidth={3}
          dot={<DotInjecao />}
          activeDot={{ r: 8, fill: COR_LINHA, strokeWidth: 0 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
