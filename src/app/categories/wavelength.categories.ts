export interface WavelengthCategory {
  id: string;
  title: string;
  leftLabel: string;
  rightLabel: string;
}

export const WAVELENGTH_CATEGORIES: WavelengthCategory[] = [
  {
    id: 'population',
    title: 'Population',
    leftLabel: 'Barely anyone lives there',
    rightLabel: 'An awful lot of people live there',
  },
  {
    id: 'area',
    title: 'Size of the country',
    leftLabel: 'Tiny',
    rightLabel: 'Huge',
  },
  // {
  //   id: 'development',
  //   title: 'How developed it is',
  //   leftLabel: 'Rough around the edges',
  //   rightLabel: 'Ultra-developed',
  // },
  {
    id: 'food',
    title: 'The food',
    leftLabel: "Wouldn't recommend it",
    rightLabel: 'Absolutely delicious',
  },
  {
    id: 'football',
    title: 'National football team',
    leftLabel: 'Sunday league energy',
    rightLabel: 'World-beaters',
  },
  {
    id: 'distance',
    title: 'How far away it is from you',
    leftLabel: 'Basically next door',
    rightLabel: 'Other side of the planet',
  },
  {
    id: 'vacation',
    title: 'As a vacation destination',
    leftLabel: "I'd never go there",
    rightLabel: "I'd love to go there",
  },
  {
    id: 'awareness',
    title: 'How well known it is',
    leftLabel: 'Never heard of it',
    rightLabel: 'Everybody knows it',
  },
  {
    id: 'would-move',
    title: 'Would you move there',
    leftLabel: 'No way',
    rightLabel: 'Take me there',
  },
  {
    id: 'capital-guess',
    title: 'Guessing its capital',
    leftLabel: 'No way he knows it',
    rightLabel: 'He definitely knows it',
  },
  {
    id: 'language',
    title: 'Learning their main language',
    leftLabel: 'Incredibly difficult',
    rightLabel: 'Very easy',
  },
];

export function pickRandomCategory(): WavelengthCategory {
  const i = Math.floor(Math.random() * WAVELENGTH_CATEGORIES.length);
  return WAVELENGTH_CATEGORIES[i];
}