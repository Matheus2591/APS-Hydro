import { StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, typography } from '../theme';
import type { ReportCategory, RiskLevel, SyncStatus } from '../types/domain';

type Status = RiskLevel | ReportCategory | SyncStatus | 'resolved' | 'hidden';

const labels: Record<Status, string> = {
  normal: 'Normal',
  attention: 'Atenção',
  alert: 'Alerta',
  passable: 'Via transitável',
  partial: 'Parcial',
  blocked: 'Via bloqueada',
  pending: 'Pendente',
  syncing: 'Enviando',
  synced: 'Enviado',
  failed: 'Falha no envio',
  resolved: 'Encerrada',
  hidden: 'Ocultado',
};

export function StatusPill({ status }: { status: Status }) {
  const tone =
    status === 'alert' || status === 'blocked' || status === 'failed'
      ? 'danger'
      : status === 'attention' || status === 'partial' || status === 'pending'
        ? 'warning'
        : status === 'syncing' || status === 'hidden'
          ? 'info'
          : 'success';
  return (
    <View style={[styles.base, styles[tone]]}>
      <View style={[styles.dot, styles[`${tone}Dot`]]} />
      <Text style={[styles.text, styles[`${tone}Text`]]}>{labels[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radii.pill,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { ...typography.caption },
  warning: { backgroundColor: colors.amberSoft },
  warningDot: { backgroundColor: colors.amber },
  warningText: { color: '#8A5700' },
  danger: { backgroundColor: colors.redSoft },
  dangerDot: { backgroundColor: colors.red },
  dangerText: { color: '#A12A2A' },
  success: { backgroundColor: colors.greenSoft },
  successDot: { backgroundColor: colors.green },
  successText: { color: '#087153' },
  info: { backgroundColor: colors.ice },
  infoDot: { backgroundColor: colors.blue },
  infoText: { color: colors.blueDark },
});
