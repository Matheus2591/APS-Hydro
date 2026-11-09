import type { AppState } from './appState';
import type { HydroPulseApi } from '../services/api/hydroPulse';
import { isDispute, isReportState } from '../utils/validation';
type SetState = (v: Partial<AppState> | ((s: AppState) => Partial<AppState>)) => void;

// A fila tem identificadores estáveis. Repetir a requisição não repete a confirmação ou contestação.
export async function syncCommunity(
  get: () => AppState,
  set: SetState,
  api: HydroPulseApi,
  flush: () => Promise<unknown>,
) {
  const user = get().user;
  if (!user || !get().sessionToken) return;
  for (const update of get().pendingReportUpdates.filter((item) => item.authorId === user.id)) {
    const saved = await api.updateReportState(update);
    if (!isReportState(saved) || saved.reportId !== update.reportId)
      throw new Error('Resposta inválida da atualização.');
    set((s) => ({
      pendingReportUpdates: s.pendingReportUpdates.filter(
        (item) => item.operationId !== update.operationId,
      ),
      reports: s.reports.map((report) =>
        report.id === saved.reportId ? { ...report, ...saved } : report,
      ),
    }));
    await flush();
  }
  for (const decision of get().pendingModerations.filter((item) => item.authorId === user.id)) {
    await api.moderate(decision.disputeId, {
      operationId: decision.operationId,
      action: decision.action,
      note: decision.note,
    });
    set((s) => ({
      pendingModerations: s.pendingModerations.filter(
        (item) => item.operationId !== decision.operationId,
      ),
    }));
    await flush();
  }
  for (const item of get().pendingConfirmations.filter((i) => i.authorId === user.id)) {
    await api.confirmReport(item.reportId);
    set((s) => ({ pendingConfirmations: s.pendingConfirmations.filter((i) => i !== item) }));
    await flush();
  }
  for (const item of get().disputes.filter(
    (i) => i.authorId === user.id && i.status === 'pending',
  )) {
    try {
      const uri =
        item.uploadedPhotoUri ?? (item.photoUri ? await api.uploadPhoto(item.photoUri) : undefined);
      if (uri && !item.uploadedPhotoUri) {
        set((s) => ({
          disputes: s.disputes.map((d) => (d.id === item.id ? { ...d, uploadedPhotoUri: uri } : d)),
        }));
        await flush();
      }
      const saved = await api.submitDispute({
        id: item.id,
        reportId: item.reportId,
        authorId: user.id,
        justification: item.justification,
        photoUri: uri,
      });
      if (!isDispute(saved) || saved.id !== item.id || saved.status !== 'sent')
        throw new Error('Confirmação inválida da contestação.');
      set((s) => ({
        disputes: s.disputes.map((d) => (d.id === item.id ? { ...saved, photoUri: uri } : d)),
      }));
      await flush();
    } catch (error) {
      set((s) => ({
        disputes: s.disputes.map((d) =>
          d.id === item.id
            ? { ...d, lastError: error instanceof Error ? error.message : 'Falha no envio.' }
            : d,
        ),
      }));
      await flush();
      throw error;
    }
  }
  for (const item of get().notifications.filter((n) => n.readAt))
    await api.readNotification(item.id);
  const state = await api.community();
  if (
    !Array.isArray(state.confirmations) ||
    !state.confirmations.every(
      (c) => typeof c.reportId === 'string' && Number.isSafeInteger(c.count) && c.count >= 0,
    ) ||
    !Array.isArray(state.confirmedReportIds) ||
    !state.confirmedReportIds.every((id) => typeof id === 'string') ||
    !Array.isArray(state.disputes) ||
    !state.disputes.every(isDispute) ||
    !Array.isArray(state.notifications) ||
    (state.reportStates !== undefined &&
      (!Array.isArray(state.reportStates) || !state.reportStates.every(isReportState))) ||
    !state.notifications.every(
      (n) =>
        Number.isSafeInteger(n.id) &&
        typeof n.title === 'string' &&
        typeof n.body === 'string' &&
        typeof n.reportId === 'string' &&
        Number.isFinite(Date.parse(n.createdAt)) &&
        (n.readAt === null || Number.isFinite(Date.parse(n.readAt))),
    )
  )
    throw new Error('A API devolveu dados de comunidade inválidos.');
  const counts = new Map(state.confirmations.map((c) => [c.reportId, c.count]));
  const states = new Map((state.reportStates ?? []).map((item) => [item.reportId, item]));
  set((s) => ({
    reports: s.reports
      .map((r) => ({ ...r, ...states.get(r.id), confirmations: counts.get(r.id) ?? 0 }))
      .filter((r) => r.visibility !== 'removed'),
    confirmedReportIds: state.confirmedReportIds,
    disputes: [
      ...s.disputes.filter(
        (d) => d.status === 'pending' && !state.disputes.some((remote) => remote.id === d.id),
      ),
      ...state.disputes.map((d) => ({ ...d, photoUri: d.photoUri ?? undefined })),
    ],
    notifications: state.notifications,
  }));
  await flush();
}

export function communityActions(
  get: () => AppState,
  set: SetState,
  api: HydroPulseApi,
  flush: () => Promise<unknown>,
) {
  return {
    moderateDispute: async (disputeId: string, action: 'keep' | 'hide', note: string) => {
      const user = get().user;
      if (user?.role !== 'moderator') throw new Error('Esta ação exige uma conta de moderação.');
      if (!get().isOnline) throw new Error('Conecte-se para analisar o conteúdo atual.');
      if (!['keep', 'hide'].includes(action) || note.trim().length < 10 || note.trim().length > 300)
        throw new Error('Explique a decisão em 10 a 300 caracteres.');
      const existing = get().pendingModerations.find(
        (item) => item.disputeId === disputeId && item.authorId === user.id,
      );
      if (existing && (existing.action !== action || existing.note !== note.trim()))
        throw new Error('Confirme o envio da decisão anterior antes de alterá-la.');
      if (!existing) {
        const previous = get().pendingModerations;
        set({
          pendingModerations: [
            ...previous,
            {
              operationId: `moderation-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`,
              disputeId,
              authorId: user.id,
              action,
              note: note.trim(),
            },
          ],
        });
        try {
          await flush();
        } catch (error) {
          set({ pendingModerations: previous });
          throw error;
        }
      }
      await get().syncPending();
      if (
        get().pendingModerations.some(
          (item) => item.disputeId === disputeId && item.authorId === user.id,
        )
      )
        throw new Error(get().syncError ?? 'A decisão está salva e aguarda confirmação de envio.');
    },
    updateReportStatus: async (
      reportId: string,
      lifecycle: 'active' | 'resolved',
      note: string,
    ) => {
      const user = get().user,
        report = get().reports.find((r) => r.id === reportId);
      if (!user || !report || report.authorId !== user.id)
        throw new Error('Somente o autor pode atualizar esta ocorrência.');
      if (report.status !== 'synced')
        throw new Error('Envie o relato antes de registrar uma atualização.');
      if (!['active', 'resolved'].includes(lifecycle) || note.trim().length > 300)
        throw new Error('Confira a situação e escreva até 300 caracteres.');
      const previous = { reports: get().reports, pendingReportUpdates: get().pendingReportUpdates };
      const update = {
        operationId: `update-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`,
        reportId,
        authorId: user.id,
        lifecycle,
        note: note.trim(),
      };
      set((s) => ({
        pendingReportUpdates: [...s.pendingReportUpdates, update],
        reports: s.reports.map((r) =>
          r.id === reportId
            ? { ...r, lifecycle, stateNote: note.trim(), stateUpdatedAt: new Date().toISOString() }
            : r,
        ),
      }));
      try {
        await flush();
      } catch (error) {
        set(previous);
        throw error;
      }
      await get().syncPending();
    },
    confirmReport: async (reportId: string) => {
      const user = get().user,
        report = get().reports.find((r) => r.id === reportId);
      if (!user || !report) throw new Error('Entre na sua conta e sincronize o relato.');
      if (report.authorId === user.id)
        throw new Error('Você não pode confirmar seu próprio relato.');
      if (
        get().confirmedReportIds.includes(reportId) ||
        get().pendingConfirmations.some((i) => i.reportId === reportId && i.authorId === user.id)
      )
        return;
      const previous = get().pendingConfirmations;
      set({ pendingConfirmations: [...previous, { reportId, authorId: user.id }] });
      try {
        await flush();
      } catch (error) {
        set({ pendingConfirmations: previous });
        throw error;
      }
      await get().syncPending();
    },
    readNotification: async (id: number) => {
      const previous = get().notifications;
      set({
        notifications: previous.map((n) =>
          n.id === id ? { ...n, readAt: new Date().toISOString() } : n,
        ),
      });
      try {
        await flush();
      } catch (error) {
        set({ notifications: previous });
        throw error;
      }
      if (get().isOnline) await api.readNotification(id);
    },
  };
}
