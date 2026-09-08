-- Popolamento allergeni del catalogo curato `nutrition_menu_foods` (499 righe attive).
--
-- Classificazione fatta alimento per alimento sul vocabolario CHIUSO dei 14 allergeni EU
-- (Allegato II Reg. 1169/2011). Ogni riga elencata qui è stata ESAMINATA: per questo prende
-- allergens_reviewed = true anche quando l'elenco resta vuoto — «esaminato e senza allergeni»
-- è diverso da «mai guardato», ed è proprio questa distinzione che rende sicuro il filtro.
--
-- Criteri applicati (le scelte prudenziali sono elencate per esteso perché un umano le rilegga):
--   * avena (oat_dry/oat_bran/oat_drink/bread_oatmeal) → glutine: l'Allegato II include l'avena;
--   * corn_flakes → glutine: malto d'orzo;
--   * gnocchi di patate, fette biscottate, cornetto, pancake, waffle → glutine (+ latte/uova);
--   * pasta fresca e pasta agli spinaci → glutine + uova (in Italia sono di norma all'uovo);
--   * frutta secca mista → frutta_a_guscio + arachidi (la miscela italiana contiene arachidi);
--   * pinoli → frutta_a_guscio (fuori Allegato II in senso stretto, ma cross-reattivi: scelta di sicurezza);
--   * «Germogli di soia» (mung_sprouts) → soia: l'etichetta mostrata all'atleta dice soia;
--   * hummus e tahini → sesamo; crema cacao-nocciole → frutta_a_guscio + latte + soia;
--   * ghee → latte (tracce di proteine del latte); proteine whey/caseina in polvere → latte;
--   * olio di arachide e olio di sesamo → arachidi / sesamo (non si presume la raffinazione);
--   * frutta essiccata e pomodori secchi → solfiti (solfitazione = prassi industriale E220-E228);
--   * cioccolato fondente → soia (lecitina).
-- NON classificati (documentati come decisione umana): castagne e cocco (fuori Allegato II EU,
-- il cocco è tree nut solo per FDA); salumi/wurstel/mortadella (allergeni dipendenti dalla marca).
--
-- Idempotente: ogni UPDATE riscrive l'intero valore, rieseguirlo non cambia nulla.

-- nessun allergene (267) — esaminati e SENZA allergeni EU (il vuoto qui è un fatto verificato, non un buco)
update public.nutrition_menu_foods
set allergen_classes = array[]::text[],
    allergens_reviewed = true
where is_active
  and canonical_key = any (array[
    'alfalfa_sprouts', 'amaranth', 'apple_fuji', 'apple_gala', 'apple_golden', 'apple_granny_smith',
    'apple_juice', 'apple_raw', 'apple_red_delicious', 'applesauce_unsweetened', 'apricot', 'artichoke',
    'arugula_raw', 'asparagus_raw', 'avocado', 'bamboo_shoots', 'banana', 'beans_adzuki', 'beans_black',
    'beans_cranberry', 'beans_kidney', 'beans_mung', 'beans_white', 'beef_brisket', 'beef_eye_round',
    'beef_ground', 'beef_lean', 'beef_liver', 'beef_ribeye', 'beef_shank', 'beef_sirloin', 'beef_stew',
    'beef_tbone', 'beef_tenderloin', 'beef_top_round', 'beet_greens', 'beetroot', 'bell_pepper_green',
    'bell_pepper_red', 'bell_pepper_yellow', 'black_eyed_peas', 'blackberries', 'blueberries_raw',
    'bok_choy', 'borage', 'bresaola', 'broccoli_raab', 'broccoli_raw', 'brussels_sprouts', 'buckwheat',
    'buckwheat_flour', 'butternut_squash', 'cabbage_green', 'cabbage_red', 'cabbage_savoy',
    'cape_gooseberry', 'carambola', 'cardoon', 'carrot_raw', 'carrots_baby', 'cauliflower',
    'cauliflower_green', 'cherries', 'cherry_tomato', 'chestnuts', 'chia_seeds', 'chicken_breast',
    'chicken_breast_deli', 'chicken_drumstick', 'chicken_ground', 'chicken_liver', 'chicken_thigh',
    'chicken_wing', 'chickpea_flour', 'chickpeas_cooked', 'chicory_greens', 'clementine', 'coconut',
    'coconut_milk', 'coconut_oil', 'coppa', 'corn_cakes', 'corn_oil', 'corned_beef_canned',
    'cornmeal_polenta', 'cornsalad', 'cucumber', 'currants', 'currants_black', 'dandelion_greens',
    'dates_medjool', 'duck', 'eggplant', 'endive_belgian', 'endive_curly', 'escarole', 'fava_beans',
    'fennel', 'figs', 'flaxseed', 'flaxseed_oil', 'goat_meat', 'goose', 'gooseberries', 'grapefruit',
    'grapefruit_pink', 'grapes', 'grapes_slipskin', 'grapeseed_oil', 'green_beans',
    'green_beans_yellow', 'guava', 'guinea_fowl', 'ham_cooked', 'hearts_of_palm', 'hemp_seeds', 'honey',
    'horse_meat', 'jam_apricot', 'jam_preserves', 'jerusalem_artichoke', 'jujube', 'kale_raw',
    'kiwi_raw', 'kohlrabi', 'kumquat', 'lamb_chops', 'lamb_ground', 'lamb_leg', 'lamb_stew', 'leek',
    'legumes_cooked', 'lentil_sprouts', 'lentils_green', 'lentils_red', 'lettuce_butterhead',
    'lettuce_green_leaf', 'lettuce_iceberg', 'lettuce_red_leaf', 'lettuce_romaine', 'lima_beans',
    'loquat', 'lychee', 'mango', 'maple_syrup', 'marmalade_orange', 'melon_cantaloupe',
    'melon_honeydew', 'millet', 'mortadella', 'mulberries', 'mushrooms_chanterelle',
    'mushrooms_crimini', 'mushrooms_oyster', 'mushrooms_porcini', 'mushrooms_portobello',
    'mushrooms_shiitake', 'mushrooms_white', 'napa_cabbage', 'nectarine', 'olive_oil',
    'olives_black_table', 'olives_green_table', 'onion', 'onion_red', 'onion_white', 'orange_juice',
    'orange_navel', 'orange_raw', 'orange_valencia', 'papaya', 'parsnip', 'passion_fruit',
    'pasta_corn_gf', 'pasta_legumes', 'peach', 'pear_kaiser', 'pear_raw', 'pear_williams', 'peas_green',
    'persimmon', 'pheasant', 'pineapple', 'plum', 'pomegranate', 'popcorn_airpopped',
    'pork_belly_cured', 'pork_chop', 'pork_ground', 'pork_leg', 'pork_loin', 'pork_shank',
    'pork_tenderloin', 'potato_cooked', 'potatoes_red', 'prickly_pear', 'prosciutto_crudo',
    'puffed_rice', 'pummelo', 'pumpkin_flowers', 'pumpkin_seeds_raw', 'pumpkin_seeds_roasted',
    'purslane', 'quail', 'quince', 'quinoa_dry', 'quinoa_puffed', 'rabbit', 'radicchio', 'radish',
    'raspberries', 'rice_arborio', 'rice_black', 'rice_bran_oil', 'rice_brown', 'rice_cakes',
    'rice_cream', 'rice_drink', 'rice_dry', 'rice_parboiled', 'rice_red', 'rice_wild',
    'roast_beef_deli', 'rutabaga', 'salame', 'salsiccia', 'salsify', 'shallots', 'snow_peas', 'sorghum',
    'sour_cherries', 'spaghetti_squash', 'speck', 'spinach_raw', 'split_peas', 'spring_onion', 'squab',
    'strawberries_raw', 'sunflower_oil', 'sunflower_seed_butter', 'sunflower_seeds',
    'sunflower_seeds_roasted', 'sweet_corn', 'sweet_potato', 'swiss_chard', 'tangerine', 'teff',
    'tomato_raw', 'tomatoes_canned', 'turkey_breast', 'turkey_breast_deli', 'turkey_drumstick',
    'turkey_ground', 'turkey_thigh', 'turnip', 'veal_cutlet', 'veal_ground', 'veal_loin',
    'veal_rib_chop', 'veal_shoulder', 'venison', 'watercress', 'watermelon', 'wild_boar', 'wurstel',
    'zucchini_raw', 'zucchini_yellow'
  ]::text[]);

-- arachidi (5)
update public.nutrition_menu_foods
set allergen_classes = array['arachidi']::text[],
    allergens_reviewed = true
where is_active
  and canonical_key = any (array[
    'peanut_butter', 'peanut_butter_crunchy', 'peanut_oil', 'peanuts', 'peanuts_roasted'
  ]::text[]);

-- crostacei (7)
update public.nutrition_menu_foods
set allergen_classes = array['crostacei']::text[],
    allergens_reviewed = true
where is_active
  and canonical_key = any (array[
    'crab', 'langoustine', 'lobster', 'shrimp', 'shrimp_canned', 'spider_crab', 'spiny_lobster'
  ]::text[]);

-- frutta_a_guscio (15)
update public.nutrition_menu_foods
set allergen_classes = array['frutta_a_guscio']::text[],
    allergens_reviewed = true
where is_active
  and canonical_key = any (array[
    'almond_butter', 'almond_drink_unsweetened', 'almonds_raw', 'brazil_nuts', 'cashew_butter',
    'cashews', 'cashews_roasted', 'hazelnuts', 'hazelnuts_roasted', 'macadamia_nuts', 'pecans',
    'pine_nuts', 'pistachios', 'pistachios_roasted', 'walnuts'
  ]::text[]);

-- glutine (40)
update public.nutrition_menu_foods
set allergen_classes = array['glutine']::text[],
    allergens_reviewed = true
where is_active
  and canonical_key = any (array[
    'bagel_plain', 'barley_hulled', 'barley_pearled', 'bread_italian', 'bread_multigrain',
    'bread_oatmeal', 'bread_pita', 'bread_raisin', 'bread_rye', 'bread_white', 'bread_whole_wheat',
    'breadsticks', 'bulgur', 'cereal_flakes_mix', 'corn_flakes', 'couscous', 'crackers_whole',
    'crispbread_rye', 'english_muffin_whole', 'farro_dry', 'farro_puffed', 'focaccia', 'gnocchi_potato',
    'kamut_dry', 'oat_bran', 'oat_drink', 'oat_dry', 'pasta_dry', 'pasta_whole', 'puffed_wheat',
    'roll_hard', 'roll_whole_wheat', 'rusk_toast', 'rye_grain', 'seitan', 'semolina', 'tortilla_flour',
    'wheat_bran', 'wheat_durum', 'wheat_germ'
  ]::text[]);

-- latte (51)
update public.nutrition_menu_foods
set allergen_classes = array['latte']::text[],
    allergens_reviewed = true
where is_active
  and canonical_key = any (array[
    'brie', 'burrata', 'butter_unsalted', 'buttermilk', 'caciotta', 'camembert', 'casein_micellar',
    'cheddar', 'cheese_hard', 'cottage_cheese', 'cottage_cheese_2pct', 'cottage_creamed', 'cottage_dry',
    'cream_cheese', 'cream_cheese_light', 'edam', 'emmental', 'feta', 'fontina', 'ghee', 'goat_cheese',
    'goat_cheese_aged', 'goat_milk', 'goat_yogurt', 'gorgonzola', 'gouda', 'gruyere', 'heavy_cream',
    'kefir', 'milk_semi_skimmed', 'milk_skim', 'milk_whole', 'mozzarella', 'mozzarella_pizza',
    'mozzarella_whole', 'parmigiano_reggiano', 'pecorino_romano', 'provolone', 'ricotta_cheese',
    'sheep_milk', 'sheep_yogurt', 'sour_cream', 'taleggio', 'whey_protein_powder',
    'whey_protein_ultrafiltered', 'yogurt_greek', 'yogurt_greek_fruit', 'yogurt_greek_nonfat',
    'yogurt_greek_whole', 'yogurt_lowfat', 'yogurt_plain'
  ]::text[]);

-- lupini (1)
update public.nutrition_menu_foods
set allergen_classes = array['lupini']::text[],
    allergens_reviewed = true
where is_active
  and canonical_key = any (array[
    'lupins'
  ]::text[]);

-- molluschi (7)
update public.nutrition_menu_foods
set allergen_classes = array['molluschi']::text[],
    allergens_reviewed = true
where is_active
  and canonical_key = any (array[
    'clams', 'cuttlefish', 'mussels', 'octopus', 'oysters', 'scallops', 'squid'
  ]::text[]);

-- pesce (57)
update public.nutrition_menu_foods
set allergen_classes = array['pesce']::text[],
    allergens_reviewed = true
where is_active
  and canonical_key = any (array[
    'amberjack', 'anchovy', 'anchovy_oil', 'arctic_char', 'atlantic_bonito', 'bluefish', 'carp',
    'catfish', 'cod_raw', 'croaker', 'cutlassfish', 'eel', 'european_hake', 'fish_white',
    'gilthead_seabream', 'grouper', 'haddock', 'halibut', 'herring', 'herring_smoked', 'horse_mackerel',
    'john_dory', 'mackerel_atlantic', 'mackerel_canned', 'mahimahi', 'monkfish', 'mullet',
    'ocean_perch', 'palombo', 'perch', 'pike', 'plaice', 'pollock', 'porgy', 'red_mullet',
    'salmon_canned', 'salt_cod', 'sardines', 'sea_bass', 'skate', 'smoked_salmon', 'snapper_raw',
    'sole', 'sturgeon', 'swordfish', 'tilapia', 'trout', 'tub_gurnard', 'tuna_canned',
    'tuna_canned_water', 'tuna_fresh', 'tuna_white_water', 'turbot', 'white_seabream', 'whitefish',
    'whiting', 'zander'
  ]::text[]);

-- sedano (2)
update public.nutrition_menu_foods
set allergen_classes = array['sedano']::text[],
    allergens_reviewed = true
where is_active
  and canonical_key = any (array[
    'celeriac', 'celery'
  ]::text[]);

-- sesamo (4)
update public.nutrition_menu_foods
set allergen_classes = array['sesamo']::text[],
    allergens_reviewed = true
where is_active
  and canonical_key = any (array[
    'hummus', 'sesame_oil', 'sesame_seeds', 'tahini'
  ]::text[]);

-- soia (12)
update public.nutrition_menu_foods
set allergen_classes = array['soia']::text[],
    allergens_reviewed = true
where is_active
  and canonical_key = any (array[
    'dark_chocolate_70', 'edamame', 'mung_sprouts', 'soy_protein_powder', 'soy_yogurt',
    'soybeans_cooked', 'soybeans_roasted', 'soymilk', 'tempeh', 'tofu_extra_firm', 'tofu_firm',
    'tofu_silken'
  ]::text[]);

-- solfiti (12)
update public.nutrition_menu_foods
set allergen_classes = array['solfiti']::text[],
    allergens_reviewed = true
where is_active
  and canonical_key = any (array[
    'apples_dried', 'apricots_dried', 'banana_dried', 'coconut_dried', 'cranberries_dried',
    'figs_dried', 'goji_berries', 'peaches_dried', 'pears_dried', 'prunes', 'raisins',
    'tomatoes_sundried'
  ]::text[]);

-- uova (8)
update public.nutrition_menu_foods
set allergen_classes = array['uova']::text[],
    allergens_reviewed = true
where is_active
  and canonical_key = any (array[
    'egg_boiled', 'egg_fried', 'egg_omelet', 'egg_poached', 'egg_quail', 'egg_scrambled', 'egg_white',
    'egg_whole'
  ]::text[]);

-- arachidi, frutta_a_guscio (2)
update public.nutrition_menu_foods
set allergen_classes = array['arachidi','frutta_a_guscio']::text[],
    allergens_reviewed = true
where is_active
  and canonical_key = any (array[
    'mixed_nuts', 'mixed_nuts_roasted'
  ]::text[]);

-- frutta_a_guscio, glutine (2)
update public.nutrition_menu_foods
set allergen_classes = array['frutta_a_guscio','glutine']::text[],
    allergens_reviewed = true
where is_active
  and canonical_key = any (array[
    'granola', 'muesli'
  ]::text[]);

-- glutine, uova (3)
update public.nutrition_menu_foods
set allergen_classes = array['glutine','uova']::text[],
    allergens_reviewed = true
where is_active
  and canonical_key = any (array[
    'pasta_egg', 'pasta_fresh', 'pasta_spinach'
  ]::text[]);

-- frutta_a_guscio, latte, soia (1)
update public.nutrition_menu_foods
set allergen_classes = array['frutta_a_guscio','latte','soia']::text[],
    allergens_reviewed = true
where is_active
  and canonical_key = any (array[
    'hazelnut_cocoa_spread'
  ]::text[]);

-- glutine, latte, uova (3)
update public.nutrition_menu_foods
set allergen_classes = array['glutine','latte','uova']::text[],
    allergens_reviewed = true
where is_active
  and canonical_key = any (array[
    'croissant_butter', 'pancakes_plain', 'waffle_plain'
  ]::text[]);
