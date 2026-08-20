import { Country, CountryLanguage } from '../models/countries.model';
import {
    allEuroUsingCountries,
    arabicScriptCountries,
    cyrillicScriptCountries,
    equatorCountries,
    euCountries,
    latinScriptCountries,
    natoCountries,
    tropicCountries,
    arabicSpeakingCountries,
    englishSpeakingCountries,
    frenchSpeakingCountries,
    germanSpeakingCountries,
    portugueseSpeakingCountries,
    russianSpeakingCountries,
    spanishSpeakingCountries,
} from './country-data';

/**
 * Base class for every tic-tac-toe game condition.
 *
 * Each concrete Condition takes whatever parameters it needs in its
 * constructor and exposes a single-argument `check(country)` so the game
 * board can treat every condition uniformly, regardless of how many
 * parameters the original standalone function needed.
 */
export abstract class Condition {
    /** Evaluate whether `country` satisfies this condition. */
    public abstract check(country: Country): boolean;

    /** Human-readable label for displaying the condition on the board. */
    public abstract toString(): string;
}

// ---------------------------------------------------------------------
export class AboveXPopulationCondition extends Condition {
    constructor(private readonly x: number) {
        super();
    }

    public check(country: Country): boolean {
        return country.population > this.x;
    }

    public toString(): string {
        return `Population above ${this.x.toLocaleString()}`;
    }
}

// ---------------------------------------------------------------------
export class UnderXPopulationCondition extends Condition {
    constructor(private readonly x: number) {
        super();
    }

    public check(country: Country): boolean {
        return country.population < this.x;
    }

    public toString(): string {
        return `Population under ${this.x.toLocaleString()}`;
    }
}

// ---------------------------------------------------------------------
export class FromRegionCondition extends Condition {
    constructor(private readonly region: string) {
        super();
    }

    public check(country: Country): boolean {
        return country.region === this.region;
    }

    public toString(): string {
        return `From ${this.region}`;
    }
}

// ---------------------------------------------------------------------
export class FromSubregionCondition extends Condition {
    constructor(private readonly subregion: string) {
        super();
    }

    public check(country: Country): boolean {
        return country.subregion === this.subregion;
    }

    public toString(): string {
        return `From ${this.subregion}`;
    }
}

// ---------------------------------------------------------------------
export class SpeaksSpanishCondition extends Condition {
    public check(country: Country): boolean {
        return spanishSpeakingCountries.includes(country.name);
    }

    public toString(): string {
        return 'Speaks Spanish';
    }
}

// ---------------------------------------------------------------------
export class SpeaksFrenchCondition extends Condition {
    public check(country: Country): boolean {
        return frenchSpeakingCountries.includes(country.name);
    }

    public toString(): string {
        return 'Speaks French';
    }
}

// ---------------------------------------------------------------------
export class SpeaksGermanCondition extends Condition {
    public check(country: Country): boolean {
        return germanSpeakingCountries.includes(country.name);
    }

    public toString(): string {
        return 'Speaks German';
    }
}

// ---------------------------------------------------------------------
export class SpeaksPortugueseCondition extends Condition {
    public check(country: Country): boolean {
        return portugueseSpeakingCountries.includes(country.name);
    }

    public toString(): string {
        return 'Speaks Portuguese';
    }
}

// ---------------------------------------------------------------------
export class SpeaksRussianCondition extends Condition {
    public check(country: Country): boolean {
        return russianSpeakingCountries.includes(country.name);
    }

    public toString(): string {
        return 'Speaks Russian';
    }
}

// ---------------------------------------------------------------------
export class SpeaksEnglishCondition extends Condition {
    public check(country: Country): boolean {
        return englishSpeakingCountries.includes(country.name);
    }

    public toString(): string {
        return 'Speaks English';
    }
}

// ---------------------------------------------------------------------
export class SpeaksArabicCondition extends Condition {
    public check(country: Country): boolean {
        return arabicSpeakingCountries.includes(country.name);
    }

    public toString(): string {
        return 'Speaks Arabic';
    }
}

// ---------------------------------------------------------------------
export class UsesEuroCondition extends Condition {
    public check(country: Country): boolean {
        return allEuroUsingCountries.includes(country.alpha2Code);
    }

    public toString(): string {
        return 'Uses the Euro';
    }
}

// ---------------------------------------------------------------------
export class IsNatoCondition extends Condition {
    public check(country: Country): boolean {
        return natoCountries.includes(country.alpha2Code);
    }

    public toString(): string {
        return 'NATO member';
    }
}

// ---------------------------------------------------------------------
export class IsEuCondition extends Condition {
    public check(country: Country): boolean {
        return euCountries.includes(country.alpha2Code);
    }

    public toString(): string {
        return 'EU member';
    }
}

// ---------------------------------------------------------------------
export class BordersXCondition extends Condition {
    constructor(private readonly x: Country) {
        super();
    }

    public check(country: Country): boolean {
        if (this.x.borders) {
            return this.x.borders.includes(country.alpha3Code);
        }
        return false;
    }

    public toString(): string {
        return `Borders ${this.x.name}`;
    }
}

// ---------------------------------------------------------------------
export class IsCrossedByEquatorCondition extends Condition {
    public check(country: Country): boolean {
        return equatorCountries.includes(country.alpha2Code);
    }

    public toString(): string {
        return 'Crossed by the Equator';
    }
}

// ---------------------------------------------------------------------
export class IsCrossedByTropicsCondition extends Condition {
    public check(country: Country): boolean {
        return tropicCountries.includes(country.alpha2Code);
    }

    public toString(): string {
        return 'Crossed by a Tropic';
    }
}

// ---------------------------------------------------------------------
export class HasNoLandBordersCondition extends Condition {
    public check(country: Country): boolean {
        return !country.borders || country.borders.length === 0;
    }

    public toString(): string {
        return 'Has no land borders';
    }
}

// ---------------------------------------------------------------------
export class HasMinNeighborsCondition extends Condition {
    constructor(private readonly x: number) {
        super();
    }

    public check(country: Country): boolean {
        return (country.borders?.length ?? 0) >= this.x;
    }

    public toString(): string {
        return `Has at least ${this.x} neighbor${this.x === 1 ? '' : 's'}`;
    }
}

// ---------------------------------------------------------------------
export class CapitalStartsWithCondition extends Condition {
    constructor(private readonly letter: string) {
        super();
    }

    public check(country: Country): boolean {
        return !!country.capital && country.capital.toUpperCase().startsWith(this.letter.toUpperCase());
    }

    public toString(): string {
        return `Capital starts with "${this.letter.toUpperCase()}"`;
    }
}

// ---------------------------------------------------------------------
export class UsesLatinScriptCondition extends Condition {
    public check(country: Country): boolean {
        return latinScriptCountries.includes(country.alpha2Code);
    }

    public toString(): string {
        return 'Uses Latin script';
    }
}

// ---------------------------------------------------------------------
export class UsesArabicScriptCondition extends Condition {
    public check(country: Country): boolean {
        return arabicScriptCountries.includes(country.alpha2Code);
    }

    public toString(): string {
        return 'Uses Arabic script';
    }
}

// ---------------------------------------------------------------------
export class UsesCyrillicScriptCondition extends Condition {
    public check(country: Country): boolean {
        return cyrillicScriptCountries.includes(country.alpha2Code);
    }

    public toString(): string {
        return 'Uses Cyrillic script';
    }
}

// ---------------------------------------------------------------------
export class IsNorthernHemisphereCondition extends Condition {
    public check(country: Country): boolean {
        if (equatorCountries.includes(country.alpha2Code)) return true;
        return !!country.latlng && country.latlng[0] > 0;
    }

    public toString(): string {
        return 'Northern Hemisphere';
    }
}

// ---------------------------------------------------------------------
export class IsSouthernHemisphereCondition extends Condition {
    public check(country: Country): boolean {
        if (equatorCountries.includes(country.alpha2Code)) return true;
        return !!country.latlng && country.latlng[0] < 0;
    }

    public toString(): string {
        return 'Southern Hemisphere';
    }
}

export const ConditionLabels: readonly string[] = [
  //population
  "Population above 100,000,000", //Symbol should be >100M
  "Population above 50,000,000", //Symbol should be >50M
  "Population above 10,000,000", //Symbol should be >10M
  "Population under 10,000,000", //Symbol should be <10M
  "Population under 5,000,000", //...
  "Population under 1,000,000",

  //region
  "From Africa", //for all regions maybe a world map
  "From Americas",
  "From Asia",
  "From Europe",
  "From Oceania",

  //subregion
  "From Caribbean", //same as regions
  "From Central America",
  "From Central Asia",
  "From Central Europe",
  "From Eastern Africa",
  "From Eastern Asia",
  "From Eastern Europe",
  "From Melanesia",
  "From Micronesia",
  "From Middle Africa",
  "From North America",
  "From Northern Africa",
  "From Northern America",
  "From Northern Europe",
  "From Polynesia",
  "From South America",
  "From South-Eastern Asia",
  "From Southern Africa",
  "From Southern Asia",
  "From Southern Europe",
  "From Western Africa",
  "From Western Asia",
  "From Western Europe",
  "Crossed by the Equator",
  "Crossed by a Tropic",
  "Northern Hemisphere",
  "Southern Hemisphere",
  
  //borders
  "Borders Russian Federation", //russia flag
  "Borders China", //china flag etc...
  "Borders Brazil",
  "Borders France",
  "Has at least 6 neighbors",
  "Has no land borders",

  //language
  "Speaks Arabic", //'arabic' in arabic
  "Speaks English", //'english' in english etc
  "Speaks French",
  "Speaks German",
  "Speaks Portuguese",
  "Speaks Russian",
  "Speaks Spanish",
  "Uses Cyrillic script", //'cyrillic' in cyrillic (russian)
  "Uses Latin script", //'latin'
  "Uses Arabic script", //'arabic' in arabic script
  
  //wildcards
  'Capital starts with "B"', //letter 'B' etc...
  'Capital starts with "S"',
  'Capital starts with "M"',
  "EU member", //EU flag
  "NATO member", //NATO flag
  "Uses the Euro", //euro currency
];