import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { reports as initialReports } from '../data/mock';
import { officialSnapshot } from '../data/official';
import { createHydroPulseApi, type HydroPulseApi } from '../services/api/hydroPulse';
import { ApiError, API_URL, normalizeApiUrl } from '../services/api/client';
import { isConnectionSetupCode } from '../config/connectionSetup';
import { createStorageQueue, type LocalStorage } from './storage';
import {
  isFloodReport,
  isObservation,
  isSourceState,
  isStation,
  validateReportInput,
} from '../utils/validation';
import { mergePersistedState } from './persistedState';
import { serverAccountActions } from './serverAccounts';
import { communityActions, syncCommunity } from './community';
import type {
  CreateReportInput,
  FloodReport,
  ReportDispute,
  UpdateReportInput,
  UserAccount,
  OfficialObservation,
  SourceState,
  Station,
  AppNotification,
  PendingReportUpdate,
  PendingModeration,
} from '../types/domain';

export type AppState = {
  serverAccounts: boolean;
  recoveryCode: string | null;
  accountBusy: boolean;
  dismissRecoveryCode: () => void;
  recoverAccount: (name: string, code: string, newPassword: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  generateRecoveryCode: (currentPassword: string) => Promise<void>;
  deleteAccount: (currentPassword: string, confirmation: string) => Promise<void>;
  pendingReportUpdates: PendingReportUpdate[];
  pendingModerations: PendingModeration[];
  moderateDispute: (disputeId: string, action: 'keep' | 'hide', note: string) => Promise<void>;
  updateReportStatus: (
    reportId: string,
    lifecycle: 'active' | 'resolved',
    note: string,
  ) => Promise<void>;
  serviceStatus: 'unknown' | 'available' | 'unavailable';
  sessionToken: string | null;
  authServerId: string | null;
  notifications: AppNotification[];
  pendingConfirmations: Array<{ reportId: string; authorId: string }>;
  readNotification: (id: number) => Promise<void>;
  hasHydrated: boolean;
  hydrationError: string | null;
  finishHydration: (error?: unknown) => void;
  observations: OfficialObservation[];
  sources: SourceState[];
  stations: Station[];
  cursor: string;
  serverId: string | null;
  lastSyncAt: string | null;
  syncError: string | null;
  syncing: boolean;
  apiUrl: string;
  configuringServer: boolean;
  saveApiUrl: (value: string, setupCode?: string) => Promise<void>;
  isOnline: boolean;
  networkAvailable: boolean;
  simulateOffline: boolean;
  reports: FloodReport[];
  disputes: ReportDispute[];
  confirmedReportIds: string[];
  user: UserAccount | null;
  accounts: UserAccount[];
  pendingCount: number;
  setNetworkAvailable: (available: boolean) => void;
  setSimulateOffline: (enabled: boolean) => void;
  register: (input: Omit<UserAccount, 'id' | 'createdAt'>) => Promise<boolean>;
  updateProfile: (
    input: Pick<UserAccount, 'name' | 'phone' | 'address' | 'profilePhotoUri'>,
  ) => Promise<boolean>;
  login: (name: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  createReport: (input: Omit<CreateReportInput, 'clientId' | 'authorId'>) => Promise<FloodReport>;
  updateReport: (reportId: string, input: UpdateReportInput) => Promise<FloodReport | null>;
  confirmReport: (reportId: string) => Promise<void>;
  submitDispute: (
    input: Omit<ReportDispute, 'id' | 'authorId' | 'createdAt' | 'status'>,
  ) => Promise<ReportDispute>;
  syncPending: () => Promise<void>;
};

const countPending = (reports: FloodReport[]) =>
  reports.filter((report) => report.status !== 'synced').length;

export function createAppStore(
  storage: LocalStorage,
  selectedApi?: HydroPulseApi,
  options: { serverAccounts?: boolean } = {},
) {
  const api: HydroPulseApi =
    selectedApi ?? createHydroPulseApi({ baseUrl: () => useStore.getState().apiUrl });
  const localStorage = createStorageQueue(storage);
  let activeSync: Promise<void> | null = null;
  const useStore = create<AppState>()(
    persist(
      (set, get) => ({
        serverAccounts: !!options.serverAccounts && !api.useMocks,
        recoveryCode: null,
        accountBusy: false,
        dismissRecoveryCode: () => set({ recoveryCode: null }),
        recoverAccount: async () => {
          throw new Error('Disponível na versão conectada.');
        },
        changePassword: async () => {
          throw new Error('Disponível na versão conectada.');
        },
        generateRecoveryCode: async () => {
          throw new Error('Disponível na versão conectada.');
        },
        deleteAccount: async () => {
          throw new Error('Disponível na versão conectada.');
        },
        pendingReportUpdates: [],
        pendingModerations: [],
        moderateDispute: async () => {
          throw new Error('Disponível para a moderação.');
        },
        updateReportStatus: async () => {
          throw new Error('Disponível na versão conectada.');
        },
        serviceStatus: 'unknown',
        sessionToken: null,
        authServerId: null,
        notifications: [],
        pendingConfirmations: [],
        readNotification: async () => {},
        hasHydrated: false,
        hydrationError: null,
        finishHydration: (error) => {
          if (error) {
            localStorage.blockWrites(error);
            set({
              hydrationError: 'Não foi possível ler os dados locais. Eles não foram apagados.',
            });
            return;
          }
          // Uma tentativa interrompida pode ter chegado ao servidor: reenviar o mesmo ID.
          const reports = get().reports.map((report) =>
            report.status === 'syncing'
              ? {
                  ...report,
                  status: 'failed' as const,
                  lastError: 'Tentativa interrompida. Aguardando reenvio.',
                }
              : report,
          );
          set({
            hasHydrated: true,
            hydrationError: null,
            reports,
            ...(options.serverAccounts
              ? { accounts: [], ...(!get().sessionToken ? { user: null } : {}) }
              : {}),
            pendingCount: countPending(reports),
            ...(!api.useMocks && !get().observations.length
              ? {
                  observations: officialSnapshot.items,
                  sources: officialSnapshot.sources,
                }
              : {}),
          });
        },
        observations: api.useMocks ? [] : officialSnapshot.items,
        sources: api.useMocks ? [] : officialSnapshot.sources,
        stations: [],
        cursor: '0',
        serverId: null,
        lastSyncAt: null,
        syncError: null,
        syncing: false,
        apiUrl: API_URL,
        configuringServer: false,
        saveApiUrl: async (value, setupCode) => {
          const canConfigure = () => {
            const user = get().user;
            return (
              !get().serverAccounts ||
              user?.role === 'moderator' ||
              (!user && isConnectionSetupCode(setupCode))
            );
          };
          if (!canConfigure())
            throw new Error(
              'Use uma conta de administrador ou libere a configuração pelo código na tela de acesso.',
            );
          if (get().accountBusy) throw new Error('Aguarde a operação da conta terminar.');
          if (api.useMocks)
            throw new Error('Esta versão usa simulação. Use o APK de apresentação.');
          if (get().configuringServer) throw new Error('Aguarde a verificação em andamento.');
          const address = normalizeApiUrl(value);
          set({ configuringServer: true });
          try {
            // Não trocar de destino enquanto um envio está em andamento.
            if (activeSync) await activeSync;
            const health = await createHydroPulseApi({
              baseUrl: address,
              useMocks: false,
            }).health();
            if (health.status !== 'ok' || !health.serverId || typeof health.serverId !== 'string')
              throw new Error('Este endereço não respondeu como uma API Hydro Pulse.');
            if (
              get().serverAccounts &&
              !['accounts', 'account_security', 'report_states', 'moderation'].every((capability) =>
                health.capabilities?.includes(capability),
              )
            )
              throw new Error('Atualize o servidor antes de conectar este aplicativo.');
            if (get().accountBusy || !canConfigure())
              throw new Error(
                'A sessão mudou durante a verificação. Abra a configuração novamente.',
              );
            const previous = {
              apiUrl: get().apiUrl,
              user: get().user,
              sessionToken: get().sessionToken,
              authServerId: get().authServerId,
              notifications: get().notifications,
            };
            set({
              apiUrl: address,
              ...(get().serverAccounts &&
              get().authServerId &&
              get().authServerId !== health.serverId
                ? {
                    user: null,
                    sessionToken: null,
                    authServerId: null,
                    notifications: [],
                    recoveryCode: null,
                  }
                : {}),
            });
            try {
              await localStorage.flush();
            } catch (error) {
              set(previous);
              throw error;
            }
          } finally {
            set({ configuringServer: false });
          }
          await get().syncPending();
        },
        isOnline: true,
        networkAvailable: true,
        simulateOffline: false,
        reports: api.useMocks ? initialReports : [],
        disputes: [],
        confirmedReportIds: [],
        user: null,
        accounts: [],
        pendingCount: 0,
        setNetworkAvailable: (networkAvailable) =>
          set((state) => ({
            networkAvailable,
            isOnline: networkAvailable && !state.simulateOffline,
            ...(!networkAvailable ? { serviceStatus: 'unknown' as const } : {}),
          })),
        setSimulateOffline: (simulateOffline) =>
          set((state) => ({
            simulateOffline,
            isOnline: state.networkAvailable && !simulateOffline,
          })),
        register: async (input) => {
          if (
            !input.name.trim() ||
            input.name.length > 100 ||
            input.password.length < 4 ||
            !input.phone.trim() ||
            input.phone.length > 30 ||
            !input.address.trim() ||
            input.address.length > 300
          )
            throw new Error('Confira nome, senha, telefone e endereço do perfil de demonstração.');
          const alreadyExists = get().accounts.some(
            (account) =>
              account.name.trim().toLocaleLowerCase() === input.name.trim().toLocaleLowerCase(),
          );
          if (alreadyExists) return false;
          const account: UserAccount = {
            ...input,
            id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            name: input.name.trim(),
            phone: input.phone.trim(),
            address: input.address.trim(),
            createdAt: new Date().toISOString(),
          };
          const previous = { accounts: get().accounts, user: get().user };
          set({ accounts: [...previous.accounts, account], user: account });
          try {
            await localStorage.flush();
          } catch (error) {
            set(previous);
            throw error;
          }
          return true;
        },
        updateProfile: async (input) => {
          const currentUser = get().user;
          if (!currentUser) return false;
          if (
            !input.name.trim() ||
            input.name.length > 100 ||
            !input.phone.trim() ||
            input.phone.length > 30 ||
            !input.address.trim() ||
            input.address.length > 300
          )
            throw new Error('Confira nome, telefone e endereço do perfil.');

          const alreadyExists = get().accounts.some(
            (account) =>
              account.id !== currentUser.id &&
              account.name.trim().toLocaleLowerCase() === input.name.trim().toLocaleLowerCase(),
          );
          if (alreadyExists) return false;

          const updatedUser: UserAccount = {
            ...currentUser,
            ...input,
            name: input.name.trim(),
            phone: input.phone.trim(),
            address: input.address.trim(),
            profilePhotoUri: input.profilePhotoUri || undefined,
          };
          const previous = { user: currentUser, accounts: get().accounts };
          set((state) => ({
            user: updatedUser,
            accounts: state.accounts.map((account) =>
              account.id === currentUser.id ? updatedUser : account,
            ),
          }));
          try {
            await localStorage.flush();
          } catch (error) {
            set(previous);
            throw error;
          }
          return true;
        },
        login: async (name, password) => {
          const account = get().accounts.find(
            (item) =>
              item.name.toLocaleLowerCase() === name.trim().toLocaleLowerCase() &&
              item.password === password,
          );
          if (!account) return false;
          const previous = get().user;
          set({ user: account });
          try {
            await localStorage.flush();
          } catch (error) {
            set({ user: previous });
            throw error;
          }
          return true;
        },
        logout: async () => {
          const user = get().user;
          set({ user: null });
          try {
            await localStorage.flush();
          } catch (error) {
            set({ user });
            throw error;
          }
        },
        createReport: async (input) => {
          if (get().serverAccounts && !get().user)
            throw new Error('Entre na sua conta antes de registrar uma ocorrência.');
          validateReportInput(input);
          const clientId = `report-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          const authorId = get().user?.id ?? 'anonymous';
          const optimistic: FloodReport = {
            ...input,
            id: clientId,
            clientId,
            authorId,
            neighborhood: 'Santos',
            createdAt: new Date().toISOString(),
            status: 'pending',
            source: 'community',
            confirmations: 0,
          };
          const withOptimistic = [optimistic, ...get().reports];
          set({ reports: withOptimistic, pendingCount: countPending(withOptimistic) });

          // Aguarda o AsyncStorage antes de permitir qualquer envio ou tela de sucesso.
          try {
            await localStorage.flush();
          } catch (error) {
            set((state) => {
              const reports = state.reports.filter((report) => report.clientId !== clientId);
              return { reports, pendingCount: countPending(reports) };
            });
            throw error;
          }
          if (get().isOnline) {
            await get().syncPending();
            // Pode ter sido criado enquanto outra sincronização já enviava sua lista.
            if (get().reports.find((item) => item.clientId === clientId)?.status === 'pending') {
              await get().syncPending();
            }
          }
          return get().reports.find((report) => report.clientId === clientId) ?? optimistic;
        },
        updateReport: async (reportId, input) => {
          const current = get().reports.find((report) => report.id === reportId);
          if (!current || current.authorId !== get().user?.id) return null;
          validateReportInput(input);
          if (!api.useMocks && current.status !== 'pending') {
            throw new Error(
              'Relatos já enviados ou tentados são imutáveis nesta etapa. Registre uma nova observação.',
            );
          }
          const optimistic = {
            ...current,
            ...input,
            uploadedPhotoUri:
              input.photoUri === current.photoUri ? current.uploadedPhotoUri : undefined,
            retryable: true,
            lastError: undefined,
          };
          set((state) => ({
            reports: state.reports.map((item) => (item.id === reportId ? optimistic : item)),
          }));
          try {
            await localStorage.flush();
          } catch (error) {
            set((state) => ({
              reports: state.reports.map((item) => (item.id === reportId ? current : item)),
            }));
            throw error;
          }
          if (!api.useMocks) {
            if (get().isOnline) await get().syncPending();
            return get().reports.find((report) => report.id === reportId) ?? optimistic;
          }
          if (!get().isOnline) return optimistic;
          try {
            const saved = await api.updateReport(reportId, input);
            const updated = {
              ...saved,
              authorId: current.authorId,
              confirmations: current.confirmations,
            };
            set((state) => ({
              reports: state.reports.map((item) => (item.id === reportId ? updated : item)),
            }));
            return updated;
          } catch {
            return optimistic;
          }
        },
        confirmReport: async (reportId) => {
          if (
            get().confirmedReportIds.includes(reportId) ||
            !get().reports.some((report) => report.id === reportId)
          )
            return;
          set((state) => ({
            confirmedReportIds: [...state.confirmedReportIds, reportId],
            reports: state.reports.map((report) =>
              report.id === reportId
                ? { ...report, confirmations: report.confirmations + 1 }
                : report,
            ),
          }));
          try {
            await localStorage.flush();
          } catch (error) {
            set((state) => ({
              confirmedReportIds: state.confirmedReportIds.filter((id) => id !== reportId),
              reports: state.reports.map((report) =>
                report.id === reportId
                  ? { ...report, confirmations: Math.max(0, report.confirmations - 1) }
                  : report,
              ),
            }));
            throw error;
          }
        },
        submitDispute: async (input) => {
          const authorId = get().user?.id;
          if (!authorId)
            throw new Error('É necessário estar autenticado para contestar um relato.');
          if (
            !get().reports.some((report) => report.id === input.reportId) ||
            input.justification.trim().length < 10 ||
            input.justification.trim().length > 500
          )
            throw new Error(
              'Escolha um relato e escreva uma justificativa entre 10 e 500 caracteres.',
            );
          const local: ReportDispute = {
            ...input,
            id: `dispute-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            authorId,
            createdAt: new Date().toISOString(),
            status: 'pending',
          };
          set((state) => ({ disputes: [local, ...state.disputes] }));
          try {
            await localStorage.flush();
          } catch (error) {
            set((state) => ({ disputes: state.disputes.filter((item) => item.id !== local.id) }));
            throw error;
          }
          if (get().serverAccounts) {
            await get().syncPending();
            return get().disputes.find((d) => d.id === local.id) ?? local;
          }
          if (get().isOnline) {
            try {
              const saved = await api.submitDispute(inputWithAuthor(input, authorId));
              set((state) => ({
                disputes: state.disputes.map((item) => (item.id === local.id ? saved : item)),
              }));
              await localStorage.flush();
              return saved;
            } catch {
              set((state) => ({
                disputes: state.disputes.map((item) => (item.id === local.id ? local : item)),
              }));
              return local;
            }
          }
          return local;
        },
        syncPending: () => {
          if (activeSync) return activeSync;
          if (!get().isOnline || !get().hasHydrated || get().configuringServer || get().accountBusy)
            return Promise.resolve();
          if (!selectedApi && !api.useMocks && !get().apiUrl) {
            set({
              syncError:
                'Histórico real disponível neste aparelho. Use Configurar conexão na tela de acesso ou Perfil → Administração → Conexão do serviço para definir o servidor.',
            });
            return Promise.resolve();
          }
          activeSync = (async () => {
            const tokenAtStart = get().sessionToken;
            set({ syncing: true, syncError: null });
            try {
              await localStorage.flush();
              let targetServerId = get().serverId;
              if (!api.useMocks) {
                const health = await api.health();
                if (health.status !== 'ok' || typeof health.serverId !== 'string')
                  throw new Error('O endereço não respondeu como uma API Hydro Pulse.');
                targetServerId = health.serverId;
                set({ serviceStatus: 'available' });
                if (get().serverAccounts && get().sessionToken && get().user) {
                  if (get().authServerId !== targetServerId)
                    throw new Error(
                      'Esta sessão pertence a outro banco. Entre novamente na conta deste servidor.',
                    );
                  const user = await api.me();
                  if (user.id !== get().user?.id || user.password !== '')
                    throw new Error('A sessão não corresponde ao perfil salvo. Entre novamente.');
                  set({ user });
                }
              }
              let replacingCache = !api.useMocks && targetServerId !== get().serverId;
              let pullCursor = replacingCache ? '0' : get().cursor;
              const pending = get().reports.filter(
                (report) =>
                  report.status !== 'synced' &&
                  report.retryable !== false &&
                  (!get().serverAccounts || report.authorId === get().user?.id),
              );
              for (const queued of pending) {
                if (!get().isOnline) break;
                // Pode ter sido editado enquanto outro relato estava sendo enviado.
                const report = get().reports.find((item) => item.clientId === queued.clientId);
                if (!report || report.status === 'synced') continue;
                set((state) => ({
                  reports: state.reports.map((item) =>
                    item.clientId === report.clientId ? { ...item, status: 'syncing' } : item,
                  ),
                }));
                await localStorage.flush();
                let postStarted = report.status !== 'pending';
                try {
                  let uploadedPhotoUri = report.uploadedPhotoUri;
                  if (get().serverAccounts && report.photoUri && !uploadedPhotoUri) {
                    uploadedPhotoUri = await api.uploadPhoto(report.photoUri);
                    set((s) => ({
                      reports: s.reports.map((r) =>
                        r.clientId === report.clientId ? { ...r, uploadedPhotoUri } : r,
                      ),
                    }));
                    await localStorage.flush();
                  }
                  postStarted = true;
                  const saved = await api.createReport({
                    clientId: report.clientId,
                    category: report.category,
                    description: report.description,
                    address: report.address,
                    coordinates: report.coordinates,
                    observedAt: report.observedAt,
                    authorId: report.authorId,
                    photoUri: get().serverAccounts ? uploadedPhotoUri : report.photoUri,
                    locationMode: report.locationMode,
                  });
                  if (
                    !isFloodReport(saved) ||
                    saved.clientId !== report.clientId ||
                    saved.status !== 'synced'
                  )
                    throw new Error('Confirmação inválida da API.');
                  set((state) => {
                    const reports = state.reports.map((item) =>
                      item.clientId === report.clientId
                        ? {
                            ...saved,
                            photoUri: get().serverAccounts
                              ? saved.photoUri
                              : (item.photoUri ?? saved.photoUri),
                            confirmations: state.confirmedReportIds.includes(item.id)
                              ? Math.max(1, saved.confirmations)
                              : saved.confirmations,
                          }
                        : item,
                    );
                    return { reports, pendingCount: countPending(reports) };
                  });
                  await localStorage.flush();
                } catch (error) {
                  const permanent =
                    error instanceof ApiError && [400, 409, 422].includes(error.status);
                  set((state) => ({
                    reports: state.reports.map((item) =>
                      item.clientId === report.clientId
                        ? {
                            ...item,
                            status: postStarted ? 'failed' : 'pending',
                            retryable: !permanent,
                            lastError: error instanceof Error ? error.message : 'Falha de envio.',
                          }
                        : item,
                    ),
                  }));
                  await localStorage.flush();
                  if (!permanent) throw error;
                }
              }
              // Só o GET avança o cursor; o POST pode ter relatos de outros aparelhos antes dele.
              for (let pageNumber = 0; pageNumber < 1000; pageNumber++) {
                if (!get().isOnline) return;
                const before = Number(pullCursor);
                const page = await api.pullSync(pullCursor);
                const next = Number(page.cursor);
                if (
                  !Array.isArray(page.reports) ||
                  !page.reports.every(isFloodReport) ||
                  !Array.isArray(page.stations) ||
                  !page.stations.every(isStation) ||
                  typeof page.hasMore !== 'boolean' ||
                  !Number.isSafeInteger(next) ||
                  next < before ||
                  (page.hasMore && next === before) ||
                  (!api.useMocks && page.serverId !== targetServerId)
                )
                  throw new Error('Página de sincronização inválida.');
                let last = before;
                if (!api.useMocks) {
                  for (const report of page.reports) {
                    if (
                      report.status !== 'synced' ||
                      !Number.isSafeInteger(report.sequence) ||
                      report.sequence! <= last
                    )
                      throw new Error('Ordem de relatos inválida.');
                    last = report.sequence!;
                  }
                  if (last !== next)
                    throw new Error('Cursor não corresponde aos relatos recebidos.');
                }
                set((state) => {
                  const previous = new Map(
                    state.reports.map((report) => [report.clientId, report]),
                  );
                  const reports = new Map(
                    state.reports
                      .filter((report) => !replacingCache || report.status !== 'synced')
                      .map((report) => [report.clientId, report]),
                  );
                  for (const report of page.reports) {
                    const own = previous.get(report.clientId);
                    if (own?.status !== 'synced' && own?.retryable === false) continue;
                    reports.set(report.clientId, {
                      ...report,
                      photoUri: get().serverAccounts
                        ? report.photoUri
                        : (own?.photoUri ?? report.photoUri),
                      confirmations: state.confirmedReportIds.includes(report.id)
                        ? Math.max(1, report.confirmations)
                        : report.confirmations,
                    });
                  }
                  return {
                    reports: [...reports.values()].sort(
                      (a, b) =>
                        b.observedAt.localeCompare(a.observedAt) ||
                        b.createdAt.localeCompare(a.createdAt),
                    ),
                    cursor: page.cursor,
                    stations: page.stations,
                    ...(replacingCache ? { serverId: targetServerId } : {}),
                  };
                });
                // Relatos e cursor fazem parte da mesma gravação JSON persistente.
                await localStorage.flush();
                pullCursor = page.cursor;
                replacingCache = false;
                if (!page.hasMore) break;
                if (pageNumber === 999)
                  throw new Error('Há muitas páginas. Sincronize novamente para continuar.');
              }
              const official = await api.listObservations();
              if (
                !Array.isArray(official.items) ||
                !official.items.every(isObservation) ||
                !Array.isArray(official.sources) ||
                !official.sources.every(isSourceState)
              )
                throw new Error(
                  'A API retornou medições inválidas. O histórico anterior foi mantido.',
                );
              if (!api.useMocks && official.serverId !== get().serverId)
                throw new Error('O banco central mudou durante a consulta. Sincronize novamente.');
              set((state) => ({
                observations: official.items.length ? official.items : state.observations,
                sources: official.sources.length ? official.sources : state.sources,
                pendingCount: countPending(state.reports),
                lastSyncAt: new Date().toISOString(),
              }));
              await localStorage.flush();
              if (get().serverAccounts)
                await syncCommunity(get, set, api, () => localStorage.flush());
            } catch (error) {
              const expired =
                error instanceof ApiError &&
                error.status === 401 &&
                get().sessionToken === tokenAtStart;
              set({
                syncError: expired
                  ? 'Sua sessão terminou. Entre novamente para continuar. Suas pendências continuam salvas.'
                  : error instanceof Error
                    ? error.message
                    : 'Não foi possível sincronizar.',
                ...(error instanceof ApiError && error.status === 0
                  ? { serviceStatus: 'unavailable' as const }
                  : {}),
                ...(expired
                  ? {
                      user: null,
                      sessionToken: null,
                      authServerId: null,
                      recoveryCode: null,
                      notifications: [],
                      confirmedReportIds: [],
                    }
                  : {}),
              });
              if (expired) {
                try {
                  await localStorage.flush();
                } catch {
                  set({
                    hydrationError:
                      'Não foi possível gravar a saída. Tente novamente quando houver espaço no aparelho.',
                  });
                }
              }
            } finally {
              set((state) => ({ syncing: false, pendingCount: countPending(state.reports) }));
            }
          })().finally(() => {
            activeSync = null;
          });
          return activeSync;
        },
        ...(options.serverAccounts && !api.useMocks
          ? serverAccountActions(
              get,
              set,
              api,
              () => localStorage.flush(),
              () => activeSync ?? Promise.resolve(),
            )
          : {}),
        ...(options.serverAccounts && !api.useMocks
          ? communityActions(get, set, api, () => localStorage.flush())
          : {}),
      }),
      {
        name: api.useMocks ? 'hydro-pulse-state' : 'hydro-pulse-state-api',
        skipHydration: true,
        merge: mergePersistedState,
        storage: createJSONStorage(() => localStorage),
        onRehydrateStorage: () => (state, error) => {
          (state ?? useStore.getState()).finishHydration(error);
        },
        partialize: (state) => ({
          reports: state.reports,
          pendingCount: state.pendingCount,
          disputes: state.disputes,
          confirmedReportIds: state.confirmedReportIds,
          user: state.user,
          accounts: state.serverAccounts ? [] : state.accounts,
          sessionToken: state.sessionToken,
          authServerId: state.authServerId,
          notifications: state.notifications,
          pendingConfirmations: state.pendingConfirmations,
          pendingReportUpdates: state.pendingReportUpdates,
          pendingModerations: state.pendingModerations,
          observations: state.observations,
          sources: state.sources,
          stations: state.stations,
          cursor: state.cursor,
          serverId: state.serverId,
          lastSyncAt: state.lastSyncAt,
          apiUrl: state.apiUrl,
        }),
      },
    ),
  );
  if (options.serverAccounts) api.setTokenGetter(() => useStore.getState().sessionToken);
  return useStore;
}

const inputWithAuthor = (
  input: Omit<ReportDispute, 'id' | 'authorId' | 'createdAt' | 'status'>,
  authorId: string,
) => ({ ...input, authorId });
