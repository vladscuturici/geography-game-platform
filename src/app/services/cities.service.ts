import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { forkJoin, map, catchError, of, Observable } from 'rxjs';
import { City } from '../models/cities.model';

@Service()
export class CitiesService {
    private _httpClient = inject(HttpClient);

    private _apiUrl = 'https://countries.dev';

    public getTopKCities(k: number) {
        return this._httpClient.get<City[]>(`${this._apiUrl}/cities?limit=${k}`);
    }

    /**
     * Returns up to `total` cities, ordered by population, with at most
     * `maxPerCountry` cities from any single country.
     */
    public getTopCitiesCapped(
        countryCodes: string[],
        total: number,
        maxPerCountry: number = 5
    ): Observable<City[]> {
        const requests = countryCodes.map(code =>
            this._httpClient
                .get<City[]>(`${this._apiUrl}/cities?country=${code}&limit=${maxPerCountry}`)
                .pipe(catchError(() => of([] as City[])))
        );

        return forkJoin(requests).pipe(
            map(resultsPerCountry => {
                const merged = resultsPerCountry.flat();
                merged.sort((a, b) => b.population - a.population);
                return merged.slice(0, total);
            })
        );
    }

    /**
     * Same capped/interleaved-population strategy as getTopCitiesCapped,
     * but scoped to a single region's country codes. Kept as a distinct
     * method (rather than just calling getTopCitiesCapped with a filtered
     * list inline at every call site) so the "region" concept is explicit
     * in the API and easy to find/reuse from any component.
     */
    public getTopCitiesCappedForRegion(
        regionCountryCodes: string[],
        total: number,
        maxPerCountry: number = 5
    ): Observable<City[]> {
        if (regionCountryCodes.length === 0) {
            return of([]);
        }

        return this.getTopCitiesCapped(regionCountryCodes, total, maxPerCountry);
    }
}