import { Country } from "./countries.model";

export interface CountryGuessColors {
    name: number;
    region: number;
    subregion: number;
    population: number;
    languages: number;
}

export interface GuessRow extends CountryGuessColors {
  country: Country;
}