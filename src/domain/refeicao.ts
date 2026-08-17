import type { MacrosRefeicao } from './tipos';

export function macrosProporcionais(macros: MacrosRefeicao, percentual: number): MacrosRefeicao {
  return {
    protein: Math.round(macros.protein * percentual),
    carbs: Math.round(macros.carbs * percentual),
    fat: Math.round(macros.fat * percentual),
    kcal: Math.round(macros.kcal * percentual),
  };
}

const PROTEINA_G_POR_KG = 1.35;
const KCAL_POR_KG = 24; // estimativa aproximada de manutenção/leve déficit, mesmo princípio das outras metas por peso
const PISO_KCAL_SEGURO = 1200;

/** Meta diária de proteína sugerida a partir do peso: peso(kg) × 1.35g, arredondada. 0 se não há peso registrado. */
export function calcularMetaProteina(pesoKg: number | null): number {
  return pesoKg ? Math.round(pesoKg * PROTEINA_G_POR_KG) : 0;
}

/** Meta calórica aproximada a partir do peso (24kcal/kg), nunca abaixo do piso de segurança de 1200kcal. */
export function calcularMetaCalorica(pesoKg: number | null): number {
  const estimativa = pesoKg ? Math.round(pesoKg * KCAL_POR_KG) : 0;
  return Math.max(estimativa, PISO_KCAL_SEGURO);
}
