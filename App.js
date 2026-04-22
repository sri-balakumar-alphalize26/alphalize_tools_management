import React, { useEffect, useState } from 'react';
import * as Font from 'expo-font';
import { LogBox } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import CustomToast from './src/components/Toast/CustomToast';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Provider } from 'react-native-paper';
import StackNavigator from './src/navigation/StackNavigator';
import installNetworkInterceptor from './src/api/utils/networkInterceptor';
import NetworkErrorModal from './src/components/NetworkError/NetworkErrorModal';

installNetworkInterceptor();

export default function App() {
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    LogBox.ignoreLogs(["new NativeEventEmitter"]);
    LogBox.ignoreAllLogs();

    async function loadFonts() {
      try {
        await Font.loadAsync({
          'Urbanist-Black': require('./assets/fonts/Urbanist/Urbanist-Black.ttf'),
          'Urbanist-Bold': require('./assets/fonts/Urbanist/Urbanist-Bold.ttf'),
          'Urbanist-ExtraBold': require('./assets/fonts/Urbanist/Urbanist-ExtraBold.ttf'),
          'Urbanist-ExtraLight': require('./assets/fonts/Urbanist/Urbanist-ExtraLight.ttf'),
          'Urbanist-Light': require('./assets/fonts/Urbanist/Urbanist-Light.ttf'),
          'Urbanist-Medium': require('./assets/fonts/Urbanist/Urbanist-Medium.ttf'),
          'Urbanist-Regular': require('./assets/fonts/Urbanist/Urbanist-Regular.ttf'),
          'Urbanist-SemiBold': require('./assets/fonts/Urbanist/Urbanist-SemiBold.ttf'),
          'Urbanist-Thin': require('./assets/fonts/Urbanist/Urbanist-Thin.ttf'),
        });
      } catch (e) {
        console.warn('Font load failed', e);
      } finally {
        setFontsLoaded(true);
      }
    }
    loadFonts();
  }, []);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Provider>
        <NavigationContainer>
          <SafeAreaProvider>
            <StackNavigator />
          </SafeAreaProvider>
        </NavigationContainer>
        <Toast config={CustomToast} />
        <NetworkErrorModal />
      </Provider>
    </GestureHandlerRootView>
  );
}
