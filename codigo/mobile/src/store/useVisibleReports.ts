import { useAppStore } from './useAppStore';
// Relatos compartilhados são públicos. Pendências ficam visíveis à conta que as criou.
export function useVisibleReports() {
  const reports = useAppStore((s) => s.reports);
  const userId = useAppStore((s) => s.user?.id);
  const moderator = useAppStore((s) => s.user?.role === 'moderator');
  return reports.filter(
    (r) =>
      r.visibility !== 'removed' &&
      (r.visibility !== 'hidden' || r.authorId === userId || moderator) &&
      (r.status === 'synced' || r.authorId === userId),
  );
}
