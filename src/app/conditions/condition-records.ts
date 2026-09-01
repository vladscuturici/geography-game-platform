// conditions/condition-records.ts

export enum ConditionCategory {
  Population = 'population',
  Region = 'region',
  Subregion = 'subregion',
  Borders = 'borders',
  Language = 'language',
  Wildcard = 'wildcard',
}

export const CATEGORY_LABELS: Record<ConditionCategory, string> = {
  [ConditionCategory.Population]: 'Population',
  [ConditionCategory.Region]: 'Region',
  [ConditionCategory.Subregion]: 'Subregion',
  [ConditionCategory.Borders]: 'Borders',
  [ConditionCategory.Language]: 'Language',
  [ConditionCategory.Wildcard]: 'Wildcards',
};

export interface ConditionRecord {
  id: string;
  label: string;
  category: ConditionCategory;
  symbol: string;
}

const PLACEHOLDER_SYMBOL = './64.png';

export const CONDITION_RECORDS: ConditionRecord[] = [
  // population
  { id: 'pop-gt-100m', label: 'Population above 100,000,000', category: ConditionCategory.Population, symbol: './o100m.png' },
  { id: 'pop-gt-50m', label: 'Population above 50,000,000', category: ConditionCategory.Population, symbol: './o50m.png' },
  { id: 'pop-gt-10m', label: 'Population above 10,000,000', category: ConditionCategory.Population, symbol: './o10m.png' },
  { id: 'pop-lt-10m', label: 'Population under 10,000,000', category: ConditionCategory.Population, symbol: './u10m.png' },
  { id: 'pop-lt-5m', label: 'Population under 5,000,000', category: ConditionCategory.Population, symbol: './u5m.png' },
  { id: 'pop-lt-1m', label: 'Population under 1,000,000', category: ConditionCategory.Population, symbol: './u1m.png' },

  // region
  { id: 'region-africa', label: 'From Africa', category: ConditionCategory.Region, symbol: './reg.png' },
  { id: 'region-americas', label: 'From Americas', category: ConditionCategory.Region, symbol: './reg.png' },
  { id: 'region-asia', label: 'From Asia', category: ConditionCategory.Region, symbol: './reg.png' },
  { id: 'region-europe', label: 'From Europe', category: ConditionCategory.Region, symbol: './reg.png' },
  { id: 'region-oceania', label: 'From Oceania', category: ConditionCategory.Region, symbol: './reg.png' },

  // subregion
  { id: 'subregion-caribbean', label: 'From Caribbean', category: ConditionCategory.Subregion, symbol: './reg.png' },
  { id: 'subregion-central-america', label: 'From Central America', category: ConditionCategory.Subregion, symbol: './reg.png' },
  { id: 'subregion-north-america', label: 'From North America', category: ConditionCategory.Subregion, symbol: './reg.png' },
  { id: 'subregion-south-america', label: 'From South America', category: ConditionCategory.Subregion, symbol: './reg.png' },

  { id: 'crossed-equator', label: 'Crossed by the Equator', category: ConditionCategory.Subregion, symbol: './eq.png' },
  { id: 'crossed-tropic', label: 'Crossed by a Tropic', category: ConditionCategory.Subregion, symbol: './tropics.png' },
  { id: 'hemisphere-north', label: 'Northern Hemisphere', category: ConditionCategory.Subregion, symbol: './north.png' },
  { id: 'hemisphere-south', label: 'Southern Hemisphere', category: ConditionCategory.Subregion, symbol: './south.png' },
  { id: 'crossed-prime-meridian', label: 'Crossed by Prime Meridian', category: ConditionCategory.Subregion, symbol: './pm.png' },
  { id: 'crossed-arctic-circle', label: 'Crossed by Arctic Circle', category: ConditionCategory.Subregion, symbol: './arctic.png' },
  { id: 'crossed-danube', label: 'Crossed by Danube river', category: ConditionCategory.Subregion, symbol: './danube.png' },
  { id: 'part-of-sahara', label: 'Part of the Sahara Desert', category: ConditionCategory.Subregion, symbol: './sahara.png' },

  // borders
  { id: 'borders-russia', label: 'Borders Russia', category: ConditionCategory.Borders, symbol: './rus.png' },
  { id: 'borders-china', label: 'Borders China', category: ConditionCategory.Borders, symbol: './chn.png' },
  { id: 'borders-brazil', label: 'Borders Brazil', category: ConditionCategory.Borders, symbol: './bra.png' },
  { id: 'borders-france', label: 'Borders France', category: ConditionCategory.Borders, symbol: './fra.png' },
  { id: 'min-neighbors-6', label: 'Has at least 6 neighbors', category: ConditionCategory.Borders, symbol: './min6.png' },
  { id: 'no-land-borders', label: 'Has no land borders', category: ConditionCategory.Borders, symbol: './none.png' },
  { id: 'single-land-border', label: 'Has a single land neighbor', category: ConditionCategory.Borders, symbol: './1n.png' },
  { id: 'borders-mediterranean', label: 'Borders the Mediterranean Sea', category: ConditionCategory.Borders, symbol: './med.png' },

  // language
  { id: 'speaks-arabic', label: 'Arabic is an official language', category: ConditionCategory.Language, symbol: './ara.png' },
  { id: 'speaks-english', label: 'English is an official language', category: ConditionCategory.Language, symbol: './eng.png' },
  { id: 'speaks-french', label: 'French is an official language', category: ConditionCategory.Language, symbol: './francais.png' },
  { id: 'speaks-german', label: 'German is an official language', category: ConditionCategory.Language, symbol: './deu.png' },
  { id: 'speaks-portuguese', label: 'Portuguese is an official language', category: ConditionCategory.Language, symbol: './por.png' },
  { id: 'speaks-russian', label: 'Russian is an official language', category: ConditionCategory.Language, symbol: './russian.png' },
  { id: 'speaks-spanish', label: 'Spanish is an official language', category: ConditionCategory.Language, symbol: './esp.png' },
  { id: 'script-cyrillic', label: 'Uses Cyrillic script', category: ConditionCategory.Language, symbol: './cyr.png' },
  { id: 'script-latin', label: 'Uses Latin script', category: ConditionCategory.Language, symbol: './lat.png' },
  { id: 'script-arabic', label: 'Uses Arabic script', category: ConditionCategory.Language, symbol: './aras.png' },

  // wildcards
  { id: 'capital-b', label: 'Capital starts with "B"', category: ConditionCategory.Wildcard, symbol: './b.png' },
  { id: 'capital-s', label: 'Capital starts with "S"', category: ConditionCategory.Wildcard, symbol: './s.png' },
  { id: 'capital-m', label: 'Capital starts with "M"', category: ConditionCategory.Wildcard, symbol: './m.png' },
  { id: 'eu-member', label: 'EU member', category: ConditionCategory.Wildcard, symbol: './eu.png' },
  { id: 'nato-member', label: 'NATO member', category: ConditionCategory.Wildcard, symbol: './nato.png' },
  { id: 'uses-euro', label: 'Uses the Euro', category: ConditionCategory.Wildcard, symbol: './euro.png' },
  { id: 'left-hand-traffic', label: 'Left-Hand Traffic', category: ConditionCategory.Wildcard, symbol: './left.png' },
  { id: 'independence-after-1990', label: 'Independence declared after 1/1/1990', category: ConditionCategory.Wildcard, symbol: './90.png' },
  { id: 'is-landlocked', label: 'is Landlocked', category: ConditionCategory.Wildcard, symbol: './landlocked.png' },
  { id: 'point-above-3km', label: 'Has A Point Above 3.000m', category: ConditionCategory.Wildcard, symbol: './3000m.png' },
  { id: 'is-monarchy', label: 'is Monarchy', category: ConditionCategory.Wildcard, symbol: './mon.png' },
  { id: 'is-republic', label: 'is Republic', category: ConditionCategory.Wildcard, symbol: './rep.png' },

];