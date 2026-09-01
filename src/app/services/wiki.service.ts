import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { forkJoin, map, Observable, of, switchMap, tap } from 'rxjs';

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

interface WikiCategoriesResponse {
  query: {
    pages: Record<
      string,
      {
        pageid: number;
        categories?: { title: string }[];
      }
    >;
  };
}

// Title-level blocklist: cheap, catches the obvious/common cases before
// we ever spend a second API call. Matched case-insensitively against
// the raw article title.
const UNSAFE_TITLE_TERMS = [
  'bombing',
  'shooting',
  'massacre',
  'mass shooting',
  'mass murder',
  'terrorist attack',
  'terrorism',
  'genocide',
  'war crime',
  'plane crash',
  'air disaster',
  'train disaster',
  'train crash',
  'mass grave',
  'assassination',
  'hostage crisis',
  'suicide attack',
];

// Category-level blocklist: matched as a substring against each
// article's Wikipedia categories (e.g. "Category:Terrorist incidents
// in 2015"), which catches neutrally-titled articles a title-only check
// would miss (a town's Wikipedia article, say, that's mostly about a
// disaster that happened there).
const UNSAFE_CATEGORY_TERMS = [
  'terroris',
  'mass shooting',
  'massacre',
  'genocide',
  'war crime',
  'bombing',
  'attack',
  'disaster',
  'mass murder',
  'school shooting',
  'hostage',
  'suicide attack',
  'ethnic cleansing',
];

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
      origin: '*',
    };

    return this._httpClient
      .get<WikiGeoSearchResponse>(this._baseUrl, { params })
      .pipe(
        tap((response) => console.log('Raw wiki response:', response)),
        map((response) => response.query?.geosearch ?? []),
        map((articles) => this.filterByTitle(articles)),
        switchMap((articles) => this.filterByCategory(articles))
      );
  }

  private filterByTitle(articles: WikiGeoArticle[]): WikiGeoArticle[] {
    return articles.filter((article) => !this.matchesAny(article.title, UNSAFE_TITLE_TERMS));
  }

  private filterByCategory(articles: WikiGeoArticle[]): Observable<WikiGeoArticle[]> {
    if (articles.length === 0) return of(articles);

    // MediaWiki's prop=categories accepts at most 50 pageids per
    // request; our geosearch is already capped at gslimit=50, so a
    // single batched call covers a full round's worth of articles.
    const pageids = articles.map((a) => a.pageid).join('|');

    const params = {
      action: 'query',
      prop: 'categories',
      pageids,
      cllimit: 'max',
      format: 'json',
      origin: '*',
    };

    return this._httpClient.get<WikiCategoriesResponse>(this._baseUrl, { params }).pipe(
      map((response) => {
        const pages = response.query?.pages ?? {};

        // If a pageid isn't present in the categories response for some
        // reason, fail open (keep it) rather than silently dropping
        // articles due to an API quirk unrelated to content safety.
        return articles.filter((article) => {
          const page = pages[String(article.pageid)];
          const categories = page?.categories?.map((c) => c.title) ?? [];
          return !categories.some((category) => this.matchesAny(category, UNSAFE_CATEGORY_TERMS));
        });
      })
    );
  }

  private matchesAny(text: string, terms: string[]): boolean {
    const lower = text.toLowerCase();
    return terms.some((term) => lower.includes(term));
  }
}