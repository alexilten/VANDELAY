import { describe, expect, it } from 'vitest';
import { formatHour, sunPosition } from './sun';

describe('sunPosition', () => {
  it('puts the equinox noon sun due south at 90° minus latitude', () => {
    const s = sunPosition(37.8, 80, 12);
    expect(s.elevation).toBeCloseTo(52.2, 0);
    expect(s.azimuth).toBeCloseTo(180, 0);
    expect(s.dir[1]).toBeLessThan(0); // south is -Y
  });

  it('is higher at the summer solstice and lower at the winter one', () => {
    expect(sunPosition(37.8, 172, 12).elevation).toBeCloseTo(75.6, 0);
    expect(sunPosition(37.8, 355, 12).elevation).toBeCloseTo(28.8, 0);
  });

  it('rises in the east and sets in the west', () => {
    expect(sunPosition(37.8, 80, 9).azimuth).toBeLessThan(180);
    expect(sunPosition(37.8, 80, 9).dir[0]).toBeGreaterThan(0);
    expect(sunPosition(37.8, 80, 15).azimuth).toBeGreaterThan(180);
    expect(sunPosition(37.8, 355, 5).elevation).toBeLessThan(0);
  });

  it('returns a unit vector', () => {
    const [x, y, z] = sunPosition(10, 200, 16.5).dir;
    expect(Math.hypot(x, y, z)).toBeCloseTo(1, 6);
  });

  it('formats solar hours', () => {
    expect(formatHour(15.5)).toBe('3:30 pm');
    expect(formatHour(9)).toBe('9:00 am');
    expect(formatHour(12)).toBe('12:00 pm');
  });
});
