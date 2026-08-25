import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { DailyCountryComponent } from './guess-the-country/daily-country/daily-country.component';
import { UnlimitedComponent } from './guess-the-country/unlimited/unlimited.component';
import { NarrowItDownComponent } from './narrow-it-down/narrow-it-down.component';
import { LocateTheCityComponent } from './locate-the-city/locate-the-city.component';
import { GuessTheLanguageComponent } from './guess-the-language/guess-the-language.component';
import { TicTacToeComponent } from './tic-tac-toe/tic-tac-toe.component';
import { GuessCountryByOutlineComponent } from './guess-country-by-outline/guess-country-by-outline.component';
import { HigherLowerComponent } from './higher-lower/higher-lower.component';
import { SortItOutComponent } from './sort-it-out/sort-it-out.component';
import { WikilocateComponent } from './wikilocate/wikilocate.component';

export const routes: Routes = [
    {
        path: '',
        redirectTo: 'home',
        pathMatch: 'full'
    },
    {
        path: 'home',
        component: HomeComponent
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
                component: DailyCountryComponent
            },
            {
                path: 'unlimited',
                component: UnlimitedComponent
            }
        ]
    },
    {
        path: 'narrow-it-down',
        component: NarrowItDownComponent
    },
    {   path: 'locate-the-city', 
        redirectTo: 'locate-the-city/world', 
        pathMatch: 'full' 
    },
    {   path: 'locate-the-city/:region', 
        component: LocateTheCityComponent 
    },
    // {
    //     path: 'guess-the-language',
    //     component: GuessTheLanguageComponent
    // },
    {
        path: 'tic-tac-toe',
        component: TicTacToeComponent
    },
    // {
    //     path: 'country-silhouette',
    //     component: GuessCountryByOutlineComponent
    // },
    {
        path: 'higher-lower',
        component: HigherLowerComponent
    },
    {
        path: 'sort-it-out',
        component: SortItOutComponent
    },
    {
        path: 'wiki-locate',
        component: WikilocateComponent
    },
];