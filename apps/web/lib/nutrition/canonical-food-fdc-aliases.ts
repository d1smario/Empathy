/**
 * Mappa dei `canonicalKey` (banca alimenti interna) → `fdcId` USDA FoodData Central.
 *
 * Quando una key è mappata qui:
 * - `nutrientsForMealPlanItemFromCache` legge i nutrienti dalla tabella Supabase `nutrition_fdc_foods`
 *   (popolata via `getOrImportFdcFood` da diary, micronutrient API e meal plan).
 * - GI / II / GL già stimati dal pipeline FDC entrano direttamente nel rollup.
 *
 * Quando una key NON è mappata:
 * - Fallback al `CANONICAL_FOOD_TABLE` TS (compatibilità a iso-funzionalità con la versione attuale).
 *
 * Estendere questo file man mano che `nutrition_fdc_foods` viene popolata (dump USDA Foundation+SR
 * via `import-usda-fdc-dump.ts`, oppure warm `warm-usda-bulk.ts`). Report alias: `usda-bulk-aliases.json`.
 * Meal plan legge la cache in batch (`loadFdcFoodsByIds`); con `FDC_CACHE_ONLY=1` niente USDA live.
 *
 * IMPORTANTE: quando aggiungi una mappatura, verifica che la `description` del `fdcId` sia
 * davvero coerente con il nome canonicalKey. USDA `foods/search` può restituire match per parole
 * comuni (es. cercando "Chickpeas, mature seeds, cooked, boiled" matchava "Lentils, mature seeds,
 * cooked, boiled" perché condividono 4 parole su 5). Lo script `warm-usda-corrections.ts` applica
 * filtri `mustContain` / `mustNotContain` per evitare questi mismatch.
 */

export const CANONICAL_FOOD_TO_FDC_ID: Record<string, number | undefined> = {
  // Cereali e amidi
  bread_white: 174925, // Bread, white, commercially prepared, toasted
  bread_whole_wheat: 172690, // Bread, whole-wheat, prepared from recipe
  bread_rye: 172684, // Bread, rye
  rusk_toast: 174981, // Crackers, rusk toast
  corn_flakes: 174648, // Cereals ready-to-eat, RALSTON Corn Flakes
  granola: 171646, // Cereals ready-to-eat, granola, homemade
  rice_cakes: 170250, // Snacks, rice cakes, brown rice, plain, unsalted
  bagel_plain: 174899, // Bagels, plain, enriched
  pancakes_plain: 175009, // Pancakes, plain, prepared from recipe
  pasta_whole: 168915, // Pasta, whole grain, 51% whole wheat, dry
  rice_brown: 169704, // Rice, brown, long-grain, cooked
  couscous: 169700, // Couscous, cooked
  barley_pearled: 170285, // Barley, pearled, cooked
  bulgur: 170287, // Bulgur, cooked
  millet: 168871, // Millet, cooked
  cornmeal_polenta: 168929, // Cornmeal, degermed, unenriched, yellow
  sweet_potato: 168482, // Sweet potato, raw, unprepared
  pasta_cooked: 168928, // Pasta, cooked, unenriched, without added salt
  pasta_dry: 168927, // Pasta, dry, unenriched
  rice_cooked: 169757, // Rice, white, long-grain, regular, unenriched, cooked without salt
  rice_dry: 169756, // Rice, white, long-grain, regular, raw, unenriched
  oat_dry: 172989, // Cereals, QUAKER, Quick Oats, Dry (proxy SR Legacy per fiocchi avena secchi)
  farro_cooked: 169746, // Spelt, cooked (farro = spelt USDA)
  farro_dry: 169746, // proxy spelt — macro da TS table se mismatch
  quinoa_dry: 168874, // Quinoa, uncooked
  tofu_firm: 172475,
  tempeh: 174272,
  potato_cooked: 170093, // Potatoes, baked, flesh and skin, without salt
  crackers_whole: 174985, // Crackers, wheat, regular

  // Verdure
  mixed_veg: 168462, // Spinach, raw — proxy verdura foglia generica
  spinach_raw: 168462,
  kale_raw: 168421,
  broccoli_raw: 170379,
  bell_pepper_red: 170108,
  asparagus_raw: 168389,
  beetroot_raw: 2685576,
  arugula_raw: 169387,
  zucchini_raw: 169291,
  tomato_raw: 170457,
  carrot_raw: 170393,
  lettuce_romaine: 169247,
  eggplant: 2685577, // Eggplant, raw
  cauliflower: 2685573, // Cauliflower, raw
  green_beans: 2346400, // Beans, snap, green, raw
  mushrooms_white: 169251, // Mushrooms, white, raw
  cucumber: 2346406, // Cucumber, with peel, raw
  fennel: 2747655, // Fennel, bulb, raw
  onion: 170000, // Onions, raw
  leek: 169246, // Leeks, (bulb and lower leaf-portion), raw
  swiss_chard: 169991, // Chard, swiss, raw
  brussels_sprouts: 2685575, // Brussels sprouts, raw
  butternut_squash: 2685570, // Squash, winter, butternut, raw

  // Frutta
  banana: 173944,
  mixed_fruit: 2346411, // Blueberries, raw — proxy frutta rossa ricca
  orange_raw: 169097,
  kiwi_raw: 327046,
  strawberries_raw: 167762,
  apple_raw: 1750340,
  blueberries_raw: 2346411,
  pear_raw: 169118,
  raspberries: 2346410, // Raspberries, raw
  grapes: 174683, // Grapes, red or green (European type), raw
  peach: 325430, // Peaches, yellow, raw (Foundation)
  apricot: 171697, // Apricots, raw
  pineapple: 2346398, // Pineapple, raw
  melon_cantaloupe: 746770, // Melons, cantaloupe, raw
  watermelon: 167765, // Watermelon, raw
  cherries: 171719, // Cherries, sweet, raw
  figs: 173021, // Figs, raw
  dates_medjool: 168191, // Dates, medjool
  tangerine: 169105, // Tangerines, (mandarin oranges), raw
  raisins: 168166, // Raisins, seeded

  // Legumi
  legumes_cooked: 172421, // Lentils, mature seeds, cooked, boiled, without salt
  chickpeas_cooked: 173799,
  beans_white: 175249, // Beans, white, mature seeds, cooked, boiled, with salt
  beans_kidney: 175242, // Beans, kidney, red, mature seeds, cooked, boiled, with salt
  peas_green: 170419, // Peas, green, raw
  edamame: 168411, // Edamame, frozen, prepared

  // Semi / snack
  pumpkin_seeds_raw: 170556,
  almonds_raw: 2346393,
  dark_chocolate_70: 170273,
  walnuts: 170187, // Nuts, walnuts, english
  hazelnuts: 170581, // Nuts, hazelnuts or filberts
  pistachios: 2515379, // Nuts, pistachio nuts, raw
  cashews: 2515374, // Nuts, cashew nuts, raw
  peanut_butter: 2262072, // Peanut butter, creamy
  chia_seeds: 170554, // Seeds, chia seeds, dried
  flaxseed: 169414, // Seeds, flaxseed
  honey: 169640, // Honey
  jam_fruit: 169641, // Jams and preserves
  hummus: 174289, // Hummus, commercial

  // Proteine animali
  egg_whole: 171287,
  egg_white: 172183, // Egg, white, raw, fresh
  chicken_breast: 171077,
  beef_lean: 168608,
  turkey_breast: 171098, // Turkey, whole, breast, meat only, raw
  veal_loin: 173826, // Veal, loin, separable lean only, raw
  rabbit: 172521, // Game meat, rabbit, domesticated, composite of cuts, raw
  lamb_leg: 172486, // Lamb, leg, shank half, separable lean only, raw
  pork_loin: 2646168, // Pork, loin, boneless, raw
  ham_cooked: 332397, // Ham, sliced, pre-packaged, deli meat (96% fat free)
  fish_white: 175167, // Fish, salmon, Atlantic, farmed, raw — proxy pesce ricco di micro/omega
  cod_raw: 171955, // Fish, cod, Atlantic, raw
  tuna_canned: 173708, // Fish, tuna, light, canned in oil, drained solids
  mackerel_atlantic: 175119, // Fish, mackerel, Atlantic, raw
  sardines: 175139, // Fish, sardine, Atlantic, canned in oil, drained solids with bone
  shrimp: 175180, // Crustaceans, shrimp, cooked
  octopus: 174218, // Mollusks, octopus, common, raw
  squid: 174223, // Mollusks, squid, mixed species, raw
  deli_lean: 167876,

  // Latticini
  milk_goat: 171278,
  milk_whole: 746782, // Milk, whole, 3.25% milkfat, with added vitamin D
  yogurt_plain: 171284,
  yogurt_greek: 170903, // Yogurt, Greek, plain, lowfat
  kefir: 170904, // Kefir, lowfat, plain, LIFEWAY
  soymilk: 172446, // Soymilk, original and vanilla, unfortified
  cheese_hard: 171247,
  ricotta_cheese: 170851,
  cottage_cheese: 173417,
  mozzarella: 170847, // Cheese, mozzarella, part skim milk
  feta: 173420, // Cheese, feta

  // Grassi
  olive_oil: 171413,
  avocado: 171705,

  // Senza fdcId (proxy interni — USDA non offre un match diretto rilevante)
  generic_mixed: undefined,
  whey_powder: undefined,
  omega_capsule: undefined,
};

export function fdcIdForCanonicalKey(canonicalKey: string): number | undefined {
  return CANONICAL_FOOD_TO_FDC_ID[canonicalKey];
}

/** Tutti i fdcId noti — utile per pre-caricare la cache USDA in batch. */
export function allKnownFdcIds(): number[] {
  return [...new Set(Object.values(CANONICAL_FOOD_TO_FDC_ID).filter((v): v is number => typeof v === "number"))];
}
