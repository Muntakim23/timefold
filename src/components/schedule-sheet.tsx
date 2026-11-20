import { useEffect, useState } from 'react';
import { BackHandler, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SymbolView } from 'expo-symbols';
import type { Block } from '../core/model';
import { defaultReminder, type ReminderSettings } from '../core/reminder-plan';
import { GlassSurface } from './glass-surface';
import { FrostSwitch } from './frost-switch';
import { ChoiceSelect } from './choice-controls';

type Props = {
  selected: Block;
  initialDate: Date;
  initialReminder?: ReminderSettings;
  dark: boolean;
  effects: boolean;
  onClose: () => void;
  onSave: (date: Date, reminder: ReminderSettings) => boolean | Promise<boolean>;
  onUnschedule: () => boolean | Promise<boolean>;
};

export function ScheduleSheet({ selected, initialDate, initialReminder = defaultReminder, dark, effects, onClose, onSave, onUnschedule }: Props) {
  const insets = useSafeAreaInsets();
  const [date, setDate] = useState(() => { const next = new Date(initialDate); next.setSeconds(0, 0); return next; });
  const [reminder, setReminder] = useState(initialReminder);
  const [picker, setPicker] = useState<'date' | 'time' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const foreground = dark ? '#eeeeef' : '#202022';
  const muted = dark ? '#aeafb5' : '#65666d';
  const close = () => { if (!busy) onClose(); };

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { if (!busy) onClose(); return true; });
    return () => sub.remove();
  }, [busy, onClose]);

  const submit = async (action: () => boolean | Promise<boolean>) => {
    if (busy) return;
    setBusy(true); setError('');
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not save this schedule. Please try again.'); }
    finally { setBusy(false); }
  };
  const button = (label: string, onPress: () => void, active = false) => <Pressable key={label} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: busy }} disabled={busy} onPress={onPress} style={[styles.button, { opacity: busy ? 0.5 : 1 }]}><GlassSurface dark={dark} enabled={effects} active={active} /><Text style={{ color: active ? '#fff' : foreground, fontWeight: '600' }}>{label}</Text></Pressable>;

  return <View style={styles.overlay} accessibilityViewIsModal>
    <Pressable accessibilityRole="button" accessibilityLabel="Close scheduling panel" onPress={close} style={[StyleSheet.absoluteFill, { backgroundColor: dark ? 'rgba(0,0,0,0.24)' : 'rgba(24,24,28,0.12)' }]} />
    <View style={[styles.sheet, { marginBottom: Math.max(insets.bottom, 8) }]}>
      <GlassSurface dark={dark} enabled={effects} />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: dark ? 'rgba(28,28,31,0.68)' : 'rgba(250,250,251,0.62)' }]} />
      <View style={styles.header}>
        <View style={styles.heading}><Text style={[styles.title, { color: foreground }]}>Schedule task</Text><Text numberOfLines={2} style={[styles.taskName, { color: muted }]}>{selected.text}</Text></View>
        <Pressable disabled={busy} onPress={close} accessibilityRole="button" accessibilityLabel="Close scheduling panel" style={styles.close}><SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} size={18} tintColor={foreground} /></Pressable>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
        <View style={styles.dateTime}>
          <Pressable disabled={busy} accessibilityRole="button" accessibilityLabel="Choose schedule date" onPress={() => setPicker(picker === 'date' ? null : 'date')} style={styles.dateControl}><GlassSurface dark={dark} enabled={effects} /><Text style={[styles.label, { color: muted }]}>Date</Text><Text style={[styles.value, { color: foreground }]}>{date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</Text></Pressable>
          <Pressable disabled={busy} accessibilityRole="button" accessibilityLabel="Choose schedule time" onPress={() => setPicker(picker === 'time' ? null : 'time')} style={styles.timeControl}><GlassSurface dark={dark} enabled={effects} /><Text style={[styles.label, { color: muted }]}>Time</Text><Text style={[styles.time, { color: foreground }]}>{date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text></Pressable>
        </View>
        {picker && (Platform.OS === 'web'
          ? <GraphicalPicker mode={picker} date={date} onChange={setDate} dark={dark} />
          : <View style={styles.picker}><DateTimePicker value={date} mode={picker} display={Platform.OS === 'android' ? picker === 'date' ? 'calendar' : 'clock' : 'spinner'} themeVariant={dark ? 'dark' : 'light'} textColor={foreground} accentColor={foreground} onValueChange={(_, value) => { setDate(value); if (Platform.OS === 'android') setPicker(null); }} onDismiss={() => setPicker(null)} />{Platform.OS === 'ios' && button('Done', () => setPicker(null))}</View>)}
        <View style={[styles.reminderRow, { borderTopColor: dark ? '#424246' : '#dedee2' }]}><View style={styles.heading}><Text style={[styles.value, { color: foreground }]}>Reminder</Text><Text style={[styles.label, { color: muted }]}>{Platform.OS === 'web' ? 'Available in the Android and iOS app' : 'Notify me on this device'}</Text></View><FrostSwitch value={reminder.enabled} onValueChange={enabled => { if (Platform.OS !== 'web' && !busy) setReminder({ ...reminder, enabled }); }} label="Reminder" disabled={busy || Platform.OS === 'web'} dark={dark} /></View>
        {reminder.enabled && <>
          <ChoiceSelect label="Remind me" value={String(reminder.offsetMinutes)} options={[0, 5, 15, 30, 60].map(offset => ({ value: String(offset), label: offset === 0 ? 'At time' : `${offset} min before` }))} onChange={value => setReminder({ ...reminder, offsetMinutes: Number(value) })} dark={dark} effects={effects} disabled={busy} />
          <ChoiceSelect label="Repeat reminder" value={reminder.repeat} options={[{ value: 'never', label: 'Never' }, { value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' }]} onChange={value => { if (value === 'never' || value === 'daily' || value === 'weekly') setReminder({ ...reminder, repeat: value }); }} dark={dark} effects={effects} disabled={busy} />
          <Text style={[styles.note, { color: muted }]}>Repeats the notification; your note and calendar entry stay linked. Device settings may delay delivery.</Text>
        </>}
        {!!error && <Text accessibilityRole="alert" style={{ color: dark ? '#ffb4b4' : '#a62727', lineHeight: 20 }}>{error}</Text>}
      </ScrollView>
      <View style={styles.footer}>{selected.start && button('Unschedule', () => { void submit(onUnschedule); })}<View style={styles.actions}>{button('Cancel', close)}{button(busy ? 'Saving…' : 'Save', () => { void submit(() => onSave(date, reminder)); }, true)}</View></View>
    </View>
  </View>;
}

function GraphicalPicker({ mode, date, onChange, dark }: { mode: 'date' | 'time'; date: Date; onChange: (date: Date) => void; dark: boolean }) {
  const text = { color: dark ? '#eeeef0' : '#222225' };
  const [month, setMonth] = useState(() => new Date(date.getFullYear(), date.getMonth(), 1));
  if (mode === 'time') return <View style={styles.webClock}>{(['hour', 'minute'] as const).map(part => <View style={styles.wheel} key={part}><Text style={[styles.label, text]}>{part === 'hour' ? 'Hour (24h)' : 'Minute'}</Text><ScrollView style={{ height: 176 }}>{Array.from({ length: part === 'hour' ? 24 : 60 }, (_, value) => <Pressable key={value} accessibilityRole="button" accessibilityLabel={`Set ${part} ${value}`} accessibilityState={{ selected: value === (part === 'hour' ? date.getHours() : date.getMinutes()) }} onPress={() => { const next = new Date(date); if (part === 'hour') next.setHours(value); else next.setMinutes(value); onChange(next); }} style={[styles.wheelItem, value === (part === 'hour' ? date.getHours() : date.getMinutes()) && { backgroundColor: dark ? '#414146' : '#dddde2' }]}><Text style={[styles.value, text]}>{String(value).padStart(2, '0')}</Text></Pressable>)}</ScrollView></View>)}</View>;
  const offset = month.getDay();
  const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  return <View><View style={styles.monthHeader}><Pressable style={styles.close} accessibilityRole="button" accessibilityLabel="Previous month" onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><Text style={text}>‹</Text></Pressable><Text style={[styles.value, text]}>{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</Text><Pressable style={styles.close} accessibilityRole="button" accessibilityLabel="Next month" onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><Text style={text}>›</Text></Pressable></View><View style={styles.calendar}>{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => <View key={`day-${i}`} style={styles.calendarCell}><Text style={text}>{day}</Text></View>)}{Array.from({ length: offset + count }, (_, i) => i < offset ? <View key={i} style={styles.calendarCell} /> : <Pressable key={i} accessibilityRole="button" accessibilityLabel={new Date(month.getFullYear(), month.getMonth(), i - offset + 1).toDateString()} accessibilityState={{ selected: date.getFullYear() === month.getFullYear() && date.getMonth() === month.getMonth() && date.getDate() === i - offset + 1 }} onPress={() => { const next = new Date(date); next.setFullYear(month.getFullYear(), month.getMonth(), i - offset + 1); onChange(next); }} style={[styles.calendarCell, date.getFullYear() === month.getFullYear() && date.getMonth() === month.getMonth() && date.getDate() === i - offset + 1 && { backgroundColor: dark ? '#414146' : '#dddde2' }]}><Text style={text}>{i - offset + 1}</Text></Pressable>)}</View></View>;
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, zIndex: 30, justifyContent: 'flex-end', paddingHorizontal: 8 },
  sheet: { width: '100%', maxWidth: 560, maxHeight: '88%', alignSelf: 'center', borderRadius: 24, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, paddingBottom: 16, gap: 12 },
  heading: { flex: 1, gap: 4 }, title: { fontSize: 20, fontWeight: '600' }, taskName: { fontSize: 14, lineHeight: 20 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 16 },
  body: { paddingHorizontal: 20, paddingBottom: 12, gap: 12 }, dateTime: { flexDirection: 'row', gap: 12 },
  dateControl: { flex: 1, minHeight: 76, justifyContent: 'center', gap: 6, padding: 12, borderRadius: 16, overflow: 'hidden' },
  timeControl: { flex: 1, minHeight: 76, justifyContent: 'center', gap: 4, padding: 12, borderRadius: 16, overflow: 'hidden' },
  label: { fontSize: 12, lineHeight: 18 }, value: { fontSize: 15, fontWeight: '500' }, time: { fontSize: 22, fontWeight: '600', fontVariant: ['tabular-nums'] },
  picker: { alignItems: 'stretch', overflow: 'hidden' }, reminderRow: { flexDirection: 'row', alignItems: 'center', minHeight: 64, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, button: { minHeight: 44, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center', borderRadius: 16, overflow: 'hidden' },
  note: { fontSize: 12, lineHeight: 18 }, footer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, padding: 16 }, actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, flexGrow: 1 },
  webClock: { flexDirection: 'row', gap: 16 }, wheel: { flex: 1, gap: 8 }, wheelItem: { height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, calendar: { flexDirection: 'row', flexWrap: 'wrap' }, calendarCell: { width: '14.285714%', height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
});


