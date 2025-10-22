import { ApiService } from '../common/utils/api.service';

describe('ApiService', () => {
  it('maps weather response correctly', () => {
    const api = new ApiService({} as any, { get: () => '' } as any);
    const raw = {
      main: { temp: 300.15, humidity: 80, pressure: 1012 },
      weather: [{ description: 'clear sky' }],
      wind: { speed: 3.5, deg: 180 },
      visibility: 10000,
      name: 'Tamale',
      sys: { country: 'GH' },
    };
    // Use the internal mapping function by directly calling the mapping
    const mapped = (api as any).apiConfigs.get('weather').responseMapping(raw);
    expect(mapped.city).toBe('Tamale');
    expect(mapped.temperature_celsius).toBe(Math.round(300.15 - 273.15));
  });
});
