import type { MacrosRefeicao } from './tipos';

export function macrosProporcionais(macros: MacrosRefeicao, percentual: number): MacrosRefeicao {
  return {
    protein: Math.round(macros.protein * percentual),
    carbs: Math.round(macros.carbs * percentual),
    fat: Math.round(macros.fat * percentual),
    kcal: Math.round(macros.kcal * percentual),
  };
}
