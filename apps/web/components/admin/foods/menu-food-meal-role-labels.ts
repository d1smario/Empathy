/**
 * Etichette italiane per ruoli/frequenze della grammatica (meal roles). Solo UI: i
 * valori canonici e la validazione stanno in `lib/admin/menu-food-meal-roles-validation`.
 */
import type {
  MenuFoodBreakfastChoRoleValue,
  MenuFoodBreakfastFatRoleValue,
  MenuFoodBreakfastProteinRoleValue,
  MenuFoodFrequencyValue,
  MenuFoodMacroRoleValue,
  MenuFoodMainMealRoleValue,
  MenuFoodMealRoleValue,
  MenuFoodMediterraneanPriorityValue,
  MenuFoodRoleMealKey,
  MenuFoodSnackRoleValue,
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

// ── Etichette v6 (sistema ruoli Mario v6) ────────────────────────────────────────────

export const BREAKFAST_CHO_ROLE_LABELS: Record<MenuFoodBreakfastChoRoleValue, string> = {
  NONE: "Nessuno",
  PRIMARY_COMPLEX: "CHO complesso principale (B01)",
  SECONDARY_SIMPLE: "Quota semplice (frutta/miele, B02)",
  SECONDARY_MIXED: "Dolce occasionale (B04/B05)",
};

export const BREAKFAST_PROTEIN_ROLE_LABELS: Record<MenuFoodBreakfastProteinRoleValue, string> = {
  NONE: "Nessuno",
  PRIMARY: "Proteina principale (latte/yogurt/uova)",
  SECONDARY: "Proteina secondaria",
  SECONDARY_SAVOURY: "Secondaria salata (affettati)",
};

export const BREAKFAST_FAT_ROLE_LABELS: Record<MenuFoodBreakfastFatRoleValue, string> = {
  NONE: "Nessuno",
  PRIMARY: "Grasso principale (frutta oleosa/creme)",
  SECONDARY: "Grasso secondario (semi/animali)",
};

export const MAIN_MEAL_ROLE_LABELS: Record<MenuFoodMainMealRoleValue, string> = {
  NONE: "Nessuno",
  PRIMARY_PROTEIN: "Proteina principale",
  SECONDARY_PROTEIN: "Proteina secondaria (legumi…)",
  PRIMARY_OR_SECONDARY_PROTEIN: "Proteina principale o secondaria",
  PRIMARY_COMPLEX_CARB: "CHO complesso principale",
  SECONDARY_CARB: "CHO alternativo (patate e derivati)",
  FIBER_SIDE: "Contorno fibra",
  SECONDARY_FAT: "Grasso secondario",
  FAT_CONDIMENT: "Condimento grasso (olio EVO…)",
  COMPOSITE_MAIN: "Piatto composto",
};

export const SNACK_ROLE_LABELS: Record<MenuFoodSnackRoleValue, string> = {
  NONE: "Mai a spuntino",
  FAST_CARB: "Carboidrato rapido",
  FAST_PROTEIN: "Proteina rapida",
  FAST_FAT_PRO: "Grasso+proteina rapidi (frutta secca…)",
  MEDIUM: "Preparazione media (ripiego)",
  LOW: "Poco adatto (preparazione lenta)",
};

export const MEDITERRANEAN_PRIORITY_LABELS: Record<MenuFoodMediterraneanPriorityValue, string> = {
  PRIMARY: "Primaria (base mediterranea)",
  COMMON: "Comune",
  ROTATION: "In rotazione",
  SECOND_CHOICE: "Seconda scelta",
  LIMITED: "Limitata",
  OCCASIONAL: "Occasionale",
};
