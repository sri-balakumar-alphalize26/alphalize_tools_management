import { Platform, ToastAndroid } from 'react-native';
import Toast from 'react-native-toast-message';

export const showToastMessage = (message) => {
  if (Platform.OS === 'android') {
    ToastAndroid.showWithGravityAndOffset(
      message,
      ToastAndroid.LONG,
      ToastAndroid.BOTTOM,
      25,
      50
    );
  } else {
    Toast.show({
      type: 'info',
      text1: message,
      position: 'bottom',
      visibilityTime: 3000,
    });
  }
};
