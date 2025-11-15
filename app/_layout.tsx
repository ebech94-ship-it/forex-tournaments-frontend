import { useColorScheme } from '@/hooks/use-color-scheme';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>

        {/* App flow screens */}
        <Stack.Screen name="index" />          {/* Redirects to splash */}
        <Stack.Screen name="splash" />
        <Stack.Screen name="welcome" />
        <Stack.Screen name="tradinglayout" />

        {/* Add more screens later easily */}
        {/* <Stack.Screen name="profile" /> */}
        {/* <Stack.Screen name="tournaments" /> */}

      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
