/**
 * Fonte UNICA della whitelist dei pool del menù (meal-plan V2) e delle basi di
 * pesatura ammesse. Vive qui — modulo senza alcun import — così può essere riusato
 * sia dalle route server (validazione) sia dai tipi client (`menu-food-types.ts`)
 * senza trascinare `server-only` o il client Supabase nel bundle del browser.
 *
 * Gli 11 pool sono ESATTAMENTE gli slot di assemblaggio di `meal-slot-assembly-spec`
 * (colazione cho/pro/fat, pranzo carb/pro/veg, cena carb/pro/veg, spuntino cho/pro).
 * Il pool `fueling` di `fdc-pool-specs` è volutamente ESCLUSO: il menù curato copre
 * i pasti, non il fueling sport (che resta pescato dal registry FDC).
 */
export const MENU_FOOD_POOL_KEYS = [
  "breakfast_cho",
  "breakfast_pro",
  "breakfast_fat",
  "lunch_carb",
  "lunch_pro",
  "lunch_veg",
  "dinner_carb",
  "dinner_pro",
  "dinner_veg",
  "snack_cho",
  "snack_pro",
] as const;

export type MenuFoodPoolKey = (typeof MENU_FOOD_POOL_KEYS)[number];

/** Set per il lookup O(1) in validazione (`pool_keys` tutte in whitelist). */
export const MENU_FOOD_POOL_KEY_SET: ReadonlySet<string> = new Set(MENU_FOOD_POOL_KEYS);

/**
 * Basi di pesatura ammesse — stesso check della migrazione
 * (`serving_basis in ('dry_grams','cooked_grams','ml')`): crudo/secco → dry_grams,
 * cotto → cooked_grams, liquidi → ml.
 */
export const MENU_FOOD_SERVING_BASES = ["dry_grams", "cooked_grams", "ml"] as const;

export type MenuFoodServingBasis = (typeof MENU_FOOD_SERVING_BASES)[number];

export const MENU_FOOD_SERVING_BASIS_SET: ReadonlySet<string> = new Set(MENU_FOOD_SERVING_BASES);
