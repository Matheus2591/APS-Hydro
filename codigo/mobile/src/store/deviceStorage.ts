import AsyncStorage from '@react-native-async-storage/async-storage';
import { restoreStoredSession, splitStoredSession } from './sessionStorage';
// Na web a sessão só dura nesta aba. Relatos e medições continuam persistidos.
export const deviceStorage = {
  async getItem(key: string) {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    return restoreStoredSession(raw, sessionStorage.getItem(`${key}-session`));
  },
  async setItem(key: string, value: string) {
    const data = splitStoredSession(value);
    if (data.session) sessionStorage.setItem(`${key}-session`, data.session);
    else sessionStorage.removeItem(`${key}-session`);
    await AsyncStorage.setItem(key, data.state);
  },
  async removeItem(key: string) {
    sessionStorage.removeItem(`${key}-session`);
    await AsyncStorage.removeItem(key);
  },
};
