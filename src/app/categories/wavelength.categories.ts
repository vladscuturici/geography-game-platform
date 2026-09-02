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
		title: 'Does the average person know its capital',
		leftLabel: 'No way they know it',
		rightLabel: 'They definitely know it',
	},
	{
		id: 'language',
		title: 'Learning their main language',
		leftLabel: 'Incredibly difficult',
		rightLabel: 'Very easy',
	},
	{
		id: 'wealth',
		title: 'How wealthy the country is',
		leftLabel: 'Very poor',
		rightLabel: 'Extremely wealthy',
	},
	{
		id: 'safety',
		title: 'How safe it is',
		leftLabel: 'Very dangerous',
		rightLabel: 'Extremely safe',
	},
	{
		id: 'development',
		title: 'How developed it is',
		leftLabel: 'Very underdeveloped',
		rightLabel: 'Highly developed',
	},
	{
		id: 'weather',
		title: 'The weather',
		leftLabel: 'Absolutely awful',
		rightLabel: 'Perfect weather',
	},
	{
		id: 'nature',
		title: 'Natural beauty',
		leftLabel: 'Nothing to see',
		rightLabel: 'Breathtaking',
	},
	{
		id: 'culture',
		title: 'Cultural richness',
		leftLabel: 'Not much going on',
		rightLabel: 'Incredibly rich culture',
	},
	{
		id: 'history',
		title: 'Historical significance',
		leftLabel: 'Barely any history',
		rightLabel: 'History everywhere',
	},
	{
		id: 'political-stability',
		title: 'Political stability',
		leftLabel: 'Constant chaos',
		rightLabel: 'Rock solid',
	},
	{
		id: 'influence',
		title: 'Global influence',
		leftLabel: 'No influence',
		rightLabel: 'Major world power',
	},
	{
		id: 'size-population',
		title: 'Population density',
		leftLabel: 'Almost completely empty',
		rightLabel: 'Packed',
	},
	{
		id: 'uniqueness',
		title: 'How unique it feels',
		leftLabel: 'Could be anywhere',
		rightLabel: 'Nowhere else like it',
	},
];

export function pickRandomCategory(): WavelengthCategory {
  const i = Math.floor(Math.random() * WAVELENGTH_CATEGORIES.length);
  return WAVELENGTH_CATEGORIES[i];
}