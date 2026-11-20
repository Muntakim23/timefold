import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CalendarPeriod, monthGridDates, scheduledOnDay, weekDates } from '../core/calendar';
import { Block, localDateKey } from '../core/model';
import { GlassSurface, useGlassMotion } from './glass-surface';
import { deviceEventsOnDay, type DeviceEvent } from '../core/device-calendar';

type Props = {
  period: Exclude<CalendarPeriod, 'day'>; date: Date; blocks: Block[];
  onDate: (date: Date) => void; onPeriod: (period: CalendarPeriod) => void;
  dark: boolean; effects: boolean; textColor: string; mutedColor: string; lineColor: string;
  deviceEvents: DeviceEvent[];
};

export function CalendarOverview({ period, date, blocks, onDate, onPeriod, dark, effects, textColor, mutedColor, lineColor, deviceEvents }: Props) {
  const [offset] = useState(() => new Animated.Value(0));
  const previousMonth = useRef(date.getFullYear() * 12 + date.getMonth());
  const monthIndex = date.getFullYear() * 12 + date.getMonth();
  const reduced = useGlassMotion();
  useEffect(() => {
    const direction = Math.sign(monthIndex - previousMonth.current);
    previousMonth.current = monthIndex;
    if (!direction || period !== 'month' || reduced) { offset.setValue(0); return; }
    offset.setValue(direction * 12);
    const animation = Animated.spring(offset, { toValue: 0, stiffness: 420, damping: 41, mass: 1, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [monthIndex, offset, period, reduced]);
  const scheduled = blocks.filter(block => block.start !== null);
  const itemsForDay = (day: Date) => scheduledOnDay(scheduled, day);
  const openDay = (day: Date) => { onDate(day); onPeriod('day'); };
  const days = period === 'week' ? weekDates(date) : monthGridDates(date);

  if (period === 'year') return <ScrollView style={styles.scroll}>
    {Array.from({ length: 12 }, (_, month) => {
      const monthDate = new Date(date.getFullYear(), month, 1, 12);
      const start = new Date(date.getFullYear(), month, 1).getTime();
      const end = new Date(date.getFullYear(), month + 1, 1).getTime();
      const count = scheduled.filter(block => block.end && Date.parse(block.start!) < end && Date.parse(block.end) > start).length
        + deviceEvents.filter(event => event.start < end && event.end > start).length;
      return <Pressable key={month} accessibilityRole="button" accessibilityLabel={`${monthDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}, ${count} scheduled`} onPress={() => { onDate(monthDate); onPeriod('month'); }} style={[styles.monthRow, { borderColor: lineColor }]}>
        <GlassSurface dark={dark} enabled={effects} /><Text style={{ color: textColor }}>{monthDate.toLocaleDateString(undefined, { month: 'long' })}</Text><Text style={{ color: mutedColor }}>{count || ''}</Text>
      </Pressable>;
    })}
  </ScrollView>;

  if (period === 'week') return <ScrollView style={styles.scroll}>
    {days.map(day => { const items = itemsForDay(day); const external = deviceEventsOnDay(deviceEvents, day); return <Pressable key={localDateKey(day)} accessibilityRole="button" onPress={() => openDay(day)} style={[styles.weekRow, { borderColor: lineColor }]}>
      <GlassSurface dark={dark} enabled={effects} /><Text style={{ color: textColor, fontWeight: '600' }}>{day.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</Text>
      {items.map(block => <Text key={block.id} style={{ color: mutedColor }} numberOfLines={1}>{new Date(block.start!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}  {block.text || 'Untitled'}</Text>)}
      {external.map(event => <View key={`${event.calendarId}:${event.id}:${event.start}`} style={{ borderLeftWidth: 3, borderLeftColor: event.color || mutedColor, paddingLeft: 6, backgroundColor: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }}><Text style={{ color: textColor }} numberOfLines={2}>{event.allDay ? 'All day' : `${new Date(event.start).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} – ${new Date(event.end).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`}  {event.title}</Text><Text style={{ color: mutedColor, fontSize: 11 }} numberOfLines={1}>Google Calendar · {event.calendarName || 'Calendar'}</Text></View>)}
      {!items.length && !external.length && <Text style={{ color: mutedColor }}>No events</Text>}
    </Pressable>; })}
  </ScrollView>;

  return <ScrollView style={styles.scroll} contentContainerStyle={styles.monthGrid}>
      <View style={styles.monthSurface}>
      <GlassSurface dark={dark} enabled={effects} radius={16} />
      <Animated.View style={{ transform: [{ translateX: offset }] }}>
      <View style={styles.gridRow}>{weekDates(date).map(day => <Text key={day.getDay()} style={[styles.weekday, { color: mutedColor }]}>{day.toLocaleDateString(undefined, { weekday: 'narrow' })}</Text>)}</View>
      {Array.from({ length: days.length / 7 }, (_, row) => <View style={styles.gridRow} key={row}>{days.slice(row * 7, row * 7 + 7).map(day => {
        const count = itemsForDay(day).length + deviceEventsOnDay(deviceEvents, day).length;
        const selected = localDateKey(day) === localDateKey(date);
        return <Pressable key={localDateKey(day)} accessibilityRole="button" accessibilityLabel={`${day.toDateString()}, ${count} scheduled`} onPress={() => openDay(day)} style={[styles.dayCell, selected && { backgroundColor: dark ? '#4d4f55' : '#33353a' }]}>
          <Text style={{ color: selected ? '#fff' : day.getMonth() === date.getMonth() ? textColor : mutedColor }}>{day.getDate()}</Text>{count > 0 && <Text style={{ color: selected ? '#fff' : mutedColor, fontSize: 10 }}>{count}</Text>}
        </Pressable>;
      })}</View>)}
      </Animated.View>
      </View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  weekRow: { minHeight: 64, padding: 8, marginBottom: 4, borderRadius: 10, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, gap: 4 },
  monthRow: { minHeight: 48, paddingHorizontal: 12, marginBottom: 4, borderRadius: 10, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  monthGrid: { paddingHorizontal: 4, paddingVertical: 8 },
  monthSurface: { width: '100%', maxWidth: 640, alignSelf: 'center', padding: 4, borderRadius: 16 },
  gridRow: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', paddingVertical: 8 },
  dayCell: { flex: 1, minWidth: 0, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, overflow: 'hidden' },
});
