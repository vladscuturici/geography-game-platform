import { City } from "../models/cities.model";
import { Country } from "../models/countries.model";

export interface RoundPicker<T> {
  pick(items: T[]): T;
}

// Fisher-Yates shuffle
function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

abstract class ShuffleBagPicker<T> implements RoundPicker<T> {
  private bag: T[] = [];
  private lastItem: T | null = null;

  pick(items: T[]): T {
    if (this.bag.length === 0) {
      this.bag = shuffle(items);
      const top = this.bag.length - 1;
      if (
        this.lastItem !== null &&
        this.bag.length > 1 &&
        this.bag[top] === this.lastItem
      ) {
        [this.bag[top], this.bag[top - 1]] = [this.bag[top - 1], this.bag[top]];
      }
    }
    const next = this.bag.pop()!;
    this.lastItem = next;
    return next;
  }

  // Clears the bag so the next pick() reshuffles from the given pool
  // instead of draining leftover items from a previous (now-stale) pool.
  reset(): void {
    this.bag = [];
    this.lastItem = null;
  }
}

export class RandomCountryPicker extends ShuffleBagPicker<Country> {}
export class RandomCityPicker extends ShuffleBagPicker<City> {}

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