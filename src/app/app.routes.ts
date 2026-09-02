import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { DailyCountryComponent } from './guess-the-country/daily-country/daily-country.component';
import { UnlimitedComponent } from './guess-the-country/unlimited/unlimited.component';
import { NarrowItDownComponent } from './narrow-it-down/narrow-it-down.component';
import { LocateTheCityComponent } from './locate-the-city/locate-the-city.component';
import { TicTacToeComponent } from './tic-tac-toe/tic-tac-toe.component';
import { HigherLowerComponent } from './higher-lower/higher-lower.component';
import { SortItOutComponent } from './sort-it-out/sort-it-out.component';
import { WikilocateComponent } from './wikilocate/wikilocate.component';
import { WavelengthComponent } from './wavelength/wavelength.component';
import { WavelengthOnlineComponent } from './wavelength-online/wavelength-online.component';
import { TicTacToeOnlineComponent } from './tic-tac-toe-online/tic-tac-toe-online.component';

export const routes: Routes = [
    {
        path: '',
        redirectTo: 'home',
        pathMatch: 'full'
    },
    {
        path: 'home',
        component: HomeComponent,
        title: 'CompassLegend'
    },
    {
        path: 'guess-the-country',
        children: [
            {
                path: '',
                redirectTo: 'daily-country',
                pathMatch: 'full'
            },
            {
                path: 'daily-country',
                component: DailyCountryComponent,
                title: 'Guess the Country - CompassLegend'
            },
            {
                path: 'unlimited',
                component: UnlimitedComponent,
                title: 'Guess the Country - CompassLegend'
            }
        ]
    },
    {
        path: 'narrow-it-down',
        component: NarrowItDownComponent,
        title: 'Narrow It Down - CompassLegend'
    },
    {   path: 'locate-the-city', 
        redirectTo: 'locate-the-city/world', 
        pathMatch: 'full' 
    },
    {   path: 'locate-the-city/:region', 
        component: LocateTheCityComponent,
        title: 'Locate the City - CompassLegend'
    },
    { 
        path: 'locate-the-city/country/:countryCode', 
        component: LocateTheCityComponent,
        title: 'Locate the City - CompassLegend'
    },    
        {
        path: 'tic-tac-toe',
        redirectTo: 'tic-tac-toe/single-player',
        pathMatch: 'full',
    },
    {
        path: 'tic-tac-toe/online-pvp',
        component: TicTacToeOnlineComponent,
        title: 'TicTacToe - CompassLegend'
    },
    {
        path: 'tic-tac-toe/online-pvp/room/:code',
        component: TicTacToeOnlineComponent,
        title: 'TicTacToe - CompassLegend'
    },
    {
        path: 'tic-tac-toe/:mode',
        component: TicTacToeComponent,
        title: 'TicTacToe - CompassLegend'
    },
    {
        path: 'higher-lower',
        component: HigherLowerComponent,
        title: 'Higher or Lower - CompassLegend'
    },
    {
        path: 'sort-it-out',
        component: SortItOutComponent,
        title: 'Sort It Out - CompassLegend'
    },
    {
        path: 'wiki-locate',
        component: WikilocateComponent,
        title: 'WikiLocate - CompassLegend'
    },
    {
        path: 'wavelength',
        children: [
            { path: '', redirectTo: 'local', pathMatch: 'full' },
            { path: 'local', component: WavelengthComponent, title: 'Wavelength - CompassLegend' },
            { path: 'online', component: WavelengthOnlineComponent, title: 'Wavelength - CompassLegend' },
            { path: 'online/room/:code', component: WavelengthOnlineComponent, title: 'Wavelength - CompassLegend' },
        ]
    }
];