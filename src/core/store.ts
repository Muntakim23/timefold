import * as SQLite from 'expo-sqlite';
import { Backup, Block, validateBackup } from './model';

type Row = Omit<Block, 'completed'> & { completed: number };
let db: SQLite.SQLiteDatabase | null = null;
let initialization: Promise<void> | null = null;

export function initializeStorage(): Promise<void> {
  if (!initialization) initialization = (async () => {
    const opened = await SQLite.openDatabaseAsync('donefold.db');
    await opened.execAsync(`PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS blocks (id TEXT PRIMARY KEY NOT NULL, noteDate TEXT NOT NULL, text TEXT NOT NULL, kind TEXT NOT NULL, completed INTEGER NOT NULL, position INTEGER NOT NULL, start TEXT, end TEXT, timezone TEXT);
CREATE TABLE IF NOT EXISTS preferences (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS blocks_date ON blocks(noteDate, position);`);
    db = opened;
  })().catch(error => { initialization = null; throw error; });
  return initialization;
}

function database(): SQLite.SQLiteDatabase {
  if (!db) throw new Error('Storage has not finished opening');
  return db;
}

const fromRow = (row: Row): Block => ({ ...row, completed: !!row.completed });
export function allBlocks(): Block[] { return database().getAllSync<Row>('SELECT * FROM blocks ORDER BY noteDate DESC, position ASC').map(fromRow); }
export function getBlock(id: string): Block | null { const row = database().getFirstSync<Row>('SELECT * FROM blocks WHERE id = ?', id); return row ? fromRow(row) : null; }
export function saveBlock(b: Block): void {
  database().runSync('INSERT INTO blocks (id,noteDate,text,kind,completed,position,start,end,timezone) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET noteDate=excluded.noteDate,text=excluded.text,kind=excluded.kind,completed=excluded.completed,position=excluded.position,start=excluded.start,end=excluded.end,timezone=excluded.timezone', b.id,b.noteDate,b.text,b.kind,b.completed ? 1 : 0,b.position,b.start,b.end,b.timezone);
}
export function removeBlock(id: string): void { database().runSync('DELETE FROM blocks WHERE id = ?', id); }
// Delete by source page, never by scheduled date: other pages can share its calendar day.
export function removeDailyNote(noteDate: string): Block[] {
  let removed: Block[] = [];
  database().withTransactionSync(() => {
    removed = database().getAllSync<Row>('SELECT * FROM blocks WHERE noteDate = ?', noteDate).map(fromRow);
    database().runSync('DELETE FROM blocks WHERE noteDate = ?', noteDate);
  });
  return removed;
}
export function restoreDeletedBlocks(blocks: Block[]): void {
  database().withTransactionSync(() => {
    for (const block of blocks) {
      if (getBlock(block.id)) throw new Error('Cannot overwrite an existing note during Undo.');
      saveBlock(block);
    }
  });
}
export function readPreference(key: string): string | null { return database().getFirstSync<{value: string}>('SELECT value FROM preferences WHERE key = ?', key)?.value ?? null; }
export function writePreference(key: string, value: string): void { database().runSync('INSERT INTO preferences (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', key, value); }
export function restoreBackup(raw: unknown): void {
  const backup: Backup = validateBackup(raw);
  database().withTransactionSync(() => {
    if (database().getFirstSync<{count: number}>('SELECT count(*) as count FROM blocks')!.count !== 0) throw new Error('Restore is only available in an empty library.');
    for (const block of backup.blocks) saveBlock(block);
  });
}
