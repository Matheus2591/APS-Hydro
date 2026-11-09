import { reports as mockReports, stations as mockStations } from '../../data/mock';
import type {
  CreateReportInput,
  FloodReport,
  ReportDispute,
  Station,
  SyncPullResponse,
  UpdateReportInput,
  OfficialObservation,
  SourceState,
  UserAccount,
  AccountSession,
  CommunityState,
  ReportState,
  PendingReportUpdate,
  ModerationItem,
} from '../../types/domain';
import { createApiClient, USE_MOCKS, type ApiBaseUrl } from './client';

const delay = (ms = 450) => new Promise((resolve) => setTimeout(resolve, ms));

export function createHydroPulseApi(
  options: { baseUrl?: ApiBaseUrl; useMocks?: boolean; fetcher?: typeof fetch } = {},
) {
  let token: (() => string | null) | undefined;
  const apiRequest = createApiClient(options.baseUrl, options.fetcher, () => token?.() ?? null);
  const useMocks = options.useMocks ?? USE_MOCKS;
  return {
    useMocks,
    setTokenGetter(get: () => string | null) {
      token = get;
    },
    register(input: Omit<UserAccount, 'id' | 'createdAt'>) {
      return apiRequest<AccountSession>('/v1/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name: input.name,
          password: input.password,
          phone: input.phone,
          address: input.address,
        }),
      });
    },
    login(name: string, password: string) {
      return apiRequest<AccountSession>('/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ name, password }),
      });
    },
    recoverAccount(name: string, recoveryCode: string, newPassword: string) {
      return apiRequest<AccountSession>('/v1/auth/recover', {
        method: 'POST',
        body: JSON.stringify({ name, recoveryCode, newPassword }),
      });
    },
    changePassword(currentPassword: string, newPassword: string) {
      return apiRequest<AccountSession>('/v1/auth/password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
    },
    generateRecoveryCode(currentPassword: string) {
      return apiRequest<{ recoveryCode: string }>('/v1/auth/recovery-code', {
        method: 'POST',
        body: JSON.stringify({ currentPassword }),
      });
    },
    deleteAccount(currentPassword: string, confirmation: string) {
      return apiRequest<{ ok: boolean }>('/v1/auth/delete', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, confirmation }),
      });
    },
    updateReportState(input: PendingReportUpdate) {
      return apiRequest<ReportState>(`/v1/reports/${encodeURIComponent(input.reportId)}/state`, {
        method: 'POST',
        body: JSON.stringify({
          operationId: input.operationId,
          lifecycle: input.lifecycle,
          note: input.note,
        }),
      });
    },
    moderation() {
      return apiRequest<{ items: ModerationItem[] }>('/v1/moderation');
    },
    moderate(id: string, input: { operationId: string; action: 'keep' | 'hide'; note: string }) {
      return apiRequest<{ ok: boolean }>(`/v1/moderation/${encodeURIComponent(id)}`, {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },
    logout() {
      return apiRequest<{ ok: boolean }>('/v1/auth/logout', { method: 'POST', body: '{}' });
    },
    me() {
      return apiRequest<UserAccount>('/v1/auth/me');
    },
    updateProfile(input: Pick<UserAccount, 'name' | 'phone' | 'address' | 'profilePhotoUri'>) {
      return apiRequest<UserAccount>('/v1/auth/me', {
        method: 'PATCH',
        body: JSON.stringify({
          name: input.name,
          phone: input.phone,
          address: input.address,
          profilePhotoUri: input.profilePhotoUri,
        }),
      });
    },
    async uploadPhoto(uri: string) {
      if (uri.startsWith('/v1/media/')) return uri;
      const match = uri.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
      if (!match)
        throw new Error(
          'Escolha a foto novamente para compartilhá-la. O arquivo antigo continua no aparelho.',
        );
      const result = await apiRequest<{ uri: string }>('/v1/media', {
        method: 'POST',
        body: JSON.stringify({ mime: match[1], base64: match[2] }),
        timeoutMs: 30_000,
      });
      if (!/^\/v1\/media\/[a-f0-9]{64}$/.test(result.uri))
        throw new Error('A API devolveu uma foto inválida.');
      return result.uri;
    },
    confirmReport(reportId: string) {
      return apiRequest<{ reportId: string; confirmations: number }>(
        `/v1/reports/${encodeURIComponent(reportId)}/confirm`,
        { method: 'POST', body: '{}' },
      );
    },
    community() {
      return apiRequest<CommunityState>('/v1/community');
    },
    readNotification(id: number) {
      return apiRequest<{ ok: boolean }>('/v1/notifications/read', {
        method: 'POST',
        body: JSON.stringify({ id }),
      });
    },
    async health() {
      return apiRequest<{ status: 'ok'; serverId: string; capabilities?: string[] }>('/health');
    },
    async listObservations() {
      if (useMocks)
        return {
          items: [] as OfficialObservation[],
          sources: [] as SourceState[],
          serverId: 'demo',
        };
      return apiRequest<{ items: OfficialObservation[]; sources: SourceState[]; serverId: string }>(
        '/v1/observations',
      );
    },
    async listStations(): Promise<Station[]> {
      if (useMocks) {
        await delay();
        return mockStations;
      }
      return apiRequest<Station[]>('/v1/stations');
    },

    async listReports(params?: { since?: string }): Promise<FloodReport[]> {
      if (useMocks) {
        await delay();
        return mockReports;
      }
      const query = params?.since ? `?since=${encodeURIComponent(params.since)}` : '';
      return apiRequest<FloodReport[]>(`/v1/reports${query}`);
    },

    async createReport(input: CreateReportInput): Promise<FloodReport> {
      if (useMocks) {
        await delay(700);
        return {
          ...input,
          id: input.clientId,
          neighborhood: 'Santos',
          createdAt: new Date().toISOString(),
          status: 'synced',
          source: 'community',
          confirmations: 0,
          authorId: input.authorId,
          photoUri: input.photoUri,
        };
      }
      return apiRequest<FloodReport>('/v1/reports', {
        method: 'POST',
        headers: { 'Idempotency-Key': input.clientId },
        body: JSON.stringify({
          ...input,
          photoUri:
            input.photoUri?.startsWith('https://') || input.photoUri?.startsWith('/v1/media/')
              ? input.photoUri
              : undefined,
        }),
      });
    },

    async updateReport(reportId: string, input: UpdateReportInput): Promise<FloodReport> {
      if (useMocks) {
        await delay(500);
        return {
          ...input,
          id: reportId,
          clientId: reportId,
          neighborhood: 'Santos',
          createdAt: new Date().toISOString(),
          status: 'synced',
          source: 'community',
          confirmations: 0,
          authorId: 'local-user',
        };
      }
      return apiRequest<FloodReport>(`/v1/reports/${encodeURIComponent(reportId)}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      });
    },

    async submitDispute(
      input: Omit<ReportDispute, 'id' | 'createdAt' | 'status'> & { id?: string },
    ): Promise<ReportDispute> {
      if (useMocks) {
        await delay(500);
        return {
          ...input,
          id: `dispute-${Date.now()}`,
          createdAt: new Date().toISOString(),
          status: 'sent',
        };
      }
      return apiRequest<ReportDispute>('/v1/report-disputes', {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },

    async pullSync(cursor?: string): Promise<SyncPullResponse> {
      if (useMocks)
        return {
          cursor: cursor ?? '0',
          stations: mockStations,
          reports: [],
          serverTime: new Date().toISOString(),
          serverId: 'demo',
          hasMore: false,
        };
      const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
      return apiRequest<SyncPullResponse>(`/v1/sync/pull${query}`);
    },
  };
}

export const hydroPulseApi = createHydroPulseApi();
export type HydroPulseApi = ReturnType<typeof createHydroPulseApi>;
