import { beforeEach, expect, mock, test } from 'bun:test';
import { Database } from 'bun:sqlite';

const database = new Database(':memory:');
mock.module('expo-sqlite', () => ({
  openDatabaseAsync: async () => ({
    execAsync: async (sql: string) => database.exec(sql),
    execSync: (sql: string) => database.exec(sql),
    runSync: (sql: string, ...params: (string | number | null)[]) => database.query(sql).run(...params),
    getFirstSync: (sql: string, ...params: (string | number | null)[]) => database.query(sql).get(...params),
    getAllSync: (sql: string, ...params: (string | number | null)[]) => database.query(sql).all(...params),
    withTransactionSync: (callback: () => void) => database.transaction(callback)(),
  }),
}));

const { allBlocks, getBlock, initializeStorage, restoreBackup, saveBlock, removeBlock, removeDailyNote, restoreDeletedBlocks } = await import('./store');
await initializeStorage();
const block = { id: 'b1', noteDate: '2026-11-18', text: 'Original', kind: 'task' as const, completed: false, position: 0, start: null, end: null, timezone: null };
beforeEach(() => database.exec('DELETE FROM blocks'));

test('reading the current saved block keeps a newer edit', () => {
  saveBlock(block);
  saveBlock({ ...block, text: 'Edited after opening schedule', completed: true });
  const current = getBlock(block.id);
  expect(current?.text).toBe('Edited after opening schedule');
  expect(current?.completed).toBe(true);
});

test('restore preserves existing data and rejects invalid dates', () => {
  saveBlock(block);
  expect(() => restoreBackup({ version: 1, blocks: [{ ...block, id: 'b2' }] })).toThrow('empty library');
  expect(allBlocks()).toEqual([block]);
  database.exec('DELETE FROM blocks');
  expect(() => restoreBackup({ version: 1, blocks: [{ ...block, noteDate: '2026-02-31' }] })).toThrow('Invalid daily date');
  expect(allBlocks()).toEqual([]);
  restoreBackup({ version: 1, blocks: [block] });
  expect(allBlocks()).toEqual([block]);
});

test('deleting a task removes its schedule without deleting its neighbor; Undo restores it', () => {
  const scheduled = { ...block, start: '2026-11-18T12:00:00Z', end: '2026-11-18T13:00:00Z', timezone: 'UTC' };
  const neighbor = { ...block, id: 'neighbor' };
  saveBlock(scheduled); saveBlock(neighbor);
  removeBlock(scheduled.id);
  expect(getBlock(scheduled.id)).toBeNull();
  expect(allBlocks()).toEqual([neighbor]);
  restoreDeletedBlocks([scheduled]);
  expect(getBlock(scheduled.id)).toEqual(scheduled);
});

test('daily deletion preserves items from other pages scheduled on that day', () => {
  const linked = { ...block, id: 'other-page', noteDate: '2026-11-17', start: '2026-11-18T12:00:00Z', end: '2026-11-18T13:00:00Z', timezone: 'UTC' };
  saveBlock(block); saveBlock(linked);
  const deleted = removeDailyNote(block.noteDate);
  expect(deleted).toEqual([block]);
  expect(allBlocks()).toEqual([linked]);
  restoreDeletedBlocks(deleted);
  expect(getBlock(block.id)).toEqual(block);
});

test('Undo rolls back as a unit when an ID already exists', () => {
  saveBlock(block);
  expect(() => restoreDeletedBlocks([{ ...block, id: 'new' }, { ...block, text: 'stale' }])).toThrow('overwrite');
  expect(getBlock('new')).toBeNull();
  expect(getBlock(block.id)?.text).toBe('Original');
});
