import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Country } from '../models/countries.model';

@Service()
export class CountriesService {
    //http injection
    private _httpClient = inject(HttpClient);

    private _apiUrl = 'https://countries.dev';

    public getCountryByAlphaCode(countryCode: string) {
        return this._httpClient.get<Country>(`${this._apiUrl}/alpha/${countryCode}`);
    }

    public getAllCountries() {
        return this._httpClient.get<Country[]>(`${this._apiUrl}/countries`);
    }
}
