import { Country } from "../models/countries.model";

export interface RoundPicker<T> {
  pick(items: T[]): T;
}

export class RandomCountryPicker implements RoundPicker<Country> {
    pick(items: Country[]): Country {
        return items[Math.floor(Math.random()*items.length)];
    }
}

function stringToNumber(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0; 
  }
  return hash;
}

export class DailyCountryPicker implements RoundPicker<Country> {   
    pick(items: Country[], now: Date = new Date()): Country {
        const totalCountries = items.length;
        const todayNumber = Math.floor(now.getTime() / (1000 * 60 * 60 * 24));
        const startDay = 20678; //13 august 2026
        const leap = Math.floor((todayNumber - startDay) / totalCountries); //which is the current leap
        const countryIndex = (todayNumber - startDay) % totalCountries; //what is the index of the today's country in the current leap
        
        const keys: number[] = []

        for(let i=0; i<totalCountries; i++) {
            keys[i] = Math.sin(stringToNumber(items[i].name) + leap * 123) * 10000 % 100;
        }

        const sorted = items
            .map((obj, i) => ({ obj, key: keys[i] }))
            .sort((a, b) => a.key - b.key)
            .map(x => x.obj);

        return sorted[countryIndex];
    }
}