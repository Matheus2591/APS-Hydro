import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '../components/PrimaryButton';
import { useAppStore } from '../store/useAppStore';
import { colors, radii, spacing, typography } from '../theme';

export function RecoveryCodeScreen() {
  const code = useAppStore((s) => s.recoveryCode);
  const dismiss = useAppStore((s) => s.dismissRecoveryCode);
  const [saved, setSaved] = useState(false);
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Guarde sua chave de recuperação</Text>
        <Text style={styles.text}>
          Use esta chave para recuperar sua conta se esquecer a senha. Ela será mostrada somente
          agora. Toque e segure no texto para copiar e guarde em um lugar seguro.
        </Text>
        <View style={styles.card}>
          <Text selectable accessibilityLabel="Chave de recuperação da conta" style={styles.code}>
            {code}
          </Text>
        </View>
        <Text style={styles.text}>
          Não compartilhe esta chave. Ela permite trocar sua senha. Ao usar ou gerar uma nova chave,
          a anterior deixa de funcionar.
        </Text>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: saved }}
          onPress={() => setSaved(!saved)}
          style={styles.check}
        >
          <Text style={styles.checkText}>
            {saved ? '☑' : '☐'} Guardei minha chave em um lugar seguro
          </Text>
        </Pressable>
        <PrimaryButton label="Continuar para o aplicativo" disabled={!saved} onPress={dismiss} />
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: spacing.xl, gap: spacing.xl, flexGrow: 1, justifyContent: 'center' },
  title: { ...typography.h1, color: colors.ink },
  text: { ...typography.body, color: colors.muted },
  card: {
    padding: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.line,
  },
  code: { ...typography.h2, color: colors.blue, letterSpacing: 1, lineHeight: 34 },
  check: { paddingVertical: spacing.lg },
  checkText: { ...typography.body, color: colors.ink },
});
