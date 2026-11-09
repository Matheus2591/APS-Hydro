import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CloudOff, RefreshCw, Wifi } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '../components/AppHeader';
import { PrimaryButton } from '../components/PrimaryButton';
import { ReportCard } from '../components/ReportCard';
import { useAppStore } from '../store/useAppStore';
import { useVisibleReports } from '../store/useVisibleReports';
import { colors, radii, spacing, typography } from '../theme';
import type { MainTabParamList } from '../types/navigation';
import { USE_MOCKS } from '../services/api/client';

type Props = BottomTabScreenProps<MainTabParamList, 'Atividade'>;

export function ActivityScreen({ navigation }: Props) {
  const reports = useVisibleReports();
  const isOnline = useAppStore((state) => state.isOnline);
  const networkAvailable = useAppStore((state) => state.networkAvailable);
  const setSimulateOffline = useAppStore((state) => state.setSimulateOffline);
  const syncPending = useAppStore((state) => state.syncPending);
  const syncing = useAppStore((state) => state.syncing);
  const syncError = useAppStore((state) => state.syncError);
  const lastSyncAt = useAppStore((state) => state.lastSyncAt);
  const pending = reports.filter((report) => report.status !== 'synced');
  const confirmations = useAppStore((s) => s.pendingConfirmations);
  const disputes = useAppStore((s) => s.disputes);
  const user = useAppStore((s) => s.user);
  const serviceStatus = useAppStore((s) => s.serviceStatus);
  const updates = useAppStore((s) => s.pendingReportUpdates);
  const moderation = useAppStore((s) => s.pendingModerations);
  const queuedConfirmations = confirmations.filter((c) => c.authorId === user?.id).length;
  const queuedDisputes = disputes.filter(
    (d) => d.authorId === user?.id && d.status === 'pending',
  ).length;
  const queuedUpdates = updates.filter((u) => u.authorId === user?.id).length;
  const queuedModerations = moderation.filter((item) => item.authorId === user?.id).length;
  const serviceReady = isOnline && serviceStatus === 'available';
  const totalPending =
    pending.length + queuedConfirmations + queuedDisputes + queuedUpdates + queuedModerations;
  const queueDetails = [
    [pending.length, 'relato', 'relatos'],
    [queuedConfirmations, 'confirmação', 'confirmações'],
    [queuedDisputes, 'contestação', 'contestações'],
    [queuedUpdates, 'atualização', 'atualizações'],
    [queuedModerations, 'análise', 'análises'],
  ]
    .filter(([count]) => Number(count) > 0)
    .map(([count, singular, plural]) => `${count} ${count === 1 ? singular : plural}`)
    .join(' · ');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppHeader title="Atividade" subtitle="Fila e histórico de relatos" />
      <ScrollView contentContainerStyle={styles.content}>
        <View
          style={[styles.connectionCard, serviceReady ? styles.onlineCard : styles.offlineCard]}
        >
          <View style={styles.connectionIcon}>
            {serviceReady ? (
              <Wifi color={colors.green} size={22} />
            ) : (
              <CloudOff color={colors.amber} size={22} />
            )}
          </View>
          <View style={styles.connectionCopy}>
            <Text style={styles.connectionTitle}>
              {!networkAvailable
                ? 'Sem internet'
                : serviceStatus === 'unavailable'
                  ? 'Serviço indisponível'
                  : syncing
                    ? 'Atualizando'
                    : serviceStatus === 'available'
                      ? 'Conectado'
                      : 'Verificando conexão'}
            </Text>
            <Text style={styles.connectionSubtitle}>
              {!networkAvailable
                ? 'Seus relatos continuam salvos neste aparelho'
                : serviceStatus === 'unavailable'
                  ? 'Seus dados estão salvos. Tente sincronizar novamente.'
                  : 'A sincronização acompanha a conexão do aparelho'}
            </Text>
          </View>
          {USE_MOCKS && (
            <Switch
              value={isOnline}
              onValueChange={(enabled) => setSimulateOffline(!enabled)}
              trackColor={{ false: '#E3B65C', true: '#8DDFCA' }}
              thumbColor={colors.white}
            />
          )}
        </View>
        <Text style={styles.connectionHint}>
          {networkAvailable
            ? 'Internet detectada. O compartilhamento também depende da disponibilidade do serviço.'
            : 'O dispositivo não possui acesso à internet no momento.'}
        </Text>
        <PrimaryButton
          label={syncing ? 'Sincronizando...' : 'Sincronizar agora'}
          onPress={syncPending}
          disabled={!isOnline}
          loading={syncing}
          icon={<RefreshCw color={colors.white} size={18} />}
        />
        <Text style={styles.connectionHint}>
          Última sincronização completa:{' '}
          {lastSyncAt ? new Date(lastSyncAt).toLocaleString('pt-BR') : 'ainda não realizada'}
        </Text>
        {syncError && (
          <Text style={[styles.connectionHint, { color: colors.red }]}>{syncError}</Text>
        )}

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{totalPending}</Text>
            <Text style={styles.summaryLabel}>aguardando envio</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>
              {reports.filter((item) => item.status === 'synced').length}
            </Text>
            <Text style={styles.summaryLabel}>sincronizados</Text>
          </View>
        </View>

        {totalPending > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Pendentes</Text>
              <Text style={styles.sectionHint}>Salvos no aparelho</Text>
            </View>
            <Text style={[styles.connectionHint, { marginTop: 0, marginBottom: spacing.md }]}>
              {queueDetails}
            </Text>
            {pending.map((report) => (
              <ReportCard
                key={report.id}
                report={report}
                onPress={() =>
                  navigation.getParent()?.navigate('ReportDetail', { reportId: report.id })
                }
              />
            ))}
            {pending.length === 0 && (
              <Text style={styles.connectionHint}>
                Suas interações e atualizações aguardam envio. Use Sincronizar agora para tentar
                novamente.
              </Text>
            )}
          </View>
        ) : (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <RefreshCw color={colors.green} size={28} />
            </View>
            <Text style={styles.emptyTitle}>Nenhum envio pendente</Text>
            <Text style={styles.emptyText}>
              Não há operações aguardando envio neste dispositivo.
            </Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Histórico recente</Text>
          <View style={styles.spacer} />
          {!reports.some((report) => report.status === 'synced') && (
            <Text style={styles.emptyText}>Ainda não há relatos sincronizados.</Text>
          )}
          {reports
            .filter((report) => report.status === 'synced')
            .map((report) => (
              <ReportCard
                key={report.id}
                report={report}
                onPress={() =>
                  navigation.getParent()?.navigate('ReportDetail', { reportId: report.id })
                }
              />
            ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  content: { padding: spacing.lg, paddingBottom: 120, backgroundColor: colors.canvas },
  connectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  onlineCard: { backgroundColor: colors.greenSoft, borderColor: '#B3E7D6' },
  offlineCard: { backgroundColor: colors.amberSoft, borderColor: '#F1D18D' },
  connectionIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  connectionCopy: { flex: 1, marginLeft: spacing.md },
  connectionTitle: { ...typography.h3, color: colors.ink },
  connectionSubtitle: { ...typography.caption, color: colors.muted, marginTop: 2 },
  connectionHint: {
    ...typography.caption,
    color: colors.muted,
    paddingHorizontal: spacing.xs,
    marginTop: spacing.sm,
  },
  summaryRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  summaryCard: {
    flex: 1,
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  summaryValue: { ...typography.h1, color: colors.ink },
  summaryLabel: { ...typography.caption, color: colors.muted, marginTop: 2 },
  section: { marginTop: spacing.xxl },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sectionTitle: { ...typography.h2, color: colors.ink },
  sectionHint: { ...typography.caption, color: colors.muted },
  spacer: { height: spacing.md },
  empty: {
    alignItems: 'center',
    marginTop: spacing.xxl,
    padding: spacing.xxl,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.greenSoft,
  },
  emptyTitle: { ...typography.h2, color: colors.ink, marginTop: spacing.lg },
  emptyText: {
    ...typography.small,
    color: colors.muted,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});
