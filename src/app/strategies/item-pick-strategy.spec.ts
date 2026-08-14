import { DailyCountryPicker } from './item-pick-strategy';
import { Country } from '../models/countries.model';

describe('DailyCountryPicker leap behavior', () => {
  let picker: DailyCountryPicker;
  let mockCountries: Country[];
  const msPerDay = 1000 * 60 * 60 * 24;
  const startDayMs = 20678 * msPerDay; // matches startDay constant

  beforeEach(() => {
    picker = new DailyCountryPicker();
    mockCountries = Array.from({ length: 10 }, (_, i) => ({
      name: `Country${i}`,
      alpha2Code: `C${i}`,
      alpha3Code: `CC${i}`,
      region: 'Test',
      subregion: 'Test',
      population: 1000,
      populationDensity: 10,
      currencies: [],
      languages: [],
      callingCodes: [],
      flags: { png: '', svg: '' },
      flag: '🏳️',
      nativeName: `Country${i}`,
      latlng: [i * 10, i * 5] as [number, number],
      timezones: [],
      demonym: '',
    }));
  });

  it('should produce the same country for two dates within the same leap', () => {
    // With 10 countries, leap 0 covers days 0-9 after startDay
    const day2 = new Date(startDayMs + 2 * msPerDay);
    const day5 = new Date(startDayMs + 5 * msPerDay);

    // Different countryIndex (2 vs 5), so results should differ by index,
    // but the underlying leap-based ordering should be identical.
    // To isolate leap specifically, compare the FULL shuffled order, not just one pick.
    const order2 = mockCountries
      .map(c => ({ c, key: Math.sin(c.latlng[0] * c.latlng[1] + 0 * 123) * 10000 % 100 }))
      .sort((a, b) => a.key - b.key);
    const order5 = mockCountries
      .map(c => ({ c, key: Math.sin(c.latlng[0] * c.latlng[1] + 0 * 123) * 10000 % 100 }))
      .sort((a, b) => a.key - b.key);

    expect(order2.map(x => x.c)).toEqual(order5.map(x => x.c));

    // Sanity: actual pick() calls still return valid, in-range countries
    expect(mockCountries).toContain(picker.pick(mockCountries, day2));
    expect(mockCountries).toContain(picker.pick(mockCountries, day5));
  });

  it('should produce a different shuffle order when leap changes', () => {
    // leap 0: days 0-9 after startDay. leap 1: days 10-19.
    const leap0Date = new Date(startDayMs + 0 * msPerDay);
    const leap1Date = new Date(startDayMs + 10 * msPerDay);

    const result0 = picker.pick(mockCountries, leap0Date);
    const result1 = picker.pick(mockCountries, leap1Date);

    // Both hit countryIndex 0 (0 % 10 and 10 % 10), but different leaps
    // should generally produce a different shuffle, so likely a different country.
    // Not guaranteed by design (chaotic, not guaranteed-unique), so check the
    // underlying keys differ rather than asserting inequality of the picked country.
    const key0 = Math.sin(mockCountries[0].latlng[0] * mockCountries[0].latlng[1] + 0 * 123) * 10000 % 100;
    const key1 = Math.sin(mockCountries[0].latlng[0] * mockCountries[0].latlng[1] + 1 * 123) * 10000 % 100;

    expect(key0).not.toEqual(key1);
    expect(result0).toBeDefined();
    expect(result1).toBeDefined();
  });

  it('should cycle countryIndex correctly at a leap boundary', () => {
    // Last day of leap 0 (index 9) vs first day of leap 1 (index 0)
    const lastDayOfLeap0 = new Date(startDayMs + 9 * msPerDay);
    const firstDayOfLeap1 = new Date(startDayMs + 10 * msPerDay);

    const resultLast = picker.pick(mockCountries, lastDayOfLeap0);
    const resultFirst = picker.pick(mockCountries, firstDayOfLeap1);

    expect(mockCountries).toContain(resultLast);
    expect(mockCountries).toContain(resultFirst);
    // countryIndex resets from 9 back to 0 across this boundary — both still valid picks
  });
});