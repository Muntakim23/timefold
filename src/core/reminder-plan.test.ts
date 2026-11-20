import { describe, expect, test } from 'bun:test';
import { defaultReminder, planReminder } from './reminder-plan';

describe('local reminder planning', () => {
  const now = new Date(2026, 10, 18, 10, 0);
  test('disabled reminders allow past or missing schedules', () => {
    expect(planReminder(null, defaultReminder, now)).toBeNull();
  });
  test('subtracts the offset and rejects elapsed reminders', () => {
    const start = new Date(2026, 10, 18, 11, 0).toISOString();
    expect(planReminder(start, { enabled: true, offsetMinutes: 15, repeat: 'never' }, now)).toEqual({ kind: 'date', at: new Date(2026, 10, 18, 10, 45) });
    expect(() => planReminder(start, { enabled: true, offsetMinutes: 60, repeat: 'never' }, now)).toThrow('future');
  });
  test('does not schedule a daily notification earlier than the requested first date', () => {
    expect(() => planReminder(new Date(2026, 10, 20, 11).toISOString(), { enabled: true, offsetMinutes: 0, repeat: 'daily' }, now)).toThrow('next matching time');
    expect(planReminder(new Date(2026, 10, 18, 11).toISOString(), { enabled: true, offsetMinutes: 0, repeat: 'daily' }, now)).toEqual({ kind: 'daily', hour: 11, minute: 0 });
  });
  test('weekly reminders use the offset date, even across midnight', () => {
    expect(planReminder(new Date(2026, 10, 19, 0, 5).toISOString(), { enabled: true, offsetMinutes: 15, repeat: 'weekly' }, now)).toEqual({ kind: 'weekly', weekday: 4, hour: 23, minute: 50 });
  });
});
