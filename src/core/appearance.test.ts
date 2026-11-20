import { expect, test } from 'bun:test';
import { resolveAppearance, dropMinute } from './appearance';

test('system appearance follows the device while explicit choices override it', () => {
  expect(resolveAppearance('system', 'dark', true)).toEqual({ dark: true, frost: false });
  expect(resolveAppearance('frosted-light', 'dark', true)).toEqual({ dark: false, frost: true });
  expect(resolveAppearance('frosted-dark', 'light', false)).toEqual({ dark: true, frost: false });
});

test('drop position snaps to the nearest 15 minutes and rejects outside the day', () => {
  expect(dropMinute(11 * 64 + 18, 64, 15)).toBe(675);
  expect(dropMinute(-10, 64, 15)).toBeNull();
  expect(dropMinute(24 * 64, 64, 15)).toBeNull();
});
