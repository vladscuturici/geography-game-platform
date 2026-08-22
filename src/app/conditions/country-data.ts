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
    'LB', 'YE', 'OM', 'AE', 'QA', 'BH', 'KW', 'MR',
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
    'Antarctica',
    'Belarus',
    'Kazakhstan',
    'Kyrgyzstan',
    'Russian Federation',
    'Tajikistan',
    'Turkmenistan',
    'Uzbekistan',
];

export const spanishSpeakingCountries: string[] = [
    'Argentina',
    'Belize',
    'Bolivia (Plurinational State of)',
    'Chile',
    'Colombia',
    'Costa Rica',
    'Cuba',
    'Dominican Republic',
    'Ecuador',
    'El Salvador',
    'Equatorial Guinea',
    'Guam',
    'Guatemala',
    'Honduras',
    'Mexico',
    'Nicaragua',
    'Panama',
    'Paraguay',
    'Peru',
    'Puerto Rico',
    'Spain',
    'Uruguay',
    'Venezuela (Bolivarian Republic of)',
    'Western Sahara',
];

export const portugueseSpeakingCountries: string[] = [
    'Angola',
    'Brazil',
    'Cabo Verde',
    'Equatorial Guinea',
    'Guinea-Bissau',
    'Macao',
    'Mozambique',
    'Portugal',
    'Sao Tome and Principe',
    'Timor-Leste',
];

export const germanSpeakingCountries: string[] = [
    'Austria',
    'Belgium',
    'Germany',
    'Liechtenstein',
    'Luxembourg',
    'Switzerland',
    'Vatican City',
];

export const frenchSpeakingCountries: string[] = [
    'Belgium',
    'Benin',
    'Burkina Faso',
    'Burundi',
    'Cameroon',
    'Canada',
    'Central African Republic',
    'Chad',
    'Comoros',
    'Congo',
    'Congo (Democratic Republic of the)',
    'Djibouti',
    'Equatorial Guinea',
    'France',
    'French Guiana',
    'French Polynesia',
    'French Southern Territories',
    'Gabon',
    'Guadeloupe',
    'Guernsey',
    'Guinea',
    'Haiti',
    'Ivory Coast',
    'Jersey',
    'Lebanon',
    'Luxembourg',
    'Madagascar',
    'Mali',
    'Martinique',
    'Mayotte',
    'Monaco',
    'New Caledonia',
    'Niger',
    'Rwanda',
    'Réunion',
    'Saint Barthélemy',
    'Saint Martin (French part)',
    'Saint Pierre and Miquelon',
    'Senegal',
    'Seychelles',
    'Switzerland',
    'Togo',
    'Vanuatu',
    'Vatican City',
    'Wallis and Futuna',
];

export const englishSpeakingCountries: string[] = [
    'American Samoa',
    'Anguilla',
    'Antarctica',
    'Antigua and Barbuda',
    'Australia',
    'Bahamas',
    'Barbados',
    'Belize',
    'Bermuda',
    'Botswana',
    'British Indian Ocean Territory',
    'Cameroon',
    'Canada',
    'Cayman Islands',
    'Christmas Island',
    'Cocos (Keeling) Islands',
    'Cook Islands',
    'Curaçao',
    'Dominica',
    'Eritrea',
    'Falkland Islands (Malvinas)',
    'Fiji',
    'Gambia',
    'Ghana',
    'Gibraltar',
    'Grenada',
    'Guam',
    'Guernsey',
    'Guyana',
    'Heard Island and McDonald Islands',
    'Hong Kong',
    'India',
    'Ireland',
    'Isle of Man',
    'Jamaica',
    'Jersey',
    'Kenya',
    'Kiribati',
    'Lesotho',
    'Liberia',
    'Malawi',
    'Malta',
    'Marshall Islands',
    'Mauritius',
    'Micronesia (Federated States of)',
    'Montserrat',
    'Namibia',
    'Nauru',
    'New Zealand',
    'Nigeria',
    'Niue',
    'Norfolk Island',
    'Northern Mariana Islands',
    'Pakistan',
    'Palau',
    'Papua New Guinea',
    'Philippines',
    'Pitcairn',
    'Puerto Rico',
    'Rwanda',
    'Saint Helena, Ascension and Tristan da Cunha',
    'Saint Kitts and Nevis',
    'Saint Lucia',
    'Saint Martin (French part)',
    'Saint Vincent and the Grenadines',
    'Samoa',
    'Seychelles',
    'Sierra Leone',
    'Singapore',
    'Sint Maarten (Dutch part)',
    'Solomon Islands',
    'South Africa',
    'South Georgia and the South Sandwich Islands',
    'South Sudan',
    'Sudan',
    'Swaziland',
    'Tanzania, United Republic of',
    'Tokelau',
    'Tonga',
    'Trinidad and Tobago',
    'Turks and Caicos Islands',
    'Tuvalu',
    'Uganda',
    'United Kingdom of Great Britain and Northern Ireland',
    'United States Minor Outlying Islands',
    'United States of America',
    'Vanuatu',
    'Virgin Islands (British)',
    'Virgin Islands (U.S.)',
    'Zambia',
    'Zimbabwe',
];

export const arabicSpeakingCountries: string[] = [
    'Algeria',
    'Bahrain',
    'Chad',
    'Comoros',
    'Djibouti',
    'Egypt',
    'Eritrea',
    'Iraq',
    'Israel',
    'Jordan',
    'Kuwait',
    'Lebanon',
    'Libya',
    'Mauritania',
    'Morocco',
    'Oman',
    'Palestine, State of',
    'Qatar',
    'Saudi Arabia',
    'Somalia',
    'Sudan',
    'Syrian Arab Republic',
    'Tunisia',
    'United Arab Emirates',
    'Yemen',
];