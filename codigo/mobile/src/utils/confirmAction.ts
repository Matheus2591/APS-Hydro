import { Alert, Platform } from 'react-native';

export function confirmAction(title: string, message: string, label = 'Confirmar') {
  if (Platform.OS === 'web') return Promise.resolve(globalThis.confirm(`${title}\n\n${message}`));
  return new Promise<boolean>((resolve) =>
    Alert.alert(
      title,
      message,
      [
        { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
        { text: label, style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    ),
  );
}
