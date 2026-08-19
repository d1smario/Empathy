/**
 * Tipi condivisi della Gestione Menù admin (`nutrition_menu_foods` + macro joinate
 * da `nutrition_fdc_foods`). File client-safe: importa SOLO type/const dal modulo
 * pool (nessun `server-only`, nessun client Supabase) così il componente React può
 * riusarlo senza rompere il bundle del browser.
 */
import type { MenuFoodPoolKey, MenuFoodServingBasis } from "@/lib/nutrition/v2/menu-food-pools";
import type { MenuFoodMealRolesInput } from "@/lib/admin/menu-food-meal-roles-validation";

/**
 * Riga di `nutrition_menu_food_meal_roles` come la espone la GET admin (colonne DB +
 * metadati). Stessi campi del body `meal_roles` accettato da PATCH/POST.
 */
export type AdminMenuFoodMealRoles = MenuFoodMealRolesInput & {
  source_version: string | null;
  updated_at: string | null;
};

/** Riga del catalogo menù arricchita con le macro reali per 100 g (fonte USDA). */
export type AdminMenuFoodRow = {
  canonical_key: string;
  fdc_id: number;
  label_it: string;
  serving_basis: MenuFoodServingBasis;
  pool_keys: string[];
  rotation_key: string | null;
  carb_family: string | null;
  is_meat: boolean;
  is_fish: boolean;
  is_animal_product: boolean;
  sort_priority: number;
  is_active: boolean;
  /** Macro per 100 g da `nutrition_fdc_foods` (null se il fdc_id non ha la riga/valore). */
  macro: {
    kcal: number | null;
    carbs: number | null;
    protein: number | null;
    fat: number | null;
  };
  /** `description` USDA della riga FDC (per disambiguare il fdc_id in UI). */
  usdaDescription: string | null;
  /**
   * Grammatica (score/ruoli per pasto) da `nutrition_menu_food_meal_roles`, left join:
   * null = l'alimento NON ha riga di score («fuori grammatica», il motore lo tratta senza ruolo).
   */
  meal_roles: AdminMenuFoodMealRoles | null;
  /** Comodo per badge/filtro tabella: `meal_roles != null`. */
  has_meal_roles: boolean;
};

export type { MenuFoodPoolKey, MenuFoodServingBasis };
