import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';

import { colors, spacing, typography } from '../theme';

type Props = { title: string; action?: string; onAction?: () => void };

export function SectionTitle({ title, action, onAction }: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      {action ? (
        <Pressable onPress={onAction} style={styles.action}>
          <Text style={styles.actionText}>{action}</Text>
          <ChevronRight color={colors.blue} size={16} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  title: { ...typography.h2, color: colors.ink, letterSpacing: -0.3 },
  action: { flexDirection: 'row', alignItems: 'center' },
  actionText: { ...typography.small, color: colors.blue, fontWeight: '700' },
});
