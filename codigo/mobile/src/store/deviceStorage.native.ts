import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import type { LocalStorage } from './storage';
import { restoreStoredSession, splitStoredSession } from './sessionStorage';

// O token fica no armazenamento protegido do Android, separado dos dados do app.
export const deviceStorage: LocalStorage = {
  async getItem(key) {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const rawSession = await SecureStore.getItemAsync(`${key}-session`);
    return restoreStoredSession(raw, rawSession);
  },
  async setItem(key, value) {
    const data = splitStoredSession(value);
    if (data.session) await SecureStore.setItemAsync(`${key}-session`, data.session);
    else await SecureStore.deleteItemAsync(`${key}-session`);
    await AsyncStorage.setItem(key, data.state);
  },
  async removeItem(key) {
    await SecureStore.deleteItemAsync(`${key}-session`);
    await AsyncStorage.removeItem(key);
  },
};
