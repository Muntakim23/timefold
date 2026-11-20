export type ThemeChoice = 'system' | 'light' | 'dark' | 'frosted-light' | 'frosted-dark';
export function resolveAppearance(choice: ThemeChoice, system: 'light' | 'dark' | null | undefined, effects: boolean) {
  return { dark: choice === 'system' ? system === 'dark' : choice === 'dark' || choice === 'frosted-dark', frost: effects && choice.startsWith('frosted-') };
}
export function dropMinute(y: number, hourHeight: number, interval: number): number | null {
  if (!Number.isFinite(y) || y < 0 || y >= 24 * hourHeight || hourHeight <= 0 || interval <= 0) return null;
  return Math.min(1440 - interval, Math.round((y / hourHeight * 60) / interval) * interval);
}
