import {
  Bar,
  CartesianGrid,
  BarChart,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TooltipContentProps } from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import type { ContentType } from "recharts/types/component/Tooltip";
import type { RegistroHidratacao, RegistroSintoma } from "@/domain/tipos";
import {
  COR_AGUA,
  COR_ALERTA_SINTOMA,
  COR_EIXO,
  COR_GRADE,
  chaveDoDia,
  filtrarPorPeriodo,
  formatarRotuloDia,
  larguraMinima,
  type PeriodoDias,
} from "./compartilhado";

type PontoHidratacaoInterno = { dia: Date; volumeMl: number; teveSintoma: boolean };

type PontoHidratacao = { data: string; volumeMl: number; teveSintoma: boolean };

/** União do calendário de hidratação e sintomas: um dia com sintoma mas sem
 * água registrada entra com `volumeMl: 0` (não é herdado/estimado) — é
 * justamente o caso mais relevante para o alerta de causa e efeito. */
function montarPontos(hidratacao: RegistroHidratacao[], sintomas: RegistroSintoma[]): PontoHidratacaoInterno[] {
  const volumePorDia = new Map<string, { dia: Date; volumeMl: number }>();
  for (const registro of hidratacao) {
    const chave = chaveDoDia(registro.recordedAt);
    const atual = volumePorDia.get(chave) ?? { dia: registro.recordedAt, volumeMl: 0 };
    atual.volumeMl += registro.amount_ml;
    volumePorDia.set(chave, atual);
  }

  const diasComSintomaPorChave = new Map<string, Date>();
  for (const sintoma of sintomas) {
    const chave = chaveDoDia(sintoma.recordedAt);
    if (!diasComSintomaPorChave.has(chave)) diasComSintomaPorChave.set(chave, sintoma.recordedAt);
  }

  const chaves = new Set<string>([...volumePorDia.keys(), ...diasComSintomaPorChave.keys()]);
  const diasOrdenados = [...chaves]
    .map((chave) => volumePorDia.get(chave)?.dia ?? diasComSintomaPorChave.get(chave)!)
    .sort((a, b) => a.getTime() - b.getTime());

  return diasOrdenados.map((dia) => {
    const chave = chaveDoDia(dia);
    return {
      dia,
      volumeMl: volumePorDia.get(chave)?.volumeMl ?? 0,
      teveSintoma: diasComSintomaPorChave.has(chave),
    };
  });
}

function formatarPontos(pontos: PontoHidratacaoInterno[]): PontoHidratacao[] {
  return pontos.map(({ dia, ...resto }) => ({ data: formatarRotuloDia(dia), ...resto }));
}

type PropsMarcador = {
  x?: number;
  y?: number;
  width?: number;
  value?: unknown;
};

function MarcadorSintoma({ x, y, width, value }: PropsMarcador) {
  if (!value || x === undefined || y === undefined || width === undefined) return null;
  const cx = x + width / 2;
  return <circle cx={cx} cy={y - 10} r={5} fill={COR_ALERTA_SINTOMA} stroke="#fff" strokeWidth={1.5} />;
}

function TooltipHidratacao({ active, payload, label, labelFormatter }: TooltipContentProps<ValueType, NameType>) {
  if (!active || !payload || payload.length === 0) return null;

  const ponto = payload[0].payload as PontoHidratacao;
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
      <div style={{ fontWeight: 600 }}>Água: {ponto.volumeMl.toLocaleString("pt-BR")} ml</div>
      {ponto.teveSintoma && (
        <div
          style={{
            marginTop: 6,
            display: "inline-block",
            background: "rgba(239, 68, 68, 0.2)",
            color: COR_ALERTA_SINTOMA,
            borderRadius: 999,
            padding: "2px 8px",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          Sintoma registrado
        </div>
      )}
    </div>
  );
}

export function GraficoHidratacao({
  hidratacao,
  sintomas,
  periodo,
}: {
  hidratacao: RegistroHidratacao[];
  sintomas: RegistroSintoma[];
  periodo: PeriodoDias;
}) {
  const pontosInternos = montarPontos(hidratacao, sintomas);
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
        {`Nenhum registro de hidratação nos últimos ${periodo} dias.`}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto overflow-y-hidden touch-pan-x">
      <div style={{ minWidth: larguraMinima(periodo) }}>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={dadosGrafico} margin={{ top: 20, right: 10, bottom: 8, left: 0 }}>
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
            />
            <Tooltip content={TooltipHidratacao as unknown as ContentType<ValueType, NameType>} />
            <Bar dataKey="volumeMl" fill={COR_AGUA} radius={[4, 4, 0, 0]} isAnimationActive={false} minPointSize={2}>
              <LabelList dataKey="teveSintoma" content={<MarcadorSintoma />} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
