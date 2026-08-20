import { inject, Service } from '@angular/core';
import { Country, CountryLanguage } from '../models/countries.model';
import { CountryGuessColors, LocateCityScoreDetails } from '../models/game.model';
import { HttpClient } from '@angular/common/http';
import { catchError, combineLatest, map, mapTo, Observable, shareReplay, tap } from 'rxjs';
import {
    AboveXPopulationCondition,
    UnderXPopulationCondition,
    BordersXCondition,
    CapitalStartsWithCondition,
    Condition,
    FromRegionCondition,
    FromSubregionCondition,
    HasMinNeighborsCondition,
    HasNoLandBordersCondition,
    IsCrossedByEquatorCondition,
    IsCrossedByTropicsCondition,
    IsEuCondition,
    IsNatoCondition,
    IsNorthernHemisphereCondition,
    IsSouthernHemisphereCondition,
    SpeaksArabicCondition,
    SpeaksEnglishCondition,
    SpeaksFrenchCondition,
    SpeaksGermanCondition,
    SpeaksPortugueseCondition,
    SpeaksRussianCondition,
    SpeaksSpanishCondition,
    UsesArabicScriptCondition,
    UsesCyrillicScriptCondition,
    UsesEuroCondition,
    UsesLatinScriptCondition,
} from '../conditions/conditions';
import { regions, subregions } from '../conditions/country-data';
import { CountriesService } from './countries.service';

//answer will be a number between 0 and 100 representing the percentage of saturation
// gray - incorrect, green - correct, shades inbetween - partial answer
// name -> will be wrong unless you choose the country
// region -> will be wrong unless you choose a country from the same region
// subregion -> will be wrong unless you choose a country from the same subregion
// population -> will be colored based on how far the number is from the correct country population (ex. if correct population is 2mil, 100mil country -> very unsaturated green,
// 2.5 mil country -> slightly less saturated green
// languages -> will be wrong unless you choose a country that share a languages with the answer (green - exact match, unsaturated green - shared language/languages)

export interface ConditionsMatrix {
  conditions: string[];
  matrix: string[][][];
}

@Service()
export class GameService {
    private _countriesService = inject(CountriesService);
    //http injection
    private _httpClient = inject(HttpClient);

    private _tictactoeConditionMatrixPath = './tictactoe_condition_matrix.json';
    private _apiUrl = 'https://countries.dev';

    private _conditionsMatrix$ = this._httpClient
    .get<ConditionsMatrix>(this._tictactoeConditionMatrixPath)
    .pipe(
        tap(data => console.log('✅ matrix loaded', data.conditions.length, 'conditions')),
        catchError(err => {
        console.error('❌ matrix HTTP request failed:', err);
        throw err;
        }),
        shareReplay(1)
    );

    private getPopulationScore(population_correct: number, population_compared: number): number {
        const difference = Math.abs(population_correct - population_compared);
        const score = 100 - (difference / population_correct) * 100;

        return Math.max(0, Math.floor(score));
    }

    private getLanguageScore(languagesCorrect: CountryLanguage[], languagesCompared: CountryLanguage[]): number {
        const sharedCount = languagesCorrect.filter(correctLang =>
            languagesCompared.some(comparedLang => comparedLang.iso639_1 === correctLang.iso639_1)
        ).length;

        if (sharedCount === 0) 
            return 0;

        const isExactMatch = sharedCount === languagesCorrect.length && sharedCount === languagesCompared.length;

        return isExactMatch ? 100 : 50;
    }

    public compareCountryGuess(country_correct: Country, country_compared: Country): CountryGuessColors {
        return { 
            name: (country_correct.name === country_compared.name) ? 100 : 0,
            region: (country_correct.region === country_compared.region) ? 100 : 0,
            subregion: (country_correct.subregion === country_compared.subregion) ? 100 : 0,
            population: this.getPopulationScore(country_correct.population, country_compared.population),
            languages: this.getLanguageScore(country_correct.languages, country_compared.languages)
        }
    }

    public narrowItDownScore(correct: number, range_a: number, range_b: number): number {
        if (correct < range_a || correct > range_b) return 0;

        const k = 2.2; 
        const logWidth = Math.log10(range_b) - Math.log10(range_a);
        const score = 100 * (1 / (1 + k * logWidth));

        return Math.floor(score);
    }

    public getDistance(lat1: number, lng1: number, lat2: number, lng2: number): Observable<{ distanceKm: number; distanceMiles: number }> {
        return this._httpClient.get<{ distanceKm: number; distanceMiles: number }>(
            `https://countries.dev/distance?lat1=${lat1}&lng1=${lng1}&lat2=${lat2}&lng2=${lng2}`
        );
    }

    public locateCityScore(
        correctLat: number,
        correctLong: number,
        guessLat: number,
        guessLong: number
        ): Observable<LocateCityScoreDetails> {
        return this.getDistance(correctLat, correctLong, guessLat, guessLong).pipe(
            map((result) => {
                const distance = result.distanceKm;
                const k = 3; 
                const score = distance > 2000 ? 0 : (Math.floor(100 * Math.exp(-k * (distance / 2000))));

                return {
                    distance,
                    score,
                };
            })
        );
    }

    private _getMatchingCountries(data: ConditionsMatrix, condition1: string, condition2: string): string[] {
        const i = data.conditions.indexOf(condition1);
        const j = data.conditions.indexOf(condition2);

        if (i === -1 || j === -1) {
            throw new Error(`Unknown condition: ${i === -1 ? condition1 : condition2}`);
        }

        return data.matrix[i]?.[j] ?? [];
    }

    public isValidColumnRowCombination(condition1: string, condition2: string): Observable<boolean> {
        return this._conditionsMatrix$.pipe(
            map((data) => this._getMatchingCountries(data, condition1, condition2).length > 0)
        );
    }

    public isCorrectCountryTicTacToe(countryCode: string, condition1: string, condition2: string): Observable<boolean> {
        return this._conditionsMatrix$.pipe(
            map((data) => this._getMatchingCountries(data, condition1, condition2).includes(countryCode))
        );
    }

    // -------------------------------------------------------------------------------------
    // File Generation
    // -------------------------------------------------------------------------------------
    public createTicTacToeConditionMatrix(): Observable<string[][][]> {
        const countries$ = this._countriesService.getAllCountries().pipe(
            shareReplay(1)
        );

        return combineLatest([
            countries$,
            countries$.pipe(map(countries => countries.find(c => c.alpha2Code === 'RU'))),
            countries$.pipe(map(countries => countries.find(c => c.alpha2Code === 'CN'))),
            countries$.pipe(map(countries => countries.find(c => c.alpha2Code === 'BR'))),
            countries$.pipe(map(countries => countries.find(c => c.alpha2Code === 'FR'))),
        ]).pipe(
            map(([allCountries, russia, china, brazil, france]) => {
                if (!russia || !china || !brazil || !france) {
                    throw new Error('Could not resolve one or more reference countries (RU/CN/BR/FR).');
                }

                const conditions: Condition[] = [
                    new AboveXPopulationCondition(100_000_000),
                    new AboveXPopulationCondition(50_000_000),
                    new AboveXPopulationCondition(10_000_000),

                    new UnderXPopulationCondition(10_000_000),
                    new UnderXPopulationCondition(5_000_000),
                    new UnderXPopulationCondition(1_000_000),

                    new BordersXCondition(russia),
                    new BordersXCondition(china),
                    new BordersXCondition(brazil),
                    new BordersXCondition(france),

                    new CapitalStartsWithCondition('B'),
                    new CapitalStartsWithCondition('S'),
                    new CapitalStartsWithCondition('M'),

                    ...regions.map(region => new FromRegionCondition(region)),
                    ...subregions.map(subregion => new FromSubregionCondition(subregion)),

                    new HasMinNeighborsCondition(6),
                    new HasNoLandBordersCondition(),

                    new IsCrossedByEquatorCondition(),
                    new IsCrossedByTropicsCondition(),

                    new IsNorthernHemisphereCondition(),
                    new IsSouthernHemisphereCondition(),

                    new IsEuCondition(),
                    new IsNatoCondition(),
                    new UsesEuroCondition(),

                    new SpeaksArabicCondition(),
                    new SpeaksEnglishCondition(),
                    new SpeaksFrenchCondition(),
                    new SpeaksGermanCondition(),
                    new SpeaksPortugueseCondition(),
                    new SpeaksRussianCondition(),
                    new SpeaksSpanishCondition(),

                    new UsesCyrillicScriptCondition(),
                    new UsesLatinScriptCondition(),
                    new UsesArabicScriptCondition(),
                ];

                const n = conditions.length;

                // Pre-filter, per condition, the list of countries that satisfy it,
                // so each cell is just an intersection instead of a full re-scan.
                const matchesPerCondition: Country[][] = conditions.map(condition =>
                    allCountries.filter(country => condition.check(country))
                );

                const matrix: string[][][] = [];

                for (let row = 0; row < n; row++) {
                    matrix[row] = [];
                    for (let col = 0; col < n; col++) {
                        if (row === col) {
                            matrix[row][col] = [];
                            continue;
                        }

                        const rowMatches = matchesPerCondition[row];
                        const colMatchesSet = new Set(matchesPerCondition[col].map(c => c.alpha2Code));

                        const validCountries = rowMatches
                            .filter(country => colMatchesSet.has(country.alpha2Code))
                            .map(country => country.alpha2Code);

                        matrix[row][col] = validCountries;
                    }
                }

                this._downloadAsJson(
                    {
                        conditions: conditions.map(c => c.toString()),
                        matrix,
                    },
                    'tictactoe_condition_matrix.json'
                );

                return matrix;
            })
        );
    }

    private _downloadAsJson(data: unknown, filename: string): void {
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        anchor.click();

        URL.revokeObjectURL(url);
    }
}
