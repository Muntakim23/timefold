export type ReminderSettings = { enabled: boolean; offsetMinutes: number; repeat: 'never' | 'daily' | 'weekly' };
export const defaultReminder: ReminderSettings = { enabled: false, offsetMinutes: 0, repeat: 'never' };

export type ReminderPlan = { kind: 'date'; at: Date } | { kind: 'daily'; hour: number; minute: number } | { kind: 'weekly'; weekday: number; hour: number; minute: number };

export function planReminder(start: string | null, settings: ReminderSettings, now = new Date()): ReminderPlan | null {
  if (!settings.enabled) return null;
  if (!start || !Number.isFinite(Date.parse(start)) || ![0, 5, 15, 30, 60].includes(settings.offsetMinutes) || !['never', 'daily', 'weekly'].includes(settings.repeat)) throw new Error('Choose a valid reminder time.');
  const at = new Date(Date.parse(start) - settings.offsetMinutes * 60000);
  at.setSeconds(0, 0);
  if (at.getTime() <= now.getTime()) throw new Error('The reminder must be in the future. Choose a later time or turn the reminder off.');
  if (settings.repeat === 'never') return { kind: 'date', at };
  const first = new Date(now);
  first.setHours(at.getHours(), at.getMinutes(), 0, 0);
  if (settings.repeat === 'weekly') first.setDate(first.getDate() + (at.getDay() - first.getDay() + 7) % 7);
  if (first.getTime() <= now.getTime()) first.setDate(first.getDate() + (settings.repeat === 'weekly' ? 7 : 1));
  // Native repeating triggers have no start-date field. Never silently notify before the chosen date.
  if (first.getTime() !== at.getTime()) throw new Error(`A ${settings.repeat} reminder starts at the next matching time. Choose that date, or select Never for repeat.`);
  return settings.repeat === 'daily' ? { kind: 'daily', hour: at.getHours(), minute: at.getMinutes() } : { kind: 'weekly', weekday: at.getDay() + 1, hour: at.getHours(), minute: at.getMinutes() };
}
