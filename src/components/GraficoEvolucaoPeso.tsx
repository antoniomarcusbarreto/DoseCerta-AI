import { useState } from "react";
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

export type PontoEvolucaoPeso = {
  data: string;
  peso: number;
  /** `true` quando este dia não tem peso registrado e o valor é o último peso conhecido, carregado adiante só para o marcador de aplicação ter onde pousar. */
  pesoEstimado: boolean;
  teveInjecao: boolean;
};

const COR_LINHA = "#14b8a6";
const COR_INJECAO = "#a855f7";
const COR_EIXO = "#9ca3af";
const COR_GRADE = "rgba(156, 163, 175, 0.2)";

function chaveDoDia(data: Date): string {
  return `${data.getFullYear()}-${data.getMonth()}-${data.getDate()}`;
}

type PontoInterno = {
  dia: Date;
  peso: number;
  pesoEstimado: boolean;
  teveInjecao: boolean;
};

/**
 * Uma aplicação sem peso registrado no mesmo dia não gerava nenhum ponto no
 * gráfico antes — o eixo só continha os dias de `historico`. Por isso o
 * marcador de dose "sumia" sempre que o usuário registrava a aplicação num
 * dia sem pesagem. Aqui o eixo passa a ser a união dos dois calendários: dias
 * com peso e dias com dose aplicada. Um dia de dose sem peso próprio herda o
 * peso conhecido mais próximo (`pesoEstimado: true`) só para ter uma posição
 * no eixo Y — o tooltip deixa claro que aquele valor não é uma pesagem real.
 *
 * Uma dose anterior a QUALQUER peso já registrado costumava ser descartada
 * (não havia "último peso conhecido" ainda para herdar) — era o bug de doses
 * recentes somem do gráfico quando a pessoa aplica antes de registrar o
 * primeiro peso. Por isso o preenchimento agora olha para trás também: se
 * ainda não existe peso conhecido, usa o primeiro peso disponível no
 * histórico (o mais antigo buscado), em vez de pular o dia.
 */
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
    // Só sobra null aqui se não houver NENHUM peso em todo o histórico buscado.
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

/** Recorte por calendário (não por quantidade de pontos): dias sem pesagem
 * nem dose não "gastam" vaga de outro dia que esteja dentro da janela. */
function filtrarPorPeriodo(pontos: PontoInterno[], periodoDias: number): PontoInterno[] {
  const corte = new Date();
  corte.setHours(0, 0, 0, 0);
  corte.setDate(corte.getDate() - (periodoDias - 1));
  return pontos.filter((ponto) => ponto.dia.getTime() >= corte.getTime());
}

function formatarPontos(pontos: PontoInterno[]): PontoEvolucaoPeso[] {
  return pontos.map(({ dia, ...resto }) => ({
    data: dia.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
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
    // Peso estimado (carregado do último registro real): círculo oco, para não
    // parecer uma pesagem que não aconteceu nesse dia.
    return payload.pesoEstimado ? (
      <circle cx={cx} cy={cy} r={6} fill="none" stroke={COR_INJECAO} strokeWidth={2} strokeDasharray="2 2" />
    ) : (
      <circle cx={cx} cy={cy} r={6} fill={COR_INJECAO} stroke="#fff" strokeWidth={1.5} />
    );
  }

  return <circle cx={cx} cy={cy} r={3} fill={COR_LINHA} />;
}

function TooltipEvolucao({ active, payload, label, labelFormatter }: TooltipContentProps<ValueType, NameType>) {
  if (!active || !payload || payload.length === 0) return null;

  const ponto = payload[0].payload as PontoEvolucaoPeso;
  // `label` já vem só como DD/MM (ver `formatarPontos`) — nunca hora. O
  // `labelFormatter` passado ao <Tooltip/> é aplicado aqui mesmo assim, como
  // garantia: qualquer formatação futura do rótulo passa por um único lugar.
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

const OPCOES_PERIODO = [
  { dias: 7, rotulo: "7 dias" },
  { dias: 15, rotulo: "15 dias" },
  { dias: 30, rotulo: "1 Mês" },
] as const;

type PeriodoDias = (typeof OPCOES_PERIODO)[number]["dias"];

function SeletorPeriodo({
  periodo,
  aoMudar,
}: {
  periodo: PeriodoDias;
  aoMudar: (periodo: PeriodoDias) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
      {OPCOES_PERIODO.map((opcao) => {
        const ativo = opcao.dias === periodo;
        return (
          <button
            key={opcao.dias}
            type="button"
            onClick={() => aoMudar(opcao.dias)}
            style={{
              padding: "5px 12px",
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 600,
              border: ativo ? "1px solid transparent" : "1px solid var(--border-hair)",
              background: ativo ? COR_LINHA : "transparent",
              color: ativo ? "#022c22" : "var(--ink-muted)",
              cursor: "pointer",
            }}
          >
            {opcao.rotulo}
          </button>
        );
      })}
    </div>
  );
}

// Só 15/30 dias ganham largura mínima maior que a tela — é isso que habilita
// o swipe horizontal no celular sem espremer os pontos. 7 dias sempre cabe.
function larguraMinima(periodo: PeriodoDias): string {
  if (periodo === 15) return "600px";
  if (periodo === 30) return "900px";
  return "100%";
}

type GraficoEvolucaoPesoProps = {
  dados?: PontoEvolucaoPeso[];
};

export function GraficoEvolucaoPeso({ dados }: GraficoEvolucaoPesoProps) {
  const { aplicacoes } = useDados();
  const { historicoPeso: historico, historicoPesoCarregando: carregando } = useEvolucao();
  const [periodo, setPeriodo] = useState<PeriodoDias>(7);

  const usaSeletor = dados === undefined;
  const pontosInternos = usaSeletor ? montarPontosInternos(historico, aplicacoes) : [];
  const pontosFiltrados = usaSeletor ? filtrarPorPeriodo(pontosInternos, periodo) : [];
  const dadosGrafico = dados ?? formatarPontos(pontosFiltrados);

  // `carregando` só deve travar a tela na primeira visita da sessão, antes do
  // provider ter qualquer dado em memória. Depois disso ele fica `false` para
  // sempre (o listener nunca é refeito ao trocar de aba), mas essa checagem
  // extra em `historico` blinda contra qualquer re-render intermediário do
  // provider mostrar o esqueleto por cima de um gráfico que já tem dado.
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
              {/* `width` explícito: sem ele o eixo usa a largura padrão do Recharts,
                  que corta o primeiro dígito de pesos de 3 dígitos (ex.: "109.25"
                  virava "09.25" — lido por engano como hora). */}
              <YAxis
                width={50}
                stroke={COR_EIXO}
                tick={{ fill: COR_EIXO, fontSize: 12 }}
                axisLine={{ stroke: COR_GRADE }}
                tickLine={false}
                domain={["dataMin - 2", "dataMax + 2"]}
              />
              {/* `data` já é montada como DD/MM (ver `montarPontosInternos`); o
                  formatter aqui garante que nenhum outro formato (com hora) escape
                  para o tooltip, mesmo que a origem do rótulo mude no futuro. */}
              <Tooltip
                content={TooltipEvolucao as unknown as ContentType<ValueType, NameType>}
                labelFormatter={(rotulo) => (typeof rotulo === 'string' ? rotulo.slice(0, 5) : rotulo)}
              />
              {/* Sem isso, o Recharts redesenha a linha do zero (a animação padrão de
                  entrada) toda vez que este componente remonta — ou seja, toda vez
                  que a pessoa troca de aba e volta para a Início, mesmo com o dado
                  já em memória. Isso lia como um "recarregando" falso. */}
              <Line
                type="monotone"
                dataKey="peso"
                stroke={COR_LINHA}
                strokeWidth={3}
                dot={<DotInjecao />}
                activeDot={{ r: 8, fill: COR_LINHA, strokeWidth: 0 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
