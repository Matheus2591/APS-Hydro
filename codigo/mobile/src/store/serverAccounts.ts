import type { AppState } from './appState';
import type { HydroPulseApi } from '../services/api/hydroPulse';
import { ApiError } from '../services/api/client';
import { isUserAccount } from '../utils/validation';
import type { AccountSession } from '../types/domain';

export function serverAccountActions(
  get: () => AppState,
  set: (value: Partial<AppState> | ((s: AppState) => Partial<AppState>)) => void,
  api: HydroPulseApi,
  flush: () => Promise<unknown>,
  waitForSync: () => Promise<unknown> = async () => {},
) {
  const accountTask = async <T>(task: () => Promise<T>): Promise<T> => {
    if (get().accountBusy) throw new Error('Aguarde a operação da conta terminar.');
    if (get().configuringServer) throw new Error('Aguarde a verificação da conexão terminar.');
    set({ accountBusy: true });
    try {
      await waitForSync();
      return await task();
    } finally {
      set({ accountBusy: false });
    }
  };
  const requireConnection = () => {
    if (!get().apiUrl)
      throw new Error('Configure a conexão com o servidor antes de entrar ou cadastrar.');
    if (!get().isOnline)
      throw new Error('Conecte-se para entrar. Uma sessão já aberta pode continuar offline.');
  };
  const accept = async (session: AccountSession) => {
    if (
      !isUserAccount(session.user) ||
      session.user.password !== '' ||
      !/^[A-Za-z0-9_-]{40,100}$/.test(session.token)
    )
      throw new Error('Sessão inválida da API.');
    await waitForSync();
    const health = await api.health();
    const previous = {
      user: get().user,
      sessionToken: get().sessionToken,
      authServerId: get().authServerId,
      reports: get().reports,
      recoveryCode: get().recoveryCode,
    };
    set({
      user: session.user,
      sessionToken: session.token,
      authServerId: health.serverId,
      accounts: [],
      recoveryCode: session.recoveryCode ?? null,
      serviceStatus: 'available',
      reports: get().reports.map((r) =>
        r.status !== 'synced' && (r.authorId.startsWith('user-') || r.authorId === 'anonymous')
          ? { ...r, authorId: session.user.id }
          : r,
      ),
    });
    try {
      await flush();
    } catch (error) {
      set(previous);
      throw error;
    }
  };
  const updateProfile = async (input: Parameters<AppState['updateProfile']>[0]) => {
    requireConnection();
    const uri = input.profilePhotoUri ? await api.uploadPhoto(input.profilePhotoUri) : undefined;
    let user;
    try {
      user = await api.updateProfile({ ...input, profilePhotoUri: uri });
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) return false;
      throw error;
    }
    if (!isUserAccount(user)) throw new Error('Perfil inválido da API.');
    const previous = get().user;
    set({ user });
    try {
      await flush();
    } catch (error) {
      set({ user: previous });
      throw error;
    }
    return true;
  };
  return {
    register: async (input: Parameters<AppState['register']>[0]) =>
      accountTask(async () => {
        requireConnection();
        if (input.password.length < 8)
          throw new Error('Use uma senha com pelo menos 8 caracteres.');
        let session: AccountSession;
        try {
          session = await api.register(input);
        } catch (error) {
          if (error instanceof ApiError && error.status === 409) return false;
          throw error;
        }
        await accept(session);
        if (input.profilePhotoUri) {
          try {
            await updateProfile({ ...session.user, profilePhotoUri: input.profilePhotoUri });
          } catch {
            set({
              syncError:
                'Conta criada. A foto não foi enviada; escolha-a novamente em Editar perfil.',
            });
          }
        }
        return true;
      }),
    login: async (name: string, password: string) =>
      accountTask(async () => {
        requireConnection();
        let session: AccountSession;
        try {
          session = await api.login(name, password);
        } catch (error) {
          if (error instanceof ApiError && error.status === 401) return false;
          throw error;
        }
        await accept(session);
        return true;
      }),
    logout: async () =>
      accountTask(async () => {
        if (get().isOnline) {
          try {
            await api.logout();
          } catch {
            /* A sessão expira; a saída local ainda é possível sem rede. */
          }
        }
        const previous = { user: get().user, sessionToken: get().sessionToken };
        set({
          user: null,
          sessionToken: null,
          notifications: [],
          confirmedReportIds: [],
          recoveryCode: null,
        });
        try {
          await flush();
        } catch (error) {
          set(previous);
          throw error;
        }
      }),
    recoverAccount: async (name: string, recoveryCode: string, newPassword: string) =>
      accountTask(async () => {
        requireConnection();
        await accept(await api.recoverAccount(name, recoveryCode, newPassword));
      }),
    changePassword: async (currentPassword: string, newPassword: string) =>
      accountTask(async () => {
        requireConnection();
        await accept(await api.changePassword(currentPassword, newPassword));
      }),
    generateRecoveryCode: async (currentPassword: string) =>
      accountTask(async () => {
        requireConnection();
        const result = await api.generateRecoveryCode(currentPassword);
        if (!/^[A-F0-9]{4}(?:-[A-F0-9]{4}){9}$/.test(result.recoveryCode))
          throw new Error('Chave de recuperação inválida.');
        set({ recoveryCode: result.recoveryCode });
      }),
    deleteAccount: async (currentPassword: string, confirmation: string) =>
      accountTask(async () => {
        requireConnection();
        const id = get().user?.id;
        if (!id) throw new Error('Entre na sua conta.');
        await api.deleteAccount(currentPassword, confirmation);
        set((s) => ({
          user: null,
          sessionToken: null,
          authServerId: null,
          recoveryCode: null,
          accounts: [],
          notifications: [],
          confirmedReportIds: [],
          reports: s.reports.filter((r) => r.authorId !== id),
          disputes: s.disputes.filter((d) => d.authorId !== id),
          pendingConfirmations: s.pendingConfirmations.filter((c) => c.authorId !== id),
          pendingReportUpdates: s.pendingReportUpdates.filter((u) => u.authorId !== id),
          pendingModerations: s.pendingModerations.filter((u) => u.authorId !== id),
          cursor: '0',
          serverId: null,
          lastSyncAt: null,
        }));
        await flush();
      }),
    updateProfile,
  };
}
