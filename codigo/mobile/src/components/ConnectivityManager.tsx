import * as Network from 'expo-network';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useAppStore } from '../store/useAppStore';

/**
 * Keeps the front-end network state aligned with the device and retries the
 * local operation queue whenever connectivity returns or the app is resumed.
 */
export function ConnectivityManager() {
  const isOnline = useAppStore((state) => state.isOnline);
  const setNetworkAvailable = useAppStore((state) => state.setNetworkAvailable);
  const syncPending = useAppStore((state) => state.syncPending);
  const hasHydrated = useAppStore((state) => state.hasHydrated);
  const userId = useAppStore((state) => state.user?.id);
  const accountBusy = useAppStore((state) => state.accountBusy);

  useEffect(() => {
    const updateNetworkState = (state: Network.NetworkState) => {
      const available = state.isConnected === true && state.isInternetReachable !== false;
      setNetworkAvailable(available);
    };

    void Network.getNetworkStateAsync()
      .then(updateNetworkState)
      .catch(() => setNetworkAvailable(false));
    const subscription = Network.addNetworkStateListener(updateNetworkState);

    return () => subscription.remove();
  }, [setNetworkAvailable]);

  useEffect(() => {
    if (isOnline && hasHydrated && !accountBusy) void syncPending();
  }, [isOnline, hasHydrated, syncPending, userId, accountBusy]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && useAppStore.getState().isOnline) {
        void useAppStore.getState().syncPending();
      }
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      const state = useAppStore.getState();
      if (
        AppState.currentState === 'active' &&
        state.isOnline &&
        state.hasHydrated &&
        !state.accountBusy
      )
        void state.syncPending();
    }, 60_000);
    return () => clearInterval(timer);
  }, []);

  return null;
}
