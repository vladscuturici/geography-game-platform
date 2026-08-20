import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { Observable, map } from 'rxjs';

interface LanguageCountries {
  language: string;
  countries: string[];
}

@Service()
export class LanguagesService {
  private _httpClient = inject(HttpClient);

  public getLanguagesSpokenInMinKCountries(k: number): Observable<LanguageCountries[]> {
    const path = './languages.json';

    return this._httpClient.get<LanguageCountries[]>(path).pipe(
      map((languages) => languages.filter((entry) => entry.countries.length >= k))
    );
  }

  public getCountriesSpeakingXLanguage(x: string): Observable<string[]> {
    const path = './languages.json';

    return this._httpClient.get<LanguageCountries[]>(path).pipe(
      map((languages) => languages.find((entry) => entry.language === x)?.countries ?? [])
    );
  }
}