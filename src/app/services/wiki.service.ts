import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { map, Observable, tap } from 'rxjs';

export interface WikiGeoArticle {
  pageid: number;
  title: string;
  lat: number;
  lon: number;
  dist: number;
}

interface WikiGeoSearchResponse {
  query: {
    geosearch: WikiGeoArticle[];
  };
}

@Service()
export class WikiService {
    //http injection
    private _httpClient = inject(HttpClient);
    private readonly _baseUrl = 'https://en.wikipedia.org/w/api.php';

    public getWikiArticlesByPoint(lat: number, lng: number, offsetKm: number): Observable<WikiGeoArticle[]> {
        const offsetMeters = offsetKm * 1000;
        const latOffset = (offsetMeters / 2) / 111_320; // meters per degree latitude
        const lngOffset = (offsetMeters / 2) / (111_320 * Math.cos(lat * Math.PI / 180)); // adjust for latitude

        return this.getWikiArticlesByBoundingBox(
            lat - latOffset,
            lng - lngOffset,
            lat + latOffset,
            lng + lngOffset
        );
    }

    public getWikiArticlesByBoundingBox(minLat: number, minLng: number, maxLat: number, maxLng: number): Observable<WikiGeoArticle[]> {
        const params = {
            action: 'query',
            list: 'geosearch',
            gsbbox: `${maxLat}|${minLng}|${minLat}|${maxLng}`,
            gslimit: '50',
            format: 'json',
            origin: '*'
        };

        return this._httpClient
            .get<WikiGeoSearchResponse>(this._baseUrl, { params })
            .pipe(
                tap(response => console.log('Raw wiki response:', response)),
                map(response => response.query?.geosearch ?? [])
            );
    }
}