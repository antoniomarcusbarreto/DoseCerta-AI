/** IMC = peso (kg) / altura (m) ao quadrado. null se peso ou altura não forem positivos. */
export function calcularImc(weightKg: number, heightM: number): number | null {
  if (!Number.isFinite(weightKg) || weightKg <= 0) return null;
  if (!Number.isFinite(heightM) || heightM <= 0) return null;
  return weightKg / (heightM * heightM);
}

/** Diferença entre o peso digitado agora e o último peso salvo. Positivo = ganhou, negativo = perdeu. */
export function deltaPeso(atual: number, anterior: number): number {
  return atual - anterior;
}
