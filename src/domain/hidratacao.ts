const ML_POR_KG = 35;
/** Usada só quando a conta não tem nenhum peso registrado ainda. */
const META_PADRAO_ML = 2000;

/** Meta diária sugerida a partir do último peso: peso(kg) × 35ml, com fallback fixo se não houver peso. */
export function calcularMetaHidratacao(pesoKg: number | null): number {
  return pesoKg ? Math.round(pesoKg * ML_POR_KG) : META_PADRAO_ML;
}
