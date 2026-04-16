import { describe, expect, it } from 'vitest';
import { bytesToHuman, relativeTime } from './format.js';

describe('relativeTime', () => {
  const NOW = 1_700_000_000_000;

  it('shows "just now" for very recent', () => {
    expect(relativeTime(NOW - 1000, NOW)).toBe('just now');
    expect(relativeTime(NOW, NOW)).toBe('just now');
  });

  it('shows seconds for under a minute', () => {
    expect(relativeTime(NOW - 30_000, NOW)).toBe('30s');
  });

  it('shows minutes / hours / days', () => {
    expect(relativeTime(NOW - 5 * 60_000, NOW)).toBe('5m');
    expect(relativeTime(NOW - 2 * 3_600_000, NOW)).toBe('2h');
    expect(relativeTime(NOW - 3 * 86_400_000, NOW)).toBe('3d');
  });
});

describe('bytesToHuman', () => {
  it('formats sizes', () => {
    expect(bytesToHuman(500)).toBe('500B');
    expect(bytesToHuman(2048)).toBe('2.0KB');
    expect(bytesToHuman(1_500_000)).toBe('1.43MB');
  });
});
