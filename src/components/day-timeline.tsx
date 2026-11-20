import { useCallback, useImperativeHandle, useMemo, useRef, useState, type ComponentRef, type Ref } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { DeviceEvent } from '../core/device-calendar';
import type { Block } from '../core/model';
import { slotsForRange } from '../core/calendar';

export type TimelineDragTarget = {
  begin: () => void;
  preview: (x: number, y: number) => void;
  finish: (x: number, y: number, select: (minute: number) => void) => void;
  cancel: () => void;
};

type Entry = { task: Block; start: number; end: number } | { event: DeviceEvent; start: number; end: number };
type Rect = { x: number; y: number; width: number; height: number; gridY: number };
type Colors = { text: string; muted: string; line: string; surface: string; event: string };
type Props = {
  ref: Ref<TimelineDragTarget>;
  date: Date;
  tasks: Block[];
  events: DeviceEvent[];
  colors: Colors;
  editTask: (task: Block) => void;
};
const time = (timestamp: number) => new Date(timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export function DayTimeline({ ref, date, tasks, events, colors, editTask }: Props) {
  const viewport = useRef<ComponentRef<typeof View>>(null);
  const grid = useRef<ComponentRef<typeof View>>(null);
  const bounds = useRef<Rect | null>(null);
  const slots = useRef<{ y: number; height: number }[]>([]);
  const gesture = useRef(0);
  const [highlight, setHighlight] = useState<number | null>(null);
  const [allDay, quarters] = useMemo(() => {
    const buckets: { item: Entry; first: boolean }[][] = Array.from({ length: 96 }, () => []);
    const entries: Entry[] = tasks.map(task => ({ task, start: Date.parse(task.start!), end: Date.parse(task.end!) }));
    const banners: DeviceEvent[] = [];
    for (const event of events) {
      if (event.allDay) banners.push(event);
      else entries.push({ event, start: event.start, end: event.end });
    }
    for (const item of entries.sort((a, b) => a.start - b.start)) {
      slotsForRange(item.start, item.end, date).forEach((slot, index) => buckets[slot].push({ item, first: index === 0 }));
    }
    return [banners, buckets] as const;
  }, [date, tasks, events]);

  const measure = useCallback((receive: (rect: Rect) => void) => {
    viewport.current?.measureInWindow((x, y, width, height) => {
      grid.current?.measureInWindow((_, gridY) => receive({ x, y, width, height, gridY }));
    });
  }, []);
  const findSlot = useCallback((rect: Rect, x: number, y: number) => {
    if (x < rect.x || x >= rect.x + rect.width || y < rect.y || y >= rect.y + rect.height) return -1;
    const local = y - rect.gridY;
    return slots.current.findIndex(slot => slot && local >= slot.y && local < slot.y + slot.height);
  }, []);
  useImperativeHandle(ref, () => ({
    begin() {
      const id = ++gesture.current;
      bounds.current = null;
      measure(rect => { if (id === gesture.current) bounds.current = rect; });
    },
    preview(x, y) {
      const slot = bounds.current ? findSlot(bounds.current, x, y) : -1;
      setHighlight(slot < 0 ? null : slot);
    },
    finish(x, y, select) {
      const id = ++gesture.current;
      bounds.current = null;
      setHighlight(null);
      measure(rect => {
        const slot = findSlot(rect, x, y);
        if (id === gesture.current && slot >= 0) select(slot * 15);
      });
    },
    cancel() { gesture.current++; bounds.current = null; setHighlight(null); },
  }), [findSlot, measure]);

  const externalCard = (event: DeviceEvent) => {
    const detail = event.allDay ? 'All day' : `${time(event.start)} – ${time(event.end)}`;
    return <View key={JSON.stringify([event.calendarId, event.id, event.start])} accessible accessibilityLabel={`${event.title}, ${detail}, ${event.calendarName || 'Google Calendar'}, read only`}
      style={[styles.card, { backgroundColor: colors.surface, borderLeftWidth: 3, borderLeftColor: event.color || colors.muted }]}>
      <Text style={[styles.meta, { color: colors.muted }]}>{detail}</Text>
      <Text style={[styles.cardTitle, { color: colors.text }]}>{event.title}</Text>
      <Text style={[styles.meta, { color: colors.muted }]}>{event.calendarName || 'Google Calendar'}</Text>
    </View>;
  };
  return <View ref={viewport} collapsable={false} style={styles.flex}>
    <ScrollView keyboardShouldPersistTaps="handled" style={styles.flex} contentContainerStyle={styles.content}>
      {allDay.length > 0 && <View style={styles.allDay}>{allDay.map(externalCard)}</View>}
      <View ref={grid} collapsable={false}>
        {quarters.map((items, index) => <View key={index} onLayout={({ nativeEvent: { layout } }) => { slots.current[index] = layout; }}
          style={[styles.slot, index % 4 === 0 && { borderTopColor: colors.line, borderTopWidth: StyleSheet.hairlineWidth }]}>
          {index % 4 === 0 && <Text style={[styles.hour, { color: colors.muted }]}>{String(index / 4).padStart(2, '0')}:00</Text>}
          {items.map(({ item, first }) => !first ? <View key={'event' in item ? `${item.event.calendarId}:${item.event.id}:${item.start}` : item.task.id} style={[styles.continuation, { backgroundColor: 'event' in item ? item.event.color || colors.muted : colors.muted }]} accessibilityLabel={`${'event' in item ? item.event.title : item.task.text} continues`} /> : 'event' in item ? externalCard(item.event) : <Pressable key={item.task.id}
            accessibilityRole="button" accessibilityLabel={`Edit schedule for ${item.task.text}`} onPress={() => editTask(item.task)}
            style={[styles.card, { backgroundColor: colors.event }]}>
            <Text style={[styles.meta, { color: colors.muted }]}>{time(item.start)}</Text>
            <Text style={[styles.cardTitle, { color: colors.text }]}>{item.task.text}</Text>
          </Pressable>)}
          {highlight === index && <View pointerEvents="none" style={[styles.target, { backgroundColor: colors.text }]}>
            <Text style={[styles.meta, { color: colors.surface }]}>Drop · {String(Math.floor(index / 4)).padStart(2, '0')}:{String(index % 4 * 15).padStart(2, '0')}</Text>
          </View>}
        </View>)}
      </View>
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  content: { paddingBottom: 96, paddingHorizontal: 4 },
  slot: { minHeight: 16, paddingLeft: 34 },
  hour: { position: 'absolute', left: 0, top: 1, fontSize: 10, fontVariant: ['tabular-nums'] },
  allDay: { gap: 3, paddingBottom: 8 },
  card: { borderRadius: 8, paddingHorizontal: 6, paddingVertical: 5, marginBottom: 2, gap: 2 },
  cardTitle: { fontSize: 13, fontWeight: '600' },
  meta: { fontSize: 11, fontVariant: ['tabular-nums'] },
  continuation: { height: 8, borderRadius: 3, marginBottom: 2 },
  target: { position: 'absolute', left: 2, right: 0, top: 0, borderRadius: 5, paddingHorizontal: 4, zIndex: 2 },
});

