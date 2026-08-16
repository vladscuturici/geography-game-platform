import { inject, Service } from '@angular/core';
import { Country, CountryLanguage } from '../models/countries.model';
import { CountryGuessColors, LocateCityScoreDetails } from '../models/game.model';
import { HttpClient } from '@angular/common/http';
import { map, mapTo, Observable } from 'rxjs';

//answer will be a number between 0 and 100 representing the percentage of saturation
// gray - incorrect, green - correct, shades inbetween - partial answer
// name -> will be wrong unless you choose the country
// region -> will be wrong unless you choose a country from the same region
// subregion -> will be wrong unless you choose a country from the same subregion
// population -> will be colored based on how far the number is from the correct country population (ex. if correct population is 2mil, 100mil country -> very unsaturated green,
// 2.5 mil country -> slightly less saturated green
// languages -> will be wrong unless you choose a country that share a languages with the answer (green - exact match, unsaturated green - shared language/languages)

@Service()
export class GameService {
    //http injection
    private _httpClient = inject(HttpClient);

    private _apiUrl = 'https://countries.dev';

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
}
