/*
 * specimens.mjs — okazy stworzeń wspólne dla galerii zrzutów i testu wizualnego.
 * Format: [podpis, cechy, nisza, plan budowy (opcjonalnie)].
 */
export const CREATURES = [
  ['Prazwierzę', [], 'woda'],
  ['Filtrator', ['filter_feeding', 'eyes', 'lateral_line'], 'woda'],
  ['Ryba pancerna', ['fins', 'shell', 'jaws', 'eyes'], 'woda'],
  ['Szybka ryba', ['fins', 'fast_muscle', 'jaws', 'scales', 'eyes', 'lateral_line', 'many_eggs'], 'przybrzeze'],
  ['Pierwszy czworonóg', ['fins', 'limbs', 'jaws', 'eyes', 'scales', 'ganglia'], 'przybrzeze'],
  ['Czworonóg lądowy', ['fins', 'limbs', 'jaws', 'eyes', 'scales', 'amniotic_egg', 'camouflage'], 'lad'],
  ['Stałocieplny', ['fins', 'limbs', 'jaws', 'omnivory', 'eyes', 'scales', 'endothermy', 'insulation', 'ganglia', 'brain'], 'lad'],
  ['Ptak', ['fins', 'limbs', 'flight', 'jaws', 'eyes', 'scales', 'endothermy', 'insulation', 'many_eggs', 'parental_care'], 'powietrze'],
  ['Pterozaur', ['fins', 'limbs', 'flight', 'jaws', 'eyes', 'scales', 'endothermy'], 'powietrze'],
  ['Łowca w stadzie', ['fins', 'limbs', 'jaws', 'eyes', 'scales', 'endothermy', 'insulation', 'ganglia', 'brain', 'pack_hunting'], 'lad'],
  ['Gatunek rozumny', ['fins', 'limbs', 'jaws', 'omnivory', 'eyes', 'scales', 'endothermy', 'insulation', 'ganglia', 'brain',
    'big_brain', 'social', 'grasping_hand', 'tool_use', 'parental_care', 'many_eggs'], 'lad'],
  ['Wodny z mózgiem', ['fins', 'eyes', 'ganglia', 'brain', 'jaws', 'camouflage'], 'woda'],
    ['Trylobit', ['shell', 'eyes'], 'woda', 'stawonog'],
  ['Skorupiak', ['fins', 'jaws', 'shell', 'eyes', 'lateral_line'], 'przybrzeze', 'stawonog'],
  ['Pająk lądowy', ['limbs', 'jaws', 'eyes', 'scales', 'camouflage'], 'lad', 'stawonog'],
  ['Ważka', ['limbs', 'flight', 'jaws', 'eyes', 'scales'], 'powietrze', 'stawonog'],
  ['Rozumny stawonóg', ['limbs', 'jaws', 'eyes', 'scales', 'ganglia', 'brain', 'grasping_hand', 'tool_use', 'social'], 'lad', 'stawonog'],
  ['Łodzikowiec', ['shell', 'eyes'], 'woda', 'glowonog'],
  ['Kałamarnica', ['fins', 'jaws', 'eyes', 'fast_muscle', 'lateral_line'], 'woda', 'glowonog'],
  ['Ośmiornica', ['limbs', 'jaws', 'eyes', 'camouflage', 'ganglia', 'brain', 'grasping_hand', 'tool_use'], 'przybrzeze', 'glowonog'],
  ['Szybująca kałamarnica', ['fins', 'flight', 'jaws', 'eyes'], 'powietrze', 'glowonog'],
  // Rzadkie warianty
  ['Jadowity kolczasty', ['fins', 'limbs', 'jaws', 'eyes', 'scales', 'venom', 'spines'], 'lad'],
  ['Świecąca ryba głębin', ['fins', 'jaws', 'eyes', 'bioluminescence', 'electroreception'], 'woda'],
  ['Olbrzym śpiący zimą', ['fins', 'limbs', 'jaws', 'eyes', 'scales', 'endothermy', 'insulation', 'gigantism', 'hibernation'], 'lad'],
  ['Karzeł wyspowy', ['fins', 'limbs', 'jaws', 'eyes', 'scales', 'dwarfism'], 'lad'],
  ['Kolczasty stawonóg', ['shell', 'eyes', 'spines', 'venom'], 'woda', 'stawonog'],
  ['Świecący głowonóg', ['fins', 'jaws', 'eyes', 'bioluminescence', 'electroreception'], 'woda', 'glowonog']
];
