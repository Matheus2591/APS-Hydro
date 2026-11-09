import { useMemo } from 'react';
import { createHydroPulseApi } from './hydroPulse';
import { useAppStore } from '../../store/useAppStore';

export function useAccountApi() {
  return useMemo(() => {
    const api = createHydroPulseApi({
      baseUrl: () => useAppStore.getState().apiUrl,
      useMocks: false,
    });
    api.setTokenGetter(() => useAppStore.getState().sessionToken);
    return api;
  }, []);
}
