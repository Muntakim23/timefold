import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { FrostSwitch } from './frost-switch';
import { FrostedTextButton } from './glass-surface';
import type { useGoogleCalendar } from '../hooks/use-google-calendar';

type Props = {
  calendar: ReturnType<typeof useGoogleCalendar>;
  dark: boolean;
  effects: boolean;
};

export function GoogleCalendarSettings({ calendar, dark, effects }: Props) {
  const ink = dark ? '#ededf0' : '#202025';
  const muted = dark ? '#b2b2bc' : '#5c5c65';
  const signingIn = calendar.status === 'signingIn';
  const unavailable = calendar.status === 'unconfigured' || calendar.status === 'unsupported';

  return (
    <View style={styles.group}>
      <View style={styles.status}>
        {calendar.loading && <ActivityIndicator size="small" color={muted} />}
        <Text accessibilityLiveRegion="polite" style={[styles.description, { color: muted }]}>
          {calendar.message || (calendar.loading ? 'Checking your connection…' : 'See events from your Google calendars alongside your tasks.')}
        </Text>
      </View>
      {calendar.enabled && calendar.calendars.map(item => (
        <View key={item.id} style={styles.calendar}>
          <View style={[styles.swatch, { backgroundColor: item.color || muted }]} />
          <Text style={[styles.name, { color: ink }]}>{item.title}</Text>
          <FrostSwitch
            label={`Show ${item.title}`}
            dark={dark}
            value={calendar.selected.includes(item.id)}
            onValueChange={value => calendar.choose(item.id, value)}
          />
        </View>
      ))}
      {calendar.enabled && <>
        <View style={styles.calendar}>
          <View style={styles.name}><Text style={{ color: ink }}>Sync tasks to Google</Text><Text style={{ color: muted, fontSize: 12 }}>Adds scheduled tasks to your primary calendar. Changes and deletions sync from Timefold.</Text></View>
          <FrostSwitch label="Sync tasks to Google" dark={dark} value={calendar.syncEnabled} onValueChange={calendar.setSyncEnabled} />
        </View>
        {!!calendar.syncMessage && <Text accessibilityLiveRegion="polite" style={{ color: muted }}>{calendar.syncMessage}</Text>}
        {calendar.syncEnabled && <FrostedTextButton label="Retry task sync" dark={dark} effects={effects} onPress={calendar.retrySync} />}
      </>}
      {calendar.enabled ? (
        <View style={styles.actions}>
          <FrostedTextButton label="Refresh" accessibilityLabel="Refresh Google calendars" dark={dark} effects={effects}
            disabled={calendar.loading} onPress={() => { void calendar.refresh(); }} />
          <FrostedTextButton label="Disconnect" accessibilityLabel="Disconnect Google Calendar" dark={dark} effects={effects}
            onPress={() => { void calendar.disconnect(); }} />
        </View>
      ) : !unavailable && (
        <FrostedTextButton label={signingIn ? 'Connecting…' : 'Connect Google Calendar'} dark={dark} effects={effects}
          disabled={calendar.loading || signingIn} style={styles.connect} onPress={() => { void calendar.connect(); }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 8 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  description: { flex: 1, lineHeight: 20 },
  calendar: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { flex: 1, fontSize: 15 },
  swatch: { width: 10, height: 10, borderRadius: 5 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  connect: { alignSelf: 'flex-start' },
});
