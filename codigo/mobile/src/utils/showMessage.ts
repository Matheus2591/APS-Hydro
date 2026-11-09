import { Alert, Platform } from 'react-native';

// O Alert do react-native-web não exibe mensagens; usar o diálogo do navegador.
export function showMessage(title: string, message: string) {
  if (Platform.OS === 'web') globalThis.alert(`${title}\n\n${message}`);
  else Alert.alert(title, message);
}
