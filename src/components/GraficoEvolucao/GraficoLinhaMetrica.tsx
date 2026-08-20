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
import type { Aplicacao, RegistroPeso } from "@/domain/tipos";
import {
  COR_EIXO,
  COR_GRADE,
  COR_INJECAO,
  chaveDoDia,
  filtrarPorPeriodo,
  formatarRotuloDia,
  larguraMinima,
  type PeriodoDias,
} from "./compartilhado";

export type PontoLinha = {
  data: string;
  valor: number | null;
  /** `true` quando este dia não tem registro real e o valor foi herdado do último conhecido, só para o marcador de aplicação ter onde pousar. Só se aplica quando `comHeranca` está ativo. */
  valorEstimado: boolean;
  teveInjecao: boolean;
};

type PontoInterno = {
  dia: Date;
  valor: number | null;
  valorEstimado: boolean;
  teveInjecao: boolean;
};

/**
 * Une o calendário de registros de peso/cintura com o de aplicações, para que
 * um dia de dose sem registro próprio ainda apareça no eixo (ver
 * `GraficoEvolucaoPeso` original). Quando `comHeranca` é `true` (peso), um dia
 * sem valor herda o último valor conhecido (`valorEstimado: true`). Quando é
 * `false` (cintura), o dia entra com `valor: null` — a linha mostra um gap em
 * vez de inventar um valor que a pessoa nunca registrou.
 */
function montarPontosInternos(
  historico: RegistroPeso[],
  aplicacoes: Aplicacao[],
  extrair: (registro: RegistroPeso) => number | null,
  comHeranca: boolean,
): PontoInterno[] {
  const valorPorDia = new Map<string, { data: Date; valor: number | null }>();
  for (const registro of historico) {
    const valor = extrair(registro);
    if (valor === null && !comHeranca) continue;
    valorPorDia.set(chaveDoDia(registro.recordedAt), { data: registro.recordedAt, valor });
  }

  const doseDoDia = new Map<string, Date>();
  for (const aplicacao of aplicacoes) {
    if (aplicacao.status !== "aplicada") continue;
    const chave = chaveDoDia(aplicacao.dataHora);
    if (!doseDoDia.has(chave)) doseDoDia.set(chave, aplicacao.dataHora);
  }

  const chaves = new Set<string>([...valorPorDia.keys(), ...doseDoDia.keys()]);
  const diasOrdenados = [...chaves]
    .map((chave) => valorPorDia.get(chave)?.data ?? doseDoDia.get(chave)!)
    .sort((a, b) => a.getTime() - b.getTime());

  if (!comHeranca) {
    return diasOrdenados.map((dia) => {
      const chave = chaveDoDia(dia);
      const registro = valorPorDia.get(chave);
      return {
        dia,
        valor: registro?.valor ?? null,
        valorEstimado: false,
        teveInjecao: doseDoDia.has(chave),
      };
    });
  }

  const primeiroValorConhecido = diasOrdenados
    .map((dia) => valorPorDia.get(chaveDoDia(dia))?.valor)
    .find((valor) => valor !== undefined && valor !== null);

  let ultimoValorConhecido: number | null = primeiroValorConhecido ?? null;
  const pontos: PontoInterno[] = [];
  for (const dia of diasOrdenados) {
    const chave = chaveDoDia(dia);
    const registro = valorPorDia.get(chave);
    if (registro?.valor !== undefined && registro.valor !== null) ultimoValorConhecido = registro.valor;
    if (ultimoValorConhecido === null) continue;

    pontos.push({
      dia,
      valor: ultimoValorConhecido,
      valorEstimado: !registro?.valor,
      teveInjecao: doseDoDia.has(chave),
    });
  }
  return pontos;
}

function formatarPontos(pontos: PontoInterno[]): PontoLinha[] {
  return pontos.map(({ dia, ...resto }) => ({
    data: formatarRotuloDia(dia),
    ...resto,
  }));
}

type PontoDoGrafico = {
  cx?: number;
  cy?: number;
  payload?: PontoLinha;
};

function criarDotInjecao(corLinha: string) {
  return function DotInjecao({ cx, cy, payload }: PontoDoGrafico) {
    if (cx === undefined || cy === undefined || !payload || payload.valor === null) return null;

    if (payload.teveInjecao) {
      return payload.valorEstimado ? (
        <circle cx={cx} cy={cy} r={6} fill="none" stroke={COR_INJECAO} strokeWidth={2} strokeDasharray="2 2" />
      ) : (
        <circle cx={cx} cy={cy} r={6} fill={COR_INJECAO} stroke="#fff" strokeWidth={1.5} />
      );
    }

    return <circle cx={cx} cy={cy} r={3} fill={corLinha} />;
  };
}

function criarTooltip(rotuloMetrica: string, unidade: string) {
  return function TooltipLinha({ active, payload, label, labelFormatter }: TooltipContentProps<ValueType, NameType>) {
    if (!active || !payload || payload.length === 0) return null;

    const ponto = payload[0].payload as PontoLinha;
    if (ponto.valor === null) return null;
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
        <div style={{ fontWeight: 600 }}>
          {rotuloMetrica}: {ponto.valor.toLocaleString("pt-BR")} {unidade}
        </div>
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
  };
}

type GraficoLinhaMetricaProps = {
  historico: RegistroPeso[];
  aplicacoes: Aplicacao[];
  periodo: PeriodoDias;
  extrair: (registro: RegistroPeso) => number | null;
  comHeranca: boolean;
  corLinha: string;
  rotuloMetrica: string;
  unidade: string;
  mensagemVazio: string;
};

export function GraficoLinhaMetrica({
  historico,
  aplicacoes,
  periodo,
  extrair,
  comHeranca,
  corLinha,
  rotuloMetrica,
  unidade,
  mensagemVazio,
}: GraficoLinhaMetricaProps) {
  const pontosInternos = montarPontosInternos(historico, aplicacoes, extrair, comHeranca);
  const pontosFiltrados = filtrarPorPeriodo(pontosInternos, periodo);
  const dadosGrafico = formatarPontos(pontosFiltrados);
  const temAlgumValor = dadosGrafico.some((p) => p.valor !== null);

  if (!temAlgumValor) {
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
        {mensagemVazio}
      </div>
    );
  }

  const DotInjecao = criarDotInjecao(corLinha);
  const TooltipLinha = criarTooltip(rotuloMetrica, unidade);

  return (
    <div className="overflow-x-auto overflow-y-hidden touch-pan-x">
      <div style={{ minWidth: larguraMinima(periodo) }}>
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
              content={TooltipLinha as unknown as ContentType<ValueType, NameType>}
              labelFormatter={(rotulo) => (typeof rotulo === "string" ? rotulo.slice(0, 5) : rotulo)}
            />
            <Line
              type="monotone"
              dataKey="valor"
              stroke={corLinha}
              strokeWidth={3}
              dot={<DotInjecao />}
              activeDot={{ r: 8, fill: corLinha, strokeWidth: 0 }}
              isAnimationActive={false}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
