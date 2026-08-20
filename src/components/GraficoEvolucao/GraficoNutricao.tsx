import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TooltipContentProps } from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import type { ContentType } from "recharts/types/component/Tooltip";
import type { RegistroRefeicao } from "@/domain/tipos";
import {
  COR_CALORIAS,
  COR_EIXO,
  COR_GRADE,
  COR_PROTEINA,
  chaveDoDia,
  filtrarPorPeriodo,
  formatarRotuloDia,
  larguraMinima,
  type PeriodoDias,
} from "./compartilhado";

type PontoNutricaoInterno = { dia: Date; kcal: number; proteina: number };

type PontoNutricao = { data: string; kcal: number; proteina: number };

/** `refeicoesTodas` traz até 200 refeições concluídas mais recentes, sem
 * filtro de data — em usuários com muitas refeições/dia isso pode não cobrir
 * os 30 dias corridos do período selecionado. Limitação aceita por ora. */
function agregarPorDia(refeicoes: RegistroRefeicao[]): PontoNutricaoInterno[] {
  const porDia = new Map<string, PontoNutricaoInterno>();
  for (const refeicao of refeicoes) {
    const chave = chaveDoDia(refeicao.createdAt);
    const atual = porDia.get(chave) ?? { dia: refeicao.createdAt, kcal: 0, proteina: 0 };
    atual.kcal += refeicao.macros.kcal;
    atual.proteina += refeicao.macros.protein;
    porDia.set(chave, atual);
  }
  return [...porDia.values()].sort((a, b) => a.dia.getTime() - b.dia.getTime());
}

function formatarPontos(pontos: PontoNutricaoInterno[]): PontoNutricao[] {
  return pontos.map(({ dia, kcal, proteina }) => ({
    data: formatarRotuloDia(dia),
    kcal: Math.round(kcal),
    proteina: Math.round(proteina),
  }));
}

function TooltipNutricao({ active, payload, label, labelFormatter }: TooltipContentProps<ValueType, NameType>) {
  if (!active || !payload || payload.length === 0) return null;

  const ponto = payload[0].payload as PontoNutricao;
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
      <div style={{ fontWeight: 600 }}>Calorias: {ponto.kcal.toLocaleString("pt-BR")} kcal</div>
      <div style={{ fontWeight: 600 }}>Proteína: {ponto.proteina.toLocaleString("pt-BR")} g</div>
    </div>
  );
}

export function GraficoNutricao({
  refeicoes,
  periodo,
}: {
  refeicoes: RegistroRefeicao[];
  periodo: PeriodoDias;
}) {
  const pontosInternos = agregarPorDia(refeicoes);
  const pontosFiltrados = filtrarPorPeriodo(pontosInternos, periodo);
  const dadosGrafico = formatarPontos(pontosFiltrados);

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
        {`Nenhuma refeição registrada nos últimos ${periodo} dias.`}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto overflow-y-hidden touch-pan-x">
      <div style={{ minWidth: larguraMinima(periodo) }}>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={dadosGrafico} margin={{ top: 12, right: 10, bottom: 8, left: 0 }}>
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
              yAxisId="kcal"
              orientation="left"
              width={50}
              stroke={COR_EIXO}
              tick={{ fill: COR_EIXO, fontSize: 12 }}
              axisLine={{ stroke: COR_GRADE }}
              tickLine={false}
            />
            <YAxis
              yAxisId="proteina"
              orientation="right"
              width={40}
              stroke={COR_EIXO}
              tick={{ fill: COR_EIXO, fontSize: 12 }}
              axisLine={{ stroke: COR_GRADE }}
              tickLine={false}
            />
            <Tooltip content={TooltipNutricao as unknown as ContentType<ValueType, NameType>} />
            <Bar yAxisId="kcal" dataKey="kcal" fill={COR_CALORIAS} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            <Line
              yAxisId="proteina"
              type="monotone"
              dataKey="proteina"
              stroke={COR_PROTEINA}
              strokeWidth={3}
              dot={{ r: 3, fill: COR_PROTEINA }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
