import { Component, inject } from '@angular/core';
import { CountriesService } from '../services/countries.service';
import { Country } from '../models/countries.model';

@Component({
  selector: 'app-home',
  imports: [],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent {
  private _countriesService = inject(CountriesService);

  public testCountry?: Country;
  public countries?: Country[];

  constructor() {
    this._countriesService.getCountryByAlphaCode('RO').subscribe(country => {
      this.testCountry = country;
    });
    this._countriesService.getAllCountries().subscribe({
      next: countries => this.countries = countries,
      error: err => console.error('Failed to fetch countries', err)
    });
  }
}
