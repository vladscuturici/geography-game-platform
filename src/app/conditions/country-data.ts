// Static reference lists used by various Condition classes.
// Kept in one place so multiple conditions can share the same data
// without duplicating it.

// Official Eurozone (EU members using EUR via monetary union) — 21 countries
export const eurozoneCountries: string[] = [
    'AT', // Austria
    'BE', // Belgium
    'BG', // Bulgaria — joined 1 Jan 2026
    'HR', // Croatia
    'CY', // Cyprus
    'EE', // Estonia
    'FI', // Finland
    'FR', // France
    'DE', // Germany
    'GR', // Greece
    'IE', // Ireland
    'IT', // Italy
    'LV', // Latvia
    'LT', // Lithuania
    'LU', // Luxembourg
    'MT', // Malta
    'NL', // Netherlands
    'PT', // Portugal
    'SK', // Slovakia
    'SI', // Slovenia
    'ES', // Spain
];

// Non-EU states/territories using EUR by formal agreement or unilaterally
export const euroUsingNonEU: string[] = [
    'AD', // Andorra — monetary agreement with EU
    'MC', // Monaco — monetary agreement with EU
    'SM', // San Marino — monetary agreement with EU
    'VA', // Vatican City — monetary agreement with EU
    'ME', // Montenegro — unilateral adoption
    'XK', // Kosovo — unilateral adoption (note: 'XK' is an unofficial ISO code, see note below)
];

// Full "uses euro" list for the game condition
export const allEuroUsingCountries: string[] = [...eurozoneCountries, ...euroUsingNonEU];

// European Union member states — 27 countries
export const euCountries: string[] = [
    'AT', // Austria
    'BE', // Belgium
    'BG', // Bulgaria
    'HR', // Croatia
    'CY', // Cyprus
    'CZ', // Czech Republic
    'DK', // Denmark
    'EE', // Estonia
    'FI', // Finland
    'FR', // France
    'DE', // Germany
    'GR', // Greece
    'HU', // Hungary
    'IE', // Ireland
    'IT', // Italy
    'LV', // Latvia
    'LT', // Lithuania
    'LU', // Luxembourg
    'MT', // Malta
    'NL', // Netherlands
    'PL', // Poland
    'PT', // Portugal
    'RO', // Romania
    'SK', // Slovakia
    'SI', // Slovenia
    'ES', // Spain
    'SE', // Sweden
];

// NATO member states — 32 countries
export const natoCountries: string[] = [
    'AL', // Albania
    'BE', // Belgium
    'BG', // Bulgaria
    'CA', // Canada
    'HR', // Croatia
    'CZ', // Czech Republic
    'DK', // Denmark
    'EE', // Estonia
    'FI', // Finland
    'FR', // France
    'DE', // Germany
    'GR', // Greece
    'HU', // Hungary
    'IS', // Iceland
    'IT', // Italy
    'LV', // Latvia
    'LT', // Lithuania
    'LU', // Luxembourg
    'ME', // Montenegro
    'NL', // Netherlands
    'MK', // North Macedonia
    'NO', // Norway
    'PL', // Poland
    'PT', // Portugal
    'RO', // Romania
    'SK', // Slovakia
    'SI', // Slovenia
    'ES', // Spain
    'SE', // Sweden
    'TR', // Turkey
    'GB', // United Kingdom
    'US', // United States
];

export const equatorCountries: string[] = [
    'EC', // Ecuador
    'CO', // Colombia
    'BR', // Brazil
    'ST', // São Tomé and Príncipe
    'GA', // Gabon
    'CG', // Republic of the Congo
    'CD', // DR Congo
    'UG', // Uganda
    'KE', // Kenya
    'SO', // Somalia
    'MV', // Maldives
    'ID', // Indonesia
    'KI', // Kiribati
];

export const tropicCountries: string[] = [
    // Tropic of Cancer
    'MX', // Mexico
    'BS', // Bahamas
    'EH', // Western Sahara
    'DZ', // Algeria
    'ML', // Mali
    'NE', // Niger
    'LY', // Libya
    'EG', // Egypt
    'SA', // Saudi Arabia
    'AE', // United Arab Emirates
    'OM', // Oman
    'IN', // India
    'BD', // Bangladesh
    'MM', // Myanmar
    'CN', // China
    'TW', // Taiwan
    'MR', // Mauritania

    // Tropic of Capricorn
    'CL', // Chile
    'AR', // Argentina
    'PY', // Paraguay
    'NA', // Namibia
    'BW', // Botswana
    'ZA', // South Africa
    'MZ', // Mozambique
    'MG', // Madagascar
    'AU', // Australia
    'BR', // Brazil
];

// Countries where Latin script is used officially (may overlap with other scripts)
export const latinScriptCountries: string[] = [
    'US', 'GB', 'FR', 'DE', 'ES', 'IT', 'PT', 'NL', 'BE', 'IE',
    'DK', 'NO', 'SE', 'FI', 'IS', 'PL', 'CZ', 'SK', 'HU', 'RO',
    'HR', 'SI', 'LT', 'LV', 'EE', 'AT', 'CH', 'LU', 'MT', 'AD',
    'MC', 'SM', 'VA', 'AL',
    'ME', // Montenegro — Latin and Cyrillic both official
    'RS', // Serbia — Latin widely used, though Cyrillic has constitutional priority
    'BA', // Bosnia and Herzegovina — Latin and Cyrillic both official
    'BR', 'AR', 'CL', 'CO', 'PE', 'MX',
    'CA', 'AU', 'NZ', 'ID', 'PH', 'VN', 'TR', 'ZA', 'KE', 'NG',
    'GH', 'SN', 'CM', 'CI', 'UG', 'TZ', 'ZM', 'ZW', 'AO', 'MZ',
    'TL', // Timor-Leste — Portuguese (official) uses Latin script
];

// Countries where Cyrillic script is used officially (may overlap with other scripts)
export const cyrillicScriptCountries: string[] = [
    'RU', 'UA', 'BY', 'BG',
    'RS', // Serbia
    'ME', // Montenegro
    'BA', // Bosnia and Herzegovina
    'MK', 'KZ', // Kazakhstan — still primarily Cyrillic; Latin transition ongoing (not complete until 2031+)
    'KG', 'TJ', 'MN',
];

// Countries where Arabic script is used officially (may overlap with other scripts)
export const arabicScriptCountries: string[] = [
    'SA', 'EG', 'DZ', 'MA', 'TN', 'LY', 'SD', 'IQ', 'SY', 'JO',
    'LB', 'YE', 'OM', 'AE', 'QA', 'BH', 'KW', 'MR', 'IR', 'AF',
    'PK', 'SO', 'IL', 'DJ', 'KM', 'TD', 'ER', 'PS'
];

export const regions = [
  'Africa',
  'Americas',
  'Asia',
  'Europe',
  'Oceania',
];

export const subregions = [
  'Caribbean',
  'Central America',
  'Central Asia',
  'Central Europe',
  'Eastern Africa',
  'Eastern Asia',
  'Eastern Europe',
  'Melanesia',
  'Micronesia',
  'Middle Africa',
  'North America',
  'Northern Africa',
  'Northern America',
  'Northern Europe',
  'Polynesia',
  'South America',
  'South-Eastern Asia',
  'Southern Africa',
  'Southern Asia',
  'Southern Europe',
  'Western Africa',
  'Western Asia',
  'Western Europe',
];

// language-data.ts

export const russianSpeakingCountries: string[] = [
    'BY', // Belarus
    'KZ', // Kazakhstan
    'KG', // Kyrgyzstan
    'RU', // Russia
    'TJ', // Tajikistan
    'TM', // Turkmenistan
    'UZ', // Uzbekistan
];

export const spanishSpeakingCountries: string[] = [
    'AR', // Argentina
    'BZ', // Belize
    'BO', // Bolivia (Plurinational State of)
    'CL', // Chile
    'CO', // Colombia
    'CR', // Costa Rica
    'CU', // Cuba
    'DO', // Dominican Republic
    'EC', // Ecuador
    'SV', // El Salvador
    'GQ', // Equatorial Guinea
    'GU', // Guam
    'GT', // Guatemala
    'HN', // Honduras
    'MX', // Mexico
    'NI', // Nicaragua
    'PA', // Panama
    'PY', // Paraguay
    'PE', // Peru
    'PR', // Puerto Rico
    'ES', // Spain
    'UY', // Uruguay
    'VE', // Venezuela (Bolivarian Republic of)
    'EH', // Western Sahara
];

export const portugueseSpeakingCountries: string[] = [
    'AO', // Angola
    'BR', // Brazil
    'CV', // Cabo Verde
    'GQ', // Equatorial Guinea
    'GW', // Guinea-Bissau
    'MO', // Macao
    'MZ', // Mozambique
    'PT', // Portugal
    'ST', // Sao Tome and Principe
    'TL', // Timor-Leste
];

export const germanSpeakingCountries: string[] = [
    'AT', // Austria
    'BE', // Belgium
    'DE', // Germany
    'LI', // Liechtenstein
    'LU', // Luxembourg
    'CH', // Switzerland
    'VA', // Vatican City
];

export const frenchSpeakingCountries: string[] = [
    'BE', // Belgium
    'BJ', // Benin
    'BF', // Burkina Faso
    'BI', // Burundi
    'CM', // Cameroon
    'CA', // Canada
    'CF', // Central African Republic
    'TD', // Chad
    'KM', // Comoros
    'CG', // Congo
    'CD', // Congo (Democratic Republic of the)
    'DJ', // Djibouti
    'GQ', // Equatorial Guinea
    'FR', // France
    'GF', // French Guiana
    'PF', // French Polynesia
    'TF', // French Southern Territories
    'GA', // Gabon
    'GP', // Guadeloupe
    'GG', // Guernsey
    'GN', // Guinea
    'HT', // Haiti
    'CI', // Ivory Coast
    'JE', // Jersey
    'LB', // Lebanon
    'LU', // Luxembourg
    'MG', // Madagascar
    'ML', // Mali
    'MQ', // Martinique
    'YT', // Mayotte
    'MC', // Monaco
    'NC', // New Caledonia
    'NE', // Niger
    'RW', // Rwanda
    'RE', // Réunion
    'BL', // Saint Barthélemy
    'MF', // Saint Martin (French part)
    'PM', // Saint Pierre and Miquelon
    'SN', // Senegal
    'SC', // Seychelles
    'CH', // Switzerland
    'TG', // Togo
    'VU', // Vanuatu
    'VA', // Vatican City
    'WF', // Wallis and Futuna
];

export const englishSpeakingCountries: string[] = [
    'AS', // American Samoa
    'AI', // Anguilla
    'AQ', // Antarctica
    'AG', // Antigua and Barbuda
    'AU', // Australia
    'BS', // Bahamas
    'BB', // Barbados
    'BZ', // Belize
    'BM', // Bermuda
    'BW', // Botswana
    'IO', // British Indian Ocean Territory
    'CM', // Cameroon
    'CA', // Canada
    'KY', // Cayman Islands
    'CX', // Christmas Island
    'CC', // Cocos (Keeling) Islands
    'CK', // Cook Islands
    'CW', // Curaçao
    'DM', // Dominica
    'ER', // Eritrea
    'FK', // Falkland Islands (Malvinas)
    'FJ', // Fiji
    'GM', // Gambia
    'GH', // Ghana
    'GI', // Gibraltar
    'GD', // Grenada
    'GU', // Guam
    'GG', // Guernsey
    'GY', // Guyana
    'HM', // Heard Island and McDonald Islands
    'HK', // Hong Kong
    'IN', // India
    'IE', // Ireland
    'IM', // Isle of Man
    'JM', // Jamaica
    'JE', // Jersey
    'KE', // Kenya
    'KI', // Kiribati
    'LS', // Lesotho
    'LR', // Liberia
    'MW', // Malawi
    'MT', // Malta
    'MH', // Marshall Islands
    'MU', // Mauritius
    'FM', // Micronesia (Federated States of)
    'MS', // Montserrat
    'NA', // Namibia
    'NR', // Nauru
    'NZ', // New Zealand
    'NG', // Nigeria
    'NU', // Niue
    'NF', // Norfolk Island
    'MP', // Northern Mariana Islands
    'PK', // Pakistan
    'PW', // Palau
    'PG', // Papua New Guinea
    'PH', // Philippines
    'PN', // Pitcairn
    'PR', // Puerto Rico
    'RW', // Rwanda
    'SH', // Saint Helena, Ascension and Tristan da Cunha
    'KN', // Saint Kitts and Nevis
    'LC', // Saint Lucia
    'MF', // Saint Martin (French part)
    'VC', // Saint Vincent and the Grenadines
    'WS', // Samoa
    'SC', // Seychelles
    'SL', // Sierra Leone
    'SG', // Singapore
    'SX', // Sint Maarten (Dutch part)
    'SB', // Solomon Islands
    'ZA', // South Africa
    'GS', // South Georgia and the South Sandwich Islands
    'SS', // South Sudan
    'SD', // Sudan
    'SZ', // Eswatini
    'TZ', // Tanzania, United Republic of
    'TK', // Tokelau
    'TO', // Tonga
    'TT', // Trinidad and Tobago
    'TC', // Turks and Caicos Islands
    'TV', // Tuvalu
    'UG', // Uganda
    'GB', // United Kingdom of Great Britain and Northern Ireland
    'UM', // United States Minor Outlying Islands
    'US', // United States of America
    'VU', // Vanuatu
    'VG', // Virgin Islands (British)
    'VI', // Virgin Islands (U.S.)
    'ZM', // Zambia
    'ZW', // Zimbabwe
];

export const arabicSpeakingCountries: string[] = [
    'DZ', // Algeria
    'BH', // Bahrain
    'TD', // Chad
    'KM', // Comoros
    'DJ', // Djibouti
    'EG', // Egypt
    'ER', // Eritrea
    'IQ', // Iraq
    'IL', // Israel
    'JO', // Jordan
    'KW', // Kuwait
    'LB', // Lebanon
    'LY', // Libya
    'MR', // Mauritania
    'MA', // Morocco
    'OM', // Oman
    'PS', // Palestine, State of
    'QA', // Qatar
    'SA', // Saudi Arabia
    'SO', // Somalia
    'SD', // Sudan
    'SY', // Syrian Arab Republic
    'TN', // Tunisia
    'AE', // United Arab Emirates
    'YE', // Yemen
];

// ---------------------------------------------------------------------
// Additions supporting the "2nd batch" of Condition classes.
// Append these to country-data.ts (alongside the existing exports).
// ---------------------------------------------------------------------

// Countries/territories that drive on the left-hand side of the road
export const leftLaneCountries: string[] = [
    'AG', // Antigua and Barbuda
    'AI', // Anguilla
    'AU', // Australia
    'BB', // Barbados
    'BD', // Bangladesh
    'BM', // Bermuda
    'BN', // Brunei
    'BS', // Bahamas
    'BT', // Bhutan
    'BW', // Botswana
    'CC', // Cocos (Keeling) Islands
    'CK', // Cook Islands
    'CX', // Christmas Island
    'CY', // Cyprus
    'DM', // Dominica
    'FJ', // Fiji
    'FK', // Falkland Islands
    'GB', // United Kingdom
    'GD', // Grenada
    'GG', // Guernsey
    'GY', // Guyana
    'HK', // Hong Kong
    'ID', // Indonesia
    'IE', // Ireland
    'IM', // Isle of Man
    'IN', // India
    'IO', // British Indian Ocean Territory
    'JE', // Jersey
    'JM', // Jamaica
    'JP',
    'KE', // Kenya
    'KI', // Kiribati (partial, but officially left)
    'KN', // Saint Kitts and Nevis
    'KY', // Cayman Islands
    'LC', // Saint Lucia
    'LK', // Sri Lanka
    'LS', // Lesotho
    'MO', // Macao
    'MS', // Montserrat
    'MT', // Malta
    'MU', // Mauritius
    'MV', // Maldives
    'MW', // Malawi
    'MY', // Malaysia
    'MZ', // Mozambique
    'NA', // Namibia
    'NF', // Norfolk Island
    'NP', // Nepal
    'NR', // Nauru
    'NU', // Niue
    'NZ', // New Zealand
    'PG', // Papua New Guinea
    'PK', // Pakistan
    'PN', // Pitcairn
    'SB', // Solomon Islands
    'SC', // Seychelles
    'SG', // Singapore
    'SH', // Saint Helena, Ascension and Tristan da Cunha
    'SR', // Suriname
    'SZ', // Eswatini
    'TC', // Turks and Caicos Islands
    'TH', // Thailand
    'TL', // Timor-Leste
    'TO', // Tonga
    'TT', // Trinidad and Tobago
    'TV', // Tuvalu
    'TZ', // Tanzania
    'UG', // Uganda
    'VC', // Saint Vincent and the Grenadines
    'VG', // British Virgin Islands
    'VI', // United States Virgin Islands
    'WS', // Samoa
    'ZA', // South Africa
    'ZM', // Zambia
    'ZW', // Zimbabwe
];

// Countries/states that declared or gained independence after 1 January 1990
// (mainly the USSR, Yugoslavia, and Czechoslovakia break-ups, plus a handful of others)
export const independentAfter1Jan90Countries: string[] = [
    'AM', // Armenia — 1991 (USSR)
    'AZ', // Azerbaijan — 1991 (USSR)
    'BA', // Bosnia and Herzegovina — 1992 (Yugoslavia)
    'BY', // Belarus — 1991 (USSR)
    'CZ', // Czech Republic — 1993 (Czechoslovakia)
    'EE', // Estonia — 1991 (USSR)
    'ER', // Eritrea — 1993 (from Ethiopia)
    'GE', // Georgia — 1991 (USSR)
    'HR', // Croatia — 1991 (Yugoslavia)
    'KG', // Kyrgyzstan — 1991 (USSR)
    'KZ', // Kazakhstan — 1991 (USSR)
    'LT', // Lithuania — 1990/1991 (USSR)
    'LV', // Latvia — 1991 (USSR)
    'MD', // Moldova — 1991 (USSR)
    'ME', // Montenegro — 2006
    'MK', // North Macedonia — 1991 (Yugoslavia)
    'NA', // Namibia — 21 March 1990 (from South Africa)
    'PW', // Palau — 1994
    'RS', // Serbia — 2006 (current statehood, post Serbia-Montenegro union)
    'SI', // Slovenia — 1991 (Yugoslavia)
    'SK', // Slovakia — 1993 (Czechoslovakia)
    'SS', // South Sudan — 2011 (from Sudan)
    'TJ', // Tajikistan — 1991 (USSR)
    'TL', // Timor-Leste — 2002 (from Indonesia)
    'TM', // Turkmenistan — 1991 (USSR)
    'UA', // Ukraine — 1991 (USSR)
    'UZ', // Uzbekistan — 1991 (USSR)
    'XK', // Kosovo — 2008
    'YE', // Yemen — 1990 (unification of North and South Yemen)
];

// Countries crossed by the Prime Meridian (0° longitude)
export const primeMeridianCountries: string[] = [
    'GB', // United Kingdom
    'FR', // France
    'ES', // Spain
    'DZ', // Algeria
    'ML', // Mali
    'BF', // Burkina Faso
    'TG', // Togo
    'GH', // Ghana
    'AQ', // Antarctica
];

// Countries crossed by the Arctic Circle
export const arcticCircleCountries: string[] = [
    'NO', // Norway
    'SE', // Sweden
    'FI', // Finland
    'RU', // Russian Federation
    'US', // United States (Alaska)
    'CA', // Canada
    'IS', // Iceland (Grímsey island)
    'GL', // Greenland
];

// Landlocked countries (no direct access to open ocean)
export const landlockedCountries: string[] = [
    'AD', // Andorra
    'AF', // Afghanistan
    'AM', // Armenia
    'AT', // Austria
    'AZ', // Azerbaijan
    'BF', // Burkina Faso
    'BI', // Burundi
    'BO', // Bolivia (Plurinational State of)
    'BT', // Bhutan
    'BW', // Botswana
    'BY', // Belarus
    'CF', // Central African Republic
    'CH', // Switzerland
    'RS', // Serbia
    'CZ', // Czech Republic
    'ET', // Ethiopia
    'HU', // Hungary
    'KG', // Kyrgyzstan
    'KZ', // Kazakhstan (Caspian Sea only, no ocean access)
    'LA', // Laos
    'LI', // Liechtenstein
    'LS', // Lesotho
    'LU', // Luxembourg
    'MD', // Moldova
    'MK', // North Macedonia
    'ML', // Mali
    'MN', // Mongolia
    'MW', // Malawi
    'NE', // Niger
    'NP', // Nepal
    'PY', // Paraguay
    'RW', // Rwanda
    'SK', // Slovakia
    'SM', // San Marino
    'SS', // South Sudan
    'SZ', // Eswatini
    'TD', // Chad
    'TJ', // Tajikistan
    'TM', // Turkmenistan (Caspian Sea only, no ocean access)
    'UG', // Uganda
    'UZ', // Uzbekistan
    'VA', // Vatican City
    'XK', // Kosovo
    'ZM', // Zambia
    'ZW', // Zimbabwe
];

// Countries with a point of elevation above 3,000 metres
export const above3KmCountries: string[] = [
    'AF', 'AM', 'AR', 'AT', 'BO', 'BT', 'CA', 'CD', 'CH', 'CL',
    'CM', 'CN', 'CO', 'CR', 'DZ', 'EC', 'ER', 'ES', 'ET', 'FR',
    'GE', 'GL', 'GT', 'ID', 'IN', 'IQ', 'IR', 'IT', 'JP', 'KE',
    'KG', 'KZ', 'LS', 'MA', 'MM', 'MN', 'MW', 'MX', 'MY', 'NP',
    'NZ', 'OM', 'PE', 'PG', 'PK', 'RU', 'RW', 'SA', 'SD', 'SS',
    'TD', 'TJ', 'TR', 'TW', 'TZ', 'UG', 'US', 'UZ', 'VE', 'VN',
    'YE', 'ZA', 'LB'
];

// Sovereign monarchies (kingdoms, principalities, sultanates, emirates,
// grand duchies, and Commonwealth realms that share the British monarch
// as head of state)
export const monarchyCountries: string[] = [
    'AD', // Andorra (co-principality)
    'AE', // United Arab Emirates (federation of emirates)
    'AG', // Antigua and Barbuda (Commonwealth realm)
    'AU', // Australia (Commonwealth realm)
    'BE', // Belgium
    'BH', // Bahrain
    'BN', // Brunei
    'BS', // Bahamas (Commonwealth realm)
    'BT', // Bhutan
    'BZ', // Belize (Commonwealth realm)
    'CA', // Canada (Commonwealth realm)
    'DK', // Denmark
    'ES', // Spain
    'GB', // United Kingdom
    'GD', // Grenada (Commonwealth realm)
    'JM', // Jamaica (Commonwealth realm)
    'JO', // Jordan
    'JP', // Japan
    'KH', // Cambodia
    'KN', // Saint Kitts and Nevis (Commonwealth realm)
    'KW', // Kuwait
    'LC', // Saint Lucia (Commonwealth realm)
    'LI', // Liechtenstein
    'LS', // Lesotho
    'LU', // Luxembourg
    'MA', // Morocco
    'MC', // Monaco
    'MY', // Malaysia
    'NL', // Netherlands
    'NO', // Norway
    'NZ', // New Zealand (Commonwealth realm)
    'OM', // Oman
    'PG', // Papua New Guinea (Commonwealth realm)
    'QA', // Qatar
    'SA', // Saudi Arabia
    'SB', // Solomon Islands (Commonwealth realm)
    'SE', // Sweden
    'SZ', // Eswatini
    'TH', // Thailand
    'TO', // Tonga
    'TV', // Tuvalu (Commonwealth realm)
    'VA', // Vatican City (elective monarchy)
    'VC', // Saint Vincent and the Grenadines (Commonwealth realm)
];

// Sovereign republics (all other independent states not listed as monarchies;
// non-sovereign territories/dependencies are intentionally excluded)
export const republicCountries: string[] = [
    'AF', 'AL', 'AM', 'AO', 'AR', 'AT', 'AZ', 'BA', 'BB', 'BD',
    'BF', 'BG', 'BI', 'BJ', 'BO', 'BR', 'BW', 'BY', 'CD', 'CF',
    'CG', 'CH', 'CI', 'CL', 'CM', 'CN', 'CO', 'CR', 'CU', 'CV',
    'CY', 'CZ', 'DE', 'DJ', 'DM', 'DO', 'DZ', 'EC', 'EE', 'EG',
    'ER', 'ET', 'FI', 'FJ', 'FM', 'FR', 'GA', 'GE', 'GH', 'GM',
    'GN', 'GQ', 'GR', 'GT', 'GW', 'GY', 'HN', 'HR', 'HT', 'HU',
    'ID', 'IE', 'IL', 'IN', 'IQ', 'IR', 'IS', 'IT', 'KE', 'KG',
    'KI', 'KM', 'KP', 'KR', 'KZ', 'LA', 'LB', 'LK', 'LR', 'LT',
    'LV', 'LY', 'MD', 'ME', 'MG', 'MH', 'MK', 'ML', 'MM', 'MN',
    'MR', 'MT', 'MU', 'MV', 'MW', 'MX', 'MZ', 'NA', 'NE', 'NG',
    'NI', 'NP', 'NR', 'PA', 'PE', 'PH', 'PK', 'PL', 'PS', 'PT',
    'PW', 'PY', 'RO', 'RS', 'RU', 'RW', 'SC', 'SD', 'SG', 'SI',
    'SK', 'SL', 'SM', 'SN', 'SO', 'SR', 'SS', 'ST', 'SV', 'SY',
    'TD', 'TG', 'TJ', 'TL', 'TM', 'TN', 'TR', 'TT', 'TW', 'TZ',
    'UA', 'UG', 'US', 'UY', 'UZ', 'VE', 'VN', 'VU', 'WS', 'XK',
    'YE', 'ZA', 'ZM', 'ZW',
];

// Countries crossed by the Danube river
export const danubeCountries: string[] = [
    'DE', // Germany
    'AT', // Austria
    'SK', // Slovakia
    'HU', // Hungary
    'HR', // Croatia
    'RS', // Serbia
    'BA', // Bosnia and Herzegovina
    'BG', // Bulgaria
    'RO', // Romania
    'MD', // Moldova
    'UA', // Ukraine
];

// Countries that are part of the Sahara Desert
export const saharaCountries: string[] = [
    'DZ', // Algeria
    'TD', // Chad
    'EG', // Egypt
    'LY', // Libya
    'ML', // Mali
    'MR', // Mauritania
    'MA', // Morocco
    'NE', // Niger
    'EH', // Western Sahara
    'SD', // Sudan
    'TN', // Tunisia
];

// Countries bordering the Mediterranean Sea
export const mediterraneanCountries: string[] = [
    'ES', // Spain
    'FR', // France
    'MC', // Monaco
    'IT', // Italy
    'MT', // Malta
    'SI', // Slovenia
    'HR', // Croatia
    'BA', // Bosnia and Herzegovina
    'ME', // Montenegro
    'AL', // Albania
    'GR', // Greece
    'TR', // Turkey
    'CY', // Cyprus
    'SY', // Syrian Arab Republic
    'LB', // Lebanon
    'IL', // Israel
    'PS', // Palestine, State of
    'EG', // Egypt
    'LY', // Libya
    'TN', // Tunisia
    'DZ', // Algeria
    'MA', // Morocco
];

export const northAmericaCountries: string[] = [
    "AI", "AG", "AW", "BB", "BM", "BQ", "BS", "BZ", "CA", "CR", 
    "CU", "CW", "DM", "DO", "GD", "GL", "GP", "GT", "HN", "HT", 
    "JM", "KN", "KY", "LC", "MF", "MQ", "MS", "MX", "NI", "PA", 
    "PM", "PR", "SV", "SX", "TC", "TT", "US", "VC", "VG", "VI"
]