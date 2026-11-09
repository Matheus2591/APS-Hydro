import { deviceStorage } from './deviceStorage';
import { createAppStore } from './appState';

// O estado é o mesmo no Android e no navegador; apenas o armazenamento é da plataforma.
export const useAppStore = createAppStore(deviceStorage, undefined, { serverAccounts: true });
void useAppStore.persist.rehydrate();
