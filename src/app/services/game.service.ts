import { Service } from '@angular/core';
import { Country, CountryLanguage } from '../models/countries.model';
import { CountryGuessColors } from '../models/game.model';

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
}
