import { describe, it, expect } from 'vitest';
import { formatDate, getTermLabel, getConfidentialityLabel } from './dateUtils';

describe('formatDate', () => {
  it('returns "[Date]" for empty string', () => {
    expect(formatDate('')).toBe('[Date]');
  });

  it('returns "[Date]" for undefined', () => {
    expect(formatDate(undefined)).toBe('[Date]');
  });

  it('formats valid date correctly', () => {
    expect(formatDate('2025-06-15')).toBe('June 15, 2025');
  });

  it('formats date with single digit day and month', () => {
    expect(formatDate('2025-01-01')).toBe('January 1, 2025');
  });
});

describe('getTermLabel', () => {
  it('returns "1 year(s)" for "1year"', () => {
    expect(getTermLabel('1year')).toBe('1 year(s)');
  });

  it('returns "continues until terminated" for "continues"', () => {
    expect(getTermLabel('continues')).toBe('continues until terminated');
  });
});

describe('getConfidentialityLabel', () => {
  it('returns correct label for "1year"', () => {
    expect(getConfidentialityLabel('1year')).toBe('1 year(s) from Effective Date, but in the case of trade secrets until Confidential Information is no longer considered a trade secret under applicable laws');
  });

  it('returns "in perpetuity" for "perpetuity"', () => {
    expect(getConfidentialityLabel('perpetuity')).toBe('in perpetuity');
  });
});