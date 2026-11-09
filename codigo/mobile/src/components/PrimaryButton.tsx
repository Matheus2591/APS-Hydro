import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { colors, radii, spacing, typography } from '../theme';

type Props = {
  label: string;
  onPress: () => void;
  icon?: ReactNode;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
};

export function PrimaryButton({
  label,
  onPress,
  icon,
  loading,
  disabled,
  variant = 'primary',
}: Props) {
  const secondary = variant === 'secondary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondary,
        pressed && styles.pressed,
        (disabled || loading) && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={secondary ? colors.blue : colors.white} />
      ) : (
        <>
          {icon}
          <Text style={[styles.label, secondary && styles.secondaryLabel]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 54,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.blue,
  },
  secondary: { backgroundColor: colors.ice, borderWidth: 1, borderColor: '#C2E8FA' },
  label: { ...typography.h3, color: colors.white, flexShrink: 1, textAlign: 'center' },
  secondaryLabel: { color: colors.blueDark },
  pressed: { transform: [{ scale: 0.99 }], opacity: 0.9 },
  disabled: { opacity: 0.5 },
});
