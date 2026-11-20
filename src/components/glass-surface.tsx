import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { createContext, memo, useContext, useEffect, useMemo, useState, type ComponentRef, type PropsWithChildren, type RefObject } from 'react';
import { AccessibilityInfo, Animated, Pressable, StyleSheet, Text, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

type BlurTarget = RefObject<ComponentRef<typeof View> | null>;
const MaterialContext = createContext<{ blurTarget?: BlurTarget; reduceMotion: boolean }>({ reduceMotion: true });

/** Share one native blur target and one reduced-motion subscription across controls. */
export function GlassProvider({ blurTarget, children }: PropsWithChildren<{ blurTarget: BlurTarget }>) {
  const [reduceMotion, setReduceMotion] = useState(true);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setReduceMotion(value); }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { mounted = false; subscription.remove(); };
  }, []);
  const value = useMemo(() => ({ blurTarget, reduceMotion }), [blurTarget, reduceMotion]);
  return <MaterialContext.Provider value={value}>{children}</MaterialContext.Provider>;
}

export function useGlassMotion() { return useContext(MaterialContext).reduceMotion; }

export type FrostedGlassProps = {
  dark: boolean;
  enabled: boolean;
  active?: boolean;
  variant?: 'clear' | 'frosted' | 'tinted' | 'dark';
  radius?: number;
  intensity?: number;
  tintColor?: string;
  backgroundOpacity?: number;
  borderIntensity?: number;
  highlightIntensity?: number;
  shadowElevation?: number;
  pressed?: boolean;
};

/** Shared solid surface for controls and panels. */
export const FrostedGlassSurface = memo(function FrostedGlassSurface({
  dark, active = false, variant, radius = 16,
}: FrostedGlassProps) {
  const selected = active || variant === 'tinted';
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, {
    borderRadius: radius,
    backgroundColor: selected ? '#35363a' : dark || variant === 'dark' ? '#27282b' : '#ffffff',
  }]} />;
});
// Keep existing callers on the same material while screens adopt the button primitives.
export const GlassSurface = FrostedGlassSurface;

type ButtonProps = Omit<PressableProps, 'style' | 'children'> & PropsWithChildren<{
  dark: boolean;
  effects: boolean;
  active?: boolean;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  pressAnimation?: boolean;
  /** Discreet row actions omit optical layers; long note lists must not create per-row blur views. */
  quiet?: boolean;
}>;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function FrostedButton({ dark, effects, active = false, radius = 16, style, children,
  pressAnimation = true, quiet = false, disabled, onPressIn, onPressOut, onFocus, onBlur, ...props }: ButtonProps) {
  const reduceMotion = useGlassMotion();
  const [scale] = useState(() => new Animated.Value(1));
  const [pressed, setPressed] = useState(false);
  const [focused, setFocused] = useState(false);
  const animate = (down: boolean) => {
    setPressed(down);
    scale.stopAnimation();
    if (reduceMotion || !pressAnimation) { scale.setValue(1); return; }
    Animated.spring(scale, { toValue: down ? 0.97 : 1, stiffness: 420, damping: 34, mass: 1, useNativeDriver: true }).start();
  };
  useEffect(() => () => scale.stopAnimation(), [scale]);
  return <AnimatedPressable
    {...props}
    accessibilityRole={props.accessibilityRole ?? 'button'}
    accessibilityState={{ ...props.accessibilityState, disabled: !!disabled }}
    disabled={disabled}
    onPressIn={event => { animate(true); onPressIn?.(event); }}
    onPressOut={event => { animate(false); onPressOut?.(event); }}
    onFocus={event => { setFocused(true); onFocus?.(event); }}
    onBlur={event => { setFocused(false); onBlur?.(event); }}
    style={[styles.button, { borderRadius: radius }, style, { opacity: disabled ? 0.42 : 1, transform: [{ scale }] }]}
  >
    {!quiet && <FrostedGlassSurface dark={dark} enabled={effects} active={active} radius={radius} pressed={pressed} />}
    {quiet && (pressed || active) && <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radius, backgroundColor: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)' }]} />}
    {focused && <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radius, borderWidth: 2, borderColor: dark ? '#b9bcc5' : '#6b6e77' }]} />}
    {children}
  </AnimatedPressable>;
}

export function FrostedIconButton({ name, size = 18, dark, active, ...props }: Omit<ButtonProps, 'children'> & { name: SymbolViewProps['name']; size?: number }) {
  return <FrostedButton {...props} dark={dark} active={active} style={[styles.iconButton, props.style]}>
    <SymbolView name={name} size={size} tintColor={active ? '#fff' : dark ? '#ededee' : '#242528'} />
  </FrostedButton>;
}

export function FrostedTextButton({ label, dark, active, ...props }: Omit<ButtonProps, 'children'> & { label: string }) {
  return <FrostedButton {...props} dark={dark} active={active} accessibilityLabel={props.accessibilityLabel ?? label}>
    <Text style={{ color: active ? '#fff' : dark ? '#ededee' : '#242528', fontWeight: '600', fontSize: 14 }}>{label}</Text>
  </FrostedButton>;
}

const styles = StyleSheet.create({
  button: { minHeight: 44, minWidth: 44, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  iconButton: { width: 44, height: 44, paddingHorizontal: 0 },
});
