import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MapPin, MessageCircle } from 'lucide-react-native';

import { colors, radii, spacing, typography } from '../theme';
import type { FloodReport } from '../types/domain';
import { formatRelativeTime } from '../utils/format';
import { StatusPill } from './StatusPill';
import { hasConfirmedLocation } from '../map/geo';

export function ReportCard({ report, onPress }: { report: FloodReport; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.topRow}>
        <StatusPill
          status={
            report.visibility === 'hidden'
              ? 'hidden'
              : report.lifecycle === 'resolved'
                ? 'resolved'
                : report.status === 'synced'
                  ? report.category
                  : report.status
          }
        />
        <Text style={styles.time}>{formatRelativeTime(report.observedAt)}</Text>
      </View>
      <Text style={styles.address} numberOfLines={1}>
        {report.address}
      </Text>
      <View style={styles.locationRow}>
        <MapPin color={colors.muted} size={13} />
        <Text style={styles.location}>
          Relato da comunidade ·{' '}
          {report.locationMode === 'gps'
            ? 'localização do aparelho'
            : report.locationMode === 'map'
              ? 'ponto escolhido no mapa'
              : 'sem ponto confirmado'}
        </Text>
      </View>
      <Text style={styles.description} numberOfLines={2}>
        {report.description}
      </Text>
      {!hasConfirmedLocation(report) && (
        <Text style={styles.location}>
          Sem ponto confirmado: não aparece como marcador no mapa.
        </Text>
      )}
      <View style={styles.confirmations}>
        <MessageCircle color={colors.blue} size={14} />
        <Text style={styles.confirmationText}>
          {report.confirmations === 1
            ? '1 confirmação da comunidade'
            : `${report.confirmations} confirmações da comunidade`}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: spacing.md,
  },
  pressed: { opacity: 0.92 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  time: { ...typography.caption, color: colors.muted },
  address: { ...typography.h3, color: colors.ink, marginTop: spacing.md },
  locationRow: { flexDirection: 'row', gap: 4, alignItems: 'center', marginTop: 4 },
  location: { ...typography.caption, color: colors.muted },
  description: { ...typography.small, color: colors.navySoft, marginTop: spacing.sm },
  confirmations: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: spacing.md },
  confirmationText: { ...typography.caption, color: colors.blue },
});
