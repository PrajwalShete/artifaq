import { describe, expect, it } from 'vitest';
import { basename, relativeTime } from './format.js';

describe('relativeTime', () => {
  const NOW = 1_700_000_000_000;

  it('shows "just now" for very recent', () => {
    expect(relativeTime(NOW - 1000, NOW)).toBe('just now');
    expect(relativeTime(NOW, NOW)).toBe('just now');
  });

  it('shows seconds for under a minute', () => {
    expect(relativeTime(NOW - 30_000, NOW)).toBe('30s');
  });

  it('shows hours / days', () => {
    expect(relativeTime(NOW - 5 * 60_000, NOW)).toBe('5m');
    expect(relativeTime(NOW - 2 * 3_600_000, NOW)).toBe('2h');
    expect(relativeTime(NOW - 3 * 86_400_000, NOW)).toBe('3d');
  });
});

describe('basename', () => {
  it('extracts the last path segment', () => {
    expect(basename('/Users/me/projects/onboarding')).toBe('onboarding');
    expect(basename('C:\\\\Users\\\\me\\\\projects\\\\onboarding')).toBe('onboarding');
    expect(basename('plain.html')).toBe('plain.html');
  });
});
