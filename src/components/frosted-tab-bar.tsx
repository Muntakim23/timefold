import { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { FrostedGlassSurface, useGlassMotion } from './glass-surface';

export type FrostedTab = 'today' | 'calendar' | 'search';
const tabs: { value: FrostedTab; label: string; icon: SymbolViewProps['name'] }[] = [
  { value: 'today', label: 'Today', icon: { ios: 'square.and.pencil', android: 'edit_note', web: 'edit_note' } },
  { value: 'calendar', label: 'Calendar', icon: { ios: 'calendar', android: 'calendar_month', web: 'calendar_month' } },
  { value: 'search', label: 'Search', icon: { ios: 'magnifyingglass', android: 'search', web: 'search' } },
];

export function FrostedTabBar({ value, onChange, dark, effects, style }: {
  value: FrostedTab; onChange: (value: FrostedTab) => void; dark: boolean; effects: boolean; style?: StyleProp<ViewStyle>;
}) {
  const [width, setWidth] = useState(300);
  const [position] = useState(() => new Animated.Value(tabs.findIndex(tab => tab.value === value)));
  const reduceMotion = useGlassMotion();
  const segmentWidth = (width - 12) / 3;
  useEffect(() => {
    const next = tabs.findIndex(tab => tab.value === value);
    if (reduceMotion) { position.setValue(next); return; }
    const animation = Animated.timing(position, { toValue: next, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [value, reduceMotion, position]);
  return <View accessibilityRole="tablist" onLayout={event => setWidth(event.nativeEvent.layout.width)} style={[styles.bar, style]}>
    <FrostedGlassSurface dark={dark} enabled={effects} radius={30} intensity={60} backgroundOpacity={dark ? 0.14 : 0.04} />
    <Animated.View pointerEvents="none" style={[styles.indicator, { width: segmentWidth, backgroundColor: dark ? '#45454c' : '#e3e3e8', borderColor: dark ? '#45454c' : '#e3e3e8', transform: [{ translateX: Animated.multiply(position, segmentWidth) }] }]} />
    {tabs.map(tab => <Pressable key={tab.value} accessibilityRole="tab" accessibilityLabel={tab.label} accessibilityState={{ selected: value === tab.value }} onPress={() => onChange(tab.value)} style={({ pressed }) => [styles.tab, { opacity: pressed ? 0.65 : 1 }]}>
      <SymbolView name={tab.icon} size={19} tintColor={dark ? '#eeeef0' : '#343539'} />
      <Text style={[styles.label, { color: dark ? '#eeeef0' : '#343539', fontWeight: value === tab.value ? '600' : '400' }]}>{tab.label}</Text>
    </Pressable>)}
  </View>;
}

const styles = StyleSheet.create({
  bar: { width: 300, maxWidth: '100%', height: 60, borderRadius: 30, padding: 6, flexDirection: 'row' },
  indicator: { position: 'absolute', top: 6, bottom: 6, left: 6, borderRadius: 24, borderWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, minHeight: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', gap: 3 },
  label: { fontSize: 11 },
});
