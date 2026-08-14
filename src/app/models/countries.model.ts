export interface CountryCurrency {
  code: string;
  name: string;
  symbol: string;
}

export interface CountryLanguage {
  iso639_1: string;
  name: string;
}

export interface CountryFlags {
  png: string;
  svg: string;
}

export interface Country {
  name: string;
  alpha2Code: string;
  alpha3Code: string;

  // missing on some small countries
  capital?: string;
  area?: number;

  region: string;
  subregion: string;
  population: number;
  populationDensity: number;

  currencies: CountryCurrency[];
  languages: CountryLanguage[];

  callingCodes: string[];
  borders?: string[];

  flags: CountryFlags;   // png/svg URLs
  flag: string;          // emoji, not a URL

  nativeName: string;
  latlng: [number, number];
  timezones: string[];
  demonym: string;
}