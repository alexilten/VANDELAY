import { describe, expect, it } from 'vitest';
import { guessCategory } from './guess';

describe('guessCategory', () => {
  it.each([
    ['A 30,000-seat soccer stadium', 'venue'],
    ['Apartments over shops', 'mixed-use'],
    ['A café with a terrace', 'business'],
    ['A small home on a sloped lot', 'home'],
    ['', 'home'],
  ])('%s → %s', (text, expected) => {
    expect(guessCategory(text)).toBe(expected);
  });
});
