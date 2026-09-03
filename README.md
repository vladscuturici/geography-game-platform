# CompassLegend - A Geography Game Platform

You can access the live platform on the link below.
https://compasslegend.xyz

## 1. Short Description

A geography game platform built with Angular, testing how well you know the world across 8 different games. You can play single player games, as well as local multiplayer, or online multiplayer by creating a room and sharing the code with a friend.

## 2. Games Guide

### TicTacToe
Available for: Singleplayer, Local PvP, Online PvP.
The classic TicTacToe game, but each row and column is assigned a country condition. There are 6 types of conditions: Population, that includes ranges of population like "Population above 100,000,000"; Regio, like "From Europe", Subregion, like "From Caribbean", Borders, like "Borders Russia", Language, like "Spanish is an official language", and Wildcards, like "Capital City starts with 'B'". To claim a cell you have to name a country that satisfies both its row and column condition. You win the game just like any other TicTactoe game, by forming a horizontal, vertical, or diagonal line. If you pick a country that doesn't check both conditions you lose your turn. Online rooms are backed by a Cloudflare Durable Object per room, so both players share live, persistent game state (including a match history) over a WebSocket connection.

### Wavelength
Available for: Local PvP, Online PvP.
The classic Wavelength party game with a geography twist. One player is the "psychic" and picks a country that matches a hidden target position on a spectrum (e.g. For "Size of the country", you have the range "Tiny" → "Huge"), the other has to guess where on the dial that country falls. This game tests how well you know the other person that plays the game with you, and how synchronized your opinions are. Online rooms work the same way as TicTacToe's, over their own Durable Object.

### Locate the City
Available for: Singleplayer.
You're given a city name and have to drop a pin on the map as close as possible to its real location. Filterable by continent, with an optional "Show Borders" mode if you feel like you need some help, but you will get 25% less points. The game has different modes: World mode (you can get cities from all over the world), Continent mode (you chose a continent to get the cities from), or a Country mode (you will only get cities from a specific country), that includes over 130 different countries to chose from and test your knowledge. Each mode has different scale of points given, so a guess 100km away in the world mode will get you more points then a guess 99km away in UK, the smaller the area the more precise you need to be. Built with Leaflet, rendering custom static GeoJSON country/land shapes (no tile provider) rather than map tiles.

### Guess the Country
Available for: Singleplayer -> Daily and Unlimited modes.
Guess the country from five progressively revealing clues. The Daily mode picks a new country every day, cycling through the entire country list in a shuffled order before reshuffling and starting over, so you won't see the same country twice until the whole set has been exhausted. Since the first day you tried to guess a country, the Daily mode will display your progress, e.g. 3/9/2026, United States, 6 guesses; 4/9/2026, not guessed; and so on. The Unlimited mode is the same as the Daily mode, only without any restrictions, you can guess as many countries as you want.

### WikiLocate
Available for: Singleplayer.
A city's location is shown only through the Wikipedia article pins scattered around it on the map (streets, landmarks, institutions, events, etc.; with the city's and country's name not shown). You have to identify the city from context. Pulls live from the Wikipedia API. The maps uses MapLibre GL JS + OpenFreeMap vector tiles (recolored/custom-styled), to hide labels like streets or city names, but to keep the elements like streets and rivers on the map.

### Sort it Out
Available for: Singleplayer.
Drag five countries into the correct order for a randomly picked category (population, area, population density, number of bordering nations, or number of official languages). Categories and countries are re-rolled each round, picking five countries with meaningfully distinct values so ties aren't an issue. Supports drag-and-drop as well as arrow buttons for touch devices.

### Narrow it Down
Available for: Singleplayer.
Estimate a country's population by setting a min/max range — the narrower your range, the more points you score, but if the real number falls outside it you score zero. The slider uses a custom log-scaled, power-curved mapping centered on the world's median population, so the middle of the slider is far more granular than the extremes, making it actually usable across a range from single digits to billions.

### Higher Lower
Available for: Singleplayer.
Classic higher/lower format — guess whether the challenger country has a bigger or smaller population than the reigning one, and try to build the longest streak.

## 3. Tech Stack

Frontend is built with Angular (standalone components, Angular Material for form controls). Most country data comes from countries.dev, layered with a personalized/updated dataset and a custom condition matrix for TicTacToe, built by both countries.dev API, as well as manually researching and compiling facts not available in the base dataset (e.g. "gained independence after 1990") ; WikiLocate pulls directly from the Wikipedia API; Map-based games are built with Leaflet: WikiLocate uses OpenStreetMap/OpenFreeMap tiles, while Locate the City renders custom static GeoJSON country/land shapes instead of map tiles.

The two online multiplayer games (TicTacToe, Wavelength) are backed by a small Cloudflare Workers backend using Durable Objects — one Durable Object instance per room, handling WebSocket connections, game state, and reconnection. Room codes are 6-character, ambiguity-free (no 0/O/1/I), rate-limited per IP on both creation and join to prevent abuse, and rooms auto-clean themselves up via a Durable Object alarm after 24 hours of inactivity.

The layout is fully responsive, reflowing from the homepage's card grid down to a single column on mobile, and swapping the desktop sidebar for a compact mobile top bar nav at narrower widths (some interactions, like Sort it Out's drag-and-drop, also expose button-based alternatives for touch devices). The logo, as well as various design elements like some TicTacToe condition logos or background images, are my own design.

## 4. Running Locally

Frontend:
```
git clone https://github.com/vladscuturici/geography-game-platform.git
cd geography-game-platform
npm install
ng serve
```
Then open `http://localhost:4200`.

## 5. Deployment

The frontend is deployed Github pages, as well as the domain  `compasslegend.xyz`. The multiplayer backend is deployed separately as a Cloudflare Worker via Wrangler.
CORS on the Worker is locked down to an allow-list of known origins (`compasslegend.xyz` and the local dev server), so the API can't be casually hit from other sites.
