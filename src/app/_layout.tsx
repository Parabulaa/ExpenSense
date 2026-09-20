import { PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold, useFonts } from '@expo-google-fonts/plus-jakarta-sans';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from '@/constants/theme';
SplashScreen.preventAutoHideAsync();
export default function RootLayout() {
  const [loaded] = useFonts({ JakartaRegular: PlusJakartaSans_400Regular, JakartaMedium: PlusJakartaSans_500Medium, JakartaSemiBold: PlusJakartaSans_600SemiBold, JakartaBold: PlusJakartaSans_700Bold, JakartaExtraBold: PlusJakartaSans_800ExtraBold });
  useEffect(() => { if (loaded) SplashScreen.hideAsync(); }, [loaded]);
  if (!loaded) return null;
  return <SafeAreaProvider><StatusBar style="dark"/><Stack screenOptions={{ headerShown:false, contentStyle:{backgroundColor:colors.cream}, animation:'fade_from_bottom' }} /></SafeAreaProvider>;
}
