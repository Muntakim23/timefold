export type Block = {
  id: string; noteDate: string; text: string; kind: 'text' | 'task';
  completed: boolean; position: number; start: string | null; end: string | null; timezone: string | null;
};

export type Backup = { version: 1; blocks: Block[] };

export function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function scheduleBlock(block: Block, start: string, end: string, timezone: string): Block {
  if (!Number.isFinite(Date.parse(start)) || !Number.isFinite(Date.parse(end)) || Date.parse(end) <= Date.parse(start) || !timezone) throw new Error('Invalid schedule');
  return { ...block, start, end, timezone };
}

export function restoreSchedule(current: Block, previous: Block): Block {
  if (current.id !== previous.id) throw new Error('Cannot restore a different block');
  return { ...current, start: previous.start, end: previous.end, timezone: previous.timezone };
}

export function validateBackup(value: unknown): Backup {
  if (!value || typeof value !== 'object') throw new Error('Invalid backup');
  const backup = value as Record<string, unknown>;
  if (backup.version !== 1 || !Array.isArray(backup.blocks)) throw new Error('Unsupported backup format');
  const ids = new Set<string>();
  for (const item of backup.blocks) {
    if (!item || typeof item !== 'object') throw new Error('Invalid block');
    const b = item as Block;
    if (typeof b.id !== 'string' || !b.id || ids.has(b.id) || typeof b.noteDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(b.noteDate) || typeof b.text !== 'string' || !['text', 'task'].includes(b.kind) || typeof b.completed !== 'boolean' || !Number.isInteger(b.position) || b.position < 0) throw new Error('Invalid block in backup');
    const [year, month, day] = b.noteDate.split('-').map(Number);
    const date = new Date(0);
    date.setUTCFullYear(year, month - 1, day);
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) throw new Error('Invalid daily date in backup');
    if (b.start === null && b.end === null && b.timezone === null) { /* unscheduled */ }
    else if (typeof b.start === 'string' && typeof b.end === 'string' && typeof b.timezone === 'string') scheduleBlock(b, b.start, b.end, b.timezone);
    else throw new Error('Invalid schedule in backup');
    ids.add(b.id);
  }
  return backup as Backup;
}
