// `chaveDoDia` mora no domínio (usada também fora dos gráficos, para detectar a
// virada do dia); reexportada aqui para os gráficos manterem um só import.
export { chaveDoDia } from "@/domain/datas";

export const COR_PESO = "#14b8a6";
export const COR_CINTURA = "#38bdf8";
export const COR_CALORIAS = "#f97316";
export const COR_PROTEINA = "#eab308";
export const COR_AGUA = "#0ea5e9";
export const COR_ALERTA_SINTOMA = "#ef4444";
export const COR_INJECAO = "#a855f7";
export const COR_EIXO = "#9ca3af";
export const COR_GRADE = "rgba(156, 163, 175, 0.2)";

/** Recorte por calendário (não por quantidade de pontos): dias sem registro
 * não "gastam" vaga de outro dia que esteja dentro da janela. */
export function filtrarPorPeriodo<T extends { dia: Date }>(pontos: T[], periodoDias: PeriodoDias): T[] {
  const corte = new Date();
  corte.setHours(0, 0, 0, 0);
  corte.setDate(corte.getDate() - (periodoDias - 1));
  return pontos.filter((ponto) => ponto.dia.getTime() >= corte.getTime());
}

export const OPCOES_PERIODO = [
  { dias: 7, rotulo: "7 dias" },
  { dias: 15, rotulo: "15 dias" },
  { dias: 30, rotulo: "1 Mês" },
] as const;

export type PeriodoDias = (typeof OPCOES_PERIODO)[number]["dias"];

// Só 15/30 dias ganham largura mínima maior que a tela — é isso que habilita
// o swipe horizontal no celular sem espremer os pontos. 7 dias sempre cabe.
export function larguraMinima(periodo: PeriodoDias): string {
  if (periodo === 15) return "600px";
  if (periodo === 30) return "900px";
  return "100%";
}

export function formatarRotuloDia(dia: Date): string {
  return dia.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
