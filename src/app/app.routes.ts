import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { GuessTheCountryShellComponent } from './guess-the-country/guess-the-country-shell/guess-the-country-shell.component';
import { DailyCountryComponent } from './guess-the-country/daily-country/daily-country.component';
import { UnlimitedComponent } from './guess-the-country/unlimited/unlimited.component';
import { GuessDailyCountryComponent } from './guess-daily-country/guess-daily-country.component';
import { NarrowItDownComponent } from './narrow-it-down/narrow-it-down.component';
import { LocateTheCityComponent } from './locate-the-city/locate-the-city.component';
import { GuessTheLanguageComponent } from './guess-the-language/guess-the-language.component';
import { TicTacToeComponent } from './tic-tac-toe/tic-tac-toe.component';

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
        component: GuessTheCountryShellComponent,
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
    {
        path: 'locate-the-city',
        component: LocateTheCityComponent
    },
    {
        path: 'guess-the-language',
        component: GuessTheLanguageComponent
    },
    {
        path: 'tic-tac-toe',
        component: TicTacToeComponent
    },
];