// Adapted from Uiverse.io by _2944 for React Native.
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Pressable, StyleSheet, View } from 'react-native';

type Props = { value: boolean; onValueChange: (value: boolean) => void; dark: boolean; label?: string; disabled?: boolean };

export function FrostSwitch({ value, onValueChange, dark, label = 'Frosted glass effects', disabled = false }: Props) {
  const [position] = useState(() => new Animated.Value(value ? 1 : 0));
  const [stretch] = useState(() => new Animated.Value(1));
  const [reduceMotion, setReduceMotion] = useState(true);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then(enabled => { if (mounted) setReduceMotion(enabled); }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { mounted = false; subscription.remove(); };
  }, []);

  useEffect(() => {
    if (reduceMotion) { position.setValue(value ? 1 : 0); return; }
    const animation = Animated.spring(position, { toValue: value ? 1 : 0, useNativeDriver: true, stiffness: 420, damping: 41, mass: 1 });
    animation.start();
    return () => animation.stop();
  }, [position, reduceMotion, value]);

  const pressAnimation = (toValue: number) => {
    if (reduceMotion) return;
    Animated.timing(stretch, { toValue, duration: 140, useNativeDriver: true }).start();
  };

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      onPressIn={() => pressAnimation(1.22)}
      onPressOut={() => pressAnimation(1)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={styles.touchTarget}>
      <View style={[styles.track, { backgroundColor: value ? (dark ? '#e4e4e8' : '#292a2e') : dark ? '#4b4c52' : '#c8c9ce' }, focused && { borderWidth: 2, borderColor: dark ? '#fff' : '#42434a' }]}>
        <Animated.View style={[styles.thumb, { backgroundColor: value && dark ? '#27282c' : '#ffffff', transform: [{ translateX: position.interpolate({ inputRange: [0, 1], outputRange: [0, 18] }) }, { scaleX: stretch }] }]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  touchTarget: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  track: { width: 42, height: 24, borderRadius: 12, justifyContent: 'center', overflow: 'hidden' },
  thumb: { position: 'absolute', left: 3, width: 18, height: 18, borderRadius: 9, elevation: 2, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
});
