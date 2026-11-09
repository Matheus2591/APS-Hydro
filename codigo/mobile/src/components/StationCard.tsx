import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CloudRain, Database } from 'lucide-react-native';

import { colors, radii, shadows, spacing, typography } from '../theme';
import type { Station } from '../types/domain';
import { formatRelativeTime } from '../utils/format';
import { StatusPill } from './StatusPill';

export function StationCard({ station, onPress }: { station: Station; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.top}>
        <View style={styles.rainIcon}>
          <CloudRain color={colors.blue} size={21} />
        </View>
        <StatusPill status={station.status} />
      </View>
      <Text style={styles.value}>
        {station.rainfallMm.toFixed(1).replace('.', ',')}
        <Text style={styles.unit}> mm</Text>
      </Text>
      <Text style={styles.name}>{station.name}</Text>
      <View style={styles.meta}>
        <Database color={colors.muted} size={12} />
        <Text style={styles.metaText} numberOfLines={1}>
          {station.source} · {formatRelativeTime(station.observedAt)}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 190,
    minHeight: 170,
    padding: spacing.lg,
    marginRight: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    ...shadows.card,
  },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.94 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rainIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.ice,
  },
  value: { ...typography.h1, color: colors.ink, marginTop: spacing.lg },
  unit: { ...typography.small, color: colors.muted },
  name: { ...typography.h3, color: colors.ink, marginTop: 2 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: spacing.sm },
  metaText: { ...typography.caption, color: colors.muted, flex: 1 },
});
