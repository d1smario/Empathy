/**
 * Etichette italiane leggibili per gli 11 pool del menù (meal-plan V2). Solo UI:
 * mappa la `poolKey` tecnica (es. `lunch_pro`) alla label mostrata nelle pill e nei
 * chip del Catalogo menù admin. La whitelist canonica resta in `menu-food-pools`.
 */
import { MENU_FOOD_POOL_KEYS, type MenuFoodPoolKey } from "@/lib/nutrition/v2/menu-food-pools";

export const MENU_FOOD_POOL_LABELS: Record<MenuFoodPoolKey, string> = {
  breakfast_cho: "Colazione · carboidrati",
  breakfast_pro: "Colazione · proteine",
  breakfast_fat: "Colazione · grassi",
  lunch_carb: "Pranzo · carboidrati",
  lunch_pro: "Pranzo · proteine",
  lunch_veg: "Pranzo · verdure",
  dinner_carb: "Cena · carboidrati",
  dinner_pro: "Cena · proteine",
  dinner_veg: "Cena · verdure",
  snack_cho: "Spuntino · carboidrati",
  snack_pro: "Spuntino · proteine",
};

/** Etichetta leggibile (fallback: la chiave grezza se non mappata). */
export function poolLabel(key: string): string {
  return (MENU_FOOD_POOL_LABELS as Record<string, string>)[key] ?? key;
}

/** Ordine canonico dei pool per le pill (stesso ordine della whitelist motore). */
export const MENU_FOOD_POOL_ORDER: readonly MenuFoodPoolKey[] = MENU_FOOD_POOL_KEYS;

/** Basi di pesatura con label IT per le select. */
export const SERVING_BASIS_LABELS: Record<string, string> = {
  dry_grams: "Grammi a crudo/secco",
  cooked_grams: "Grammi a cotto",
  ml: "Millilitri (liquidi)",
};
