/**
 * Etichette italiane per ruoli/frequenze della grammatica (meal roles). Solo UI: i
 * valori canonici e la validazione stanno in `lib/admin/menu-food-meal-roles-validation`.
 */
import type {
  MenuFoodFrequencyValue,
  MenuFoodMacroRoleValue,
  MenuFoodMealRoleValue,
  MenuFoodRoleMealKey,
} from "@/lib/admin/menu-food-meal-roles-validation";

export const MEAL_ROLE_LABELS: Record<MenuFoodMealRoleValue, string> = {
  CHO_PRIMARY: "Carboidrato principale",
  CHO_SECONDARY: "Carboidrato secondario",
  PRO_PRIMARY: "Proteina principale",
  PRO_SECONDARY: "Proteina secondaria",
  FAT_COMPLEMENT: "Grasso di complemento",
  FIBER_VEG: "Verdura (fibra)",
  FIBER_MICRO_PRIMARY: "Verdura/micronutrienti principale",
  MIXED: "Misto",
  COMPOSITE_MAIN: "Piatto composto principale",
  EXCLUDE: "Escluso",
  NONE: "Nessuno",
};

export const MACRO_ROLE_LABELS: Record<MenuFoodMacroRoleValue, string> = {
  CHO_PRIMARY: "Carboidrato principale",
  CHO_SECONDARY: "Carboidrato secondario",
  PRO_PRIMARY: "Proteina principale",
  PRO_SECONDARY: "Proteina secondaria",
  FAT_PRIMARY: "Grasso principale",
  FIBER_MICRO: "Fibra/micronutrienti",
  MIXED: "Misto",
  PRO_FAT_MIXED: "Proteine + grassi",
};

export const FREQUENCY_LABELS: Record<MenuFoodFrequencyValue, string> = {
  COMMON: "Comune (senza limiti)",
  ROTATION: "In rotazione",
  OCCASIONAL: "Occasionale",
};

export const ROLE_MEAL_LABELS: Record<MenuFoodRoleMealKey, string> = {
  breakfast: "Colazione",
  snack: "Spuntino",
  lunch: "Pranzo",
  dinner: "Cena",
};
