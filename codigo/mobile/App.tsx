import { NavigationContainer, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Activity, CircleUserRound, Home, Map, Plus } from 'lucide-react-native';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { ActivityScreen } from './src/screens/ActivityScreen';
import { AuthScreen } from './src/screens/AuthScreen';
import { RecoveryCodeScreen } from './src/screens/RecoveryCodeScreen';
import { AccountSecurityScreen } from './src/screens/AccountSecurityScreen';
import { ModerationScreen } from './src/screens/ModerationScreen';
import { ConnectivityManager } from './src/components/ConnectivityManager';
import { HomeScreen } from './src/screens/HomeScreen';
import { MapScreen } from './src/screens/MapScreen';
import { NotificationsScreen } from './src/screens/NotificationsScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { ProfileEditScreen } from './src/screens/ProfileEditScreen';
import { ProfileSectionScreen } from './src/screens/ProfileSectionScreen';
import { ReportDetailScreen } from './src/screens/ReportDetailScreen';
import { ReportEditScreen } from './src/screens/ReportEditScreen';
import { ReportScreen } from './src/screens/ReportScreen';
import { ReportSuccessScreen } from './src/screens/ReportSuccessScreen';
import { StationDetailScreen } from './src/screens/StationDetailScreen';
import { ConnectionScreen } from './src/screens/ConnectionScreen';
import { OfficialDataScreen } from './src/screens/OfficialDataScreen';
import { LocationPickerScreen } from './src/screens/LocationPickerScreen';
import { colors } from './src/theme';
import { useAppStore } from './src/store/useAppStore';
import { PrimaryButton } from './src/components/PrimaryButton';
import type { MainTabParamList, RootStackParamList } from './src/types/navigation';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

const navigationTheme: Theme = {
  dark: false,
  colors: {
    primary: colors.blue,
    background: colors.canvas,
    card: colors.surface,
    text: colors.ink,
    border: colors.line,
    notification: colors.red,
  },
  fonts: {
    regular: { fontFamily: 'System', fontWeight: '400' },
    medium: { fontFamily: 'System', fontWeight: '500' },
    bold: { fontFamily: 'System', fontWeight: '700' },
    heavy: { fontFamily: 'System', fontWeight: '800' },
  },
};

const tabIcons = {
  Inicio: Home,
  Mapa: Map,
  Relatar: Plus,
  Atividade: Activity,
  Perfil: CircleUserRound,
};

function MainTabs() {
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: colors.blue,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginTop: 2 },
        tabBarStyle: [
          styles.tabBar,
          {
            height: styles.tabBar.height + insets.bottom,
            paddingBottom: styles.tabBar.paddingBottom + insets.bottom,
          },
        ],
        tabBarItemStyle: styles.tabItem,
        tabBarIcon: ({ color, size }) => {
          const Icon = tabIcons[route.name];
          if (route.name === 'Relatar') {
            return (
              <View style={styles.reportTab}>
                <Icon color={colors.white} size={26} strokeWidth={2.6} />
              </View>
            );
          }
          return <Icon color={color} size={size} />;
        },
      })}
    >
      <Tab.Screen name="Inicio" component={HomeScreen} options={{ title: 'Início' }} />
      <Tab.Screen name="Mapa" component={MapScreen} />
      <Tab.Screen name="Relatar" component={ReportScreen} />
      <Tab.Screen name="Atividade" component={ActivityScreen} />
      <Tab.Screen name="Perfil" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  const user = useAppStore((state) => state.user);
  const recoveryCode = useAppStore((state) => state.recoveryCode);
  const hasHydrated = useAppStore((state) => state.hasHydrated);
  const hydrationError = useAppStore((state) => state.hydrationError);

  if (!hasHydrated)
    return (
      <SafeAreaProvider>
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            padding: 32,
            gap: 16,
            backgroundColor: colors.canvas,
          }}
        >
          {!hydrationError && <ActivityIndicator color={colors.blue} size="large" />}
          <Text style={{ color: colors.ink, textAlign: 'center' }}>
            {hydrationError ?? 'Abrindo os dados salvos do Hydro Pulse...'}
          </Text>
          {hydrationError && (
            <PrimaryButton
              label="Tentar novamente"
              onPress={() => void useAppStore.persist.rehydrate()}
            />
          )}
        </View>
      </SafeAreaProvider>
    );

  if (recoveryCode)
    return (
      <SafeAreaProvider>
        <RecoveryCodeScreen />
      </SafeAreaProvider>
    );

  return (
    <SafeAreaProvider>
      <ConnectivityManager />
      <NavigationContainer theme={navigationTheme}>
        <StatusBar style="dark" />
        <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
          {user ? (
            <>
              <Stack.Screen name="Main" component={MainTabs} />
              <Stack.Screen name="StationDetail" component={StationDetailScreen} />
              <Stack.Screen name="ReportDetail" component={ReportDetailScreen} />
              <Stack.Screen name="ReportEdit" component={ReportEditScreen} />
              <Stack.Screen name="Notifications" component={NotificationsScreen} />
              <Stack.Screen name="ProfileEdit" component={ProfileEditScreen} />
              <Stack.Screen name="AccountSecurity" component={AccountSecurityScreen} />
              {user.role === 'moderator' && (
                <>
                  <Stack.Screen name="Moderation" component={ModerationScreen} />
                  <Stack.Screen name="Connection" component={ConnectionScreen} />
                </>
              )}
              <Stack.Screen name="LocationPicker" component={LocationPickerScreen} />
              <Stack.Screen name="ProfileSection" component={ProfileSectionScreen} />
              <Stack.Screen
                name="ReportSuccess"
                component={ReportSuccessScreen}
                options={{ animation: 'fade' }}
              />
            </>
          ) : (
            <>
              <Stack.Screen name="Auth" component={AuthScreen} />
              <Stack.Screen name="Connection" component={ConnectionScreen} />
            </>
          )}
          <Stack.Screen name="OfficialData" component={OfficialDataScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    height: 74,
    paddingTop: 8,
    paddingBottom: 8,
    borderTopWidth: 0,
    backgroundColor: colors.surface,
    shadowColor: colors.navy,
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 12,
  },
  tabItem: { paddingVertical: 2 },
  reportTab: {
    width: 50,
    height: 50,
    marginTop: -24,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.blue,
    borderWidth: 4,
    borderColor: colors.surface,
    shadowColor: colors.blue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 9,
    elevation: 7,
  },
});
