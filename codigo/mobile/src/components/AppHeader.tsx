import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Bell, ChevronLeft, MapPin } from 'lucide-react-native';

import { colors, radii, spacing, typography } from '../theme';
import { USE_MOCKS } from '../services/api/client';
import { useAppStore } from '../store/useAppStore';

type Props = {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  onNotifications?: () => void;
  trailing?: ReactNode;
  dark?: boolean;
  showSource?: boolean;
  locationSubtitle?: boolean;
};

export function AppHeader({
  title = 'Hydro Pulse',
  subtitle,
  onBack,
  onNotifications,
  trailing,
  dark = false,
  showSource = false,
  locationSubtitle = false,
}: Props) {
  const unread = useAppStore((s) => s.notifications.some((n) => !n.readAt));
  return (
    <View style={[styles.container, dark && styles.containerDark]}>
      {onBack ? (
        <Pressable accessibilityLabel="Voltar" onPress={onBack} style={styles.iconButton}>
          <ChevronLeft color={dark ? colors.white : colors.ink} size={24} />
        </Pressable>
      ) : (
        <View style={styles.brandMark}>
          <View style={styles.drop} />
        </View>
      )}
      <View style={styles.textArea}>
        <Text style={[styles.title, dark && styles.lightText]}>{title}</Text>
        {(showSource || USE_MOCKS) && (
          <Text style={{ fontSize: 10, color: dark ? '#BCEAFF' : colors.muted, marginTop: 2 }}>
            {USE_MOCKS ? 'DEMONSTRAÇÃO · DADOS SIMULADOS' : 'FONTE OFICIAL + RELATOS DA COMUNIDADE'}
          </Text>
        )}
        {subtitle ? (
          <View style={styles.subtitleRow}>
            {locationSubtitle && <MapPin color={dark ? '#BCEAFF' : colors.blue} size={12} />}
            <Text style={[styles.subtitle, dark && styles.lightMuted]}>{subtitle}</Text>
          </View>
        ) : null}
      </View>
      {trailing ??
        (onNotifications ? (
          <Pressable
            accessibilityLabel="Notificações"
            onPress={onNotifications}
            style={styles.iconButton}
          >
            <Bell color={dark ? colors.white : colors.ink} size={21} />
            {unread && <View style={styles.notificationDot} />}
          </Pressable>
        ) : null)}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 62,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
  },
  containerDark: { backgroundColor: colors.navy },
  brandMark: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.blue,
  },
  drop: {
    width: 13,
    height: 18,
    borderRadius: 10,
    backgroundColor: colors.white,
    transform: [{ rotate: '45deg' }],
    borderTopLeftRadius: 2,
  },
  textArea: { flex: 1 },
  title: { ...typography.h3, color: colors.ink, letterSpacing: -0.2 },
  lightText: { color: colors.white },
  subtitleRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  subtitle: { ...typography.caption, color: colors.muted },
  lightMuted: { color: '#BCEAFF' },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  notificationDot: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.amber,
    borderWidth: 1.5,
    borderColor: colors.navy,
  },
});
