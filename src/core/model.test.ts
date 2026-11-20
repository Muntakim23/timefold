import { describe, expect, test } from 'bun:test';
import { localDateKey, scheduleBlock, restoreSchedule, validateBackup } from './model';

describe('Donefold data rules', () => {
  test('uses the local calendar date for daily pages', () => {
    expect(localDateKey(new Date(2026, 10, 18, 23, 30))).toBe('2026-11-18');
  });

  test('scheduling preserves the source block identity and content', () => {
    const block = { id: 'b1', noteDate: '2026-11-18', text: 'Call mechanic', kind: 'task' as const, completed: false, position: 0, start: null, end: null, timezone: null };
    const scheduled = scheduleBlock(block, '2026-11-18T05:00:00.000Z', '2026-11-18T06:00:00.000Z', 'Asia/Dhaka');
    expect(scheduled).toMatchObject({ id: 'b1', text: 'Call mechanic', start: '2026-11-18T05:00:00.000Z' });
    expect(block.start).toBeNull();
  });

  test('rejects invalid backup relationships before restoring', () => {
    expect(() => validateBackup({ version: 1, blocks: [{ id: 'x' }] })).toThrow();
  });

  test('rejects impossible daily dates before restoring a backup', () => {
    const block = { id: 'b1', noteDate: '2026-02-31', text: 'Hidden note', kind: 'text' as const, completed: false, position: 0, start: null, end: null, timezone: null };
    expect(() => validateBackup({ version: 1, blocks: [block] })).toThrow();
    expect(validateBackup({ version: 1, blocks: [{ ...block, noteDate: '2024-02-29' }] }).blocks).toHaveLength(1);
  });

  test('undoing a schedule preserves edits made after scheduling', () => {
    const old = { id: 'b1', noteDate: '2026-11-18', text: 'Old', kind: 'text' as const, completed: false, position: 0, start: null, end: null, timezone: null };
    const current = { ...scheduleBlock(old, '2026-11-18T05:00:00.000Z', '2026-11-18T06:00:00.000Z', 'Asia/Dhaka'), text: 'New' };
    expect(restoreSchedule(current, old)).toMatchObject({ text: 'New', start: null });
  });
});
