import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { initializeStorage } from '../core/store';

export default function RootLayout() {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    initializeStorage().then(() => { if (active) setStatus('ready'); }).catch(() => { if (active) setStatus('error'); });
    return () => { active = false; };
  }, [attempt]);

  if (status !== 'ready') return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 }}>
    {status === 'loading' ? <ActivityIndicator accessibilityLabel="Opening notebook" /> : <><Text>Could not open your notebook. Your data has not been removed.</Text><Pressable accessibilityRole="button" onPress={() => { setStatus('loading'); setAttempt(value => value + 1); }}><Text>Try again</Text></Pressable></>}
  </View>;
  return <Stack screenOptions={{ headerShown: false }} />;
}
