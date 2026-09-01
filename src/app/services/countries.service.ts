import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { forkJoin, map, shareReplay, Observable } from 'rxjs';
import { Country } from '../models/countries.model';

interface CountryOverride {
  alpha2_code: string;
  name: string;
  short_name: string;
  updated_population: number;
}

@Injectable({ providedIn: 'root' })
export class CountriesService {
  private _httpClient = inject(HttpClient);

  private _apiUrl = 'https://countries.dev';
  private _overridesUrl = '/updated_countries.json';

  // Cache the overrides so we don't refetch the static file on every call.
  private _overrides$: Observable<Map<string, CountryOverride>> =
    this._httpClient.get<CountryOverride[]>(this._overridesUrl).pipe(
      map((overrides) => new Map(overrides.map((o) => [o.alpha2_code, o]))),
      shareReplay(1)
    );

  private _applyOverride(country: Country, overrides: Map<string, CountryOverride>): Country {
    const override = overrides.get(country.alpha2Code);
    if (!override) return country;

    return {
      ...country,
      name: override.short_name || override.name || country.name,
      population: override.updated_population ?? country.population,
    };
  }

  public getCountryByAlphaCode(countryCode: string) {
    return forkJoin([
      this._httpClient.get<Country>(`${this._apiUrl}/alpha/${countryCode}`),
      this._overrides$,
    ]).pipe(map(([country, overrides]) => this._applyOverride(country, overrides)));
  }

  public getAllCountries() {
    return forkJoin([
      this._httpClient.get<Country[]>(`${this._apiUrl}/countries`),
      this._overrides$,
    ]).pipe(
      map(([countries, overrides]) =>
        countries.map((c) => this._applyOverride(c, overrides))
      )
    );
  }
}