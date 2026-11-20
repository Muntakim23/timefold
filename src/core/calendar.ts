import { Block } from './model';

export type CalendarPeriod = 'day' | 'week' | 'month' | 'year';

export function scheduledOnDay(blocks: Block[], date: Date): Block[] {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime();
  return blocks.filter(block => block.start !== null && block.end !== null && Date.parse(block.start) < end && Date.parse(block.end) > start)
    .sort((a, b) => Date.parse(a.start!) - Date.parse(b.start!));
}

export function slotsForRange(start: number, end: number, date: Date): number[] {
  const slots: number[] = [];
  for (let index = 0; index < 96; index++) {
    const from = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, index * 15).getTime();
    const to = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, (index + 1) * 15).getTime();
    if (from < end && to > start) slots.push(index);
  }
  return slots;
}

export function movePeriod(date: Date, period: CalendarPeriod, direction: number): Date {
  const next = new Date(date);
  if (period === 'day' || period === 'week') {
    next.setDate(next.getDate() + direction * (period === 'week' ? 7 : 1));
  } else {
    const originalDay = next.getDate();
    next.setDate(1);
    if (period === 'month') next.setMonth(next.getMonth() + direction);
    else next.setFullYear(next.getFullYear() + direction);
    const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
    next.setDate(Math.min(originalDay, lastDay));
  }
  return next;
}

export function weekDates(date: Date): Date[] {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  start.setDate(start.getDate() - start.getDay());
  return Array.from({ length: 7 }, (_, index) => movePeriod(start, 'day', index));
}

export function monthDates(date: Date): Date[] {
  const first = new Date(date.getFullYear(), date.getMonth(), 1, 12);
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0, 12);
  const count = Math.ceil((first.getDay() + last.getDate()) / 7) * 7;
  const start = movePeriod(first, 'day', -first.getDay());
  return Array.from({ length: count }, (_, index) => movePeriod(start, 'day', index));
}

// Keep the month view's height stable while navigating between months.
export function monthGridDates(date: Date): Date[] {
  const first = new Date(date.getFullYear(), date.getMonth(), 1, 12);
  const start = movePeriod(first, 'day', -first.getDay());
  return Array.from({ length: 42 }, (_, index) => movePeriod(start, 'day', index));
}
