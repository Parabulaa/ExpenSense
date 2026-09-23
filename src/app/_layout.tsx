import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';

import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ToastProvider } from '@/components/common/toast';
import { colors } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';
import { useAuthGuard } from '@/features/auth/hooks/useAuthGuard';
import { BudgetProvider } from '@/features/budget/BudgetProvider';
import { CategoriesProvider } from '@/features/categories/CategoriesProvider';
import { DashboardCategoriesProvider } from '@/features/dashboard/DashboardCategoriesProvider';
import { ExpensesProvider } from '@/features/expenses/ExpensesProvider';
import { AddExpenseOverlayProvider } from '@/features/expenses/AddExpenseOverlayProvider';
import { FinanceProvider } from '@/features/finance/FinanceProvider';
import { NotificationsProvider } from '@/features/notifications/NotificationsProvider';
import { ProfileProvider } from '@/features/profile/ProfileProvider';
import { ReceiptProvider } from '@/features/receipts/ReceiptProvider';
import { SettingsProvider } from '@/features/settings/SettingsProvider';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    JakartaRegular: PlusJakartaSans_400Regular,
    JakartaMedium: PlusJakartaSans_500Medium,
    JakartaSemiBold: PlusJakartaSans_600SemiBold,
    JakartaBold: PlusJakartaSans_700Bold,
    JakartaExtraBold: PlusJakartaSans_800ExtraBold,
  });

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />

        <AuthProvider>
          <ProfileProvider>
            <SettingsProvider>
              <ExpensesProvider>
                <FinanceProvider><ReceiptProvider><CategoriesProvider>
                  <BudgetProvider>
                    <DashboardCategoriesProvider>
                      <NotificationsProvider>
                        <ToastProvider>
                          <AddExpenseOverlayProvider>
                            <RootNavigation />
                          </AddExpenseOverlayProvider>
                        </ToastProvider>
                      </NotificationsProvider>
                    </DashboardCategoriesProvider>
                  </BudgetProvider>
                </CategoriesProvider></ReceiptProvider></FinanceProvider>
              </ExpensesProvider>
            </SettingsProvider>
          </ProfileProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// Waits for the initial Supabase session check before showing any route, so
// we never flash a signed-out screen for a signed-in user (or vice versa),
// and applies auth-based route protection for every navigation after that.
function RootNavigation() {
  const { initialized } = useAuth();
  useAuthGuard();

  useEffect(() => {
    if (initialized) {
      SplashScreen.hideAsync();
    }
  }, [initialized]);

  if (!initialized) return null;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: colors.cream,
        },
        // `simple_push` travels a short distance with a cross-fade, which
        // reads as a deliberate step deeper rather than the hard cut
        // `fade_from_bottom` produced. Going back plays it in reverse, so
        // direction stays consistent. `animationTypeForReplace: 'push'` keeps
        // router.replace() (used between sign-in and create-account) moving
        // forward instead of appearing to pop backwards.
        animation: 'simple_push',
        animationDuration: 260,
        animationTypeForReplace: 'push',
        gestureEnabled: true,
      }}
    >
      <Stack.Screen
        name="onboarding"
        options={{
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="add-expense"
        options={{
          presentation: 'transparentModal',
          animation: 'fade',
          animationDuration: 180,
          contentStyle: { backgroundColor: 'transparent' },
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="scanner"
        options={{
          presentation: 'fullScreenModal',
          animation: 'slide_from_bottom',
          animationDuration: 280,
          gestureEnabled: true,
          gestureDirection: 'vertical',
        }}
      />
    </Stack>
  );
}
