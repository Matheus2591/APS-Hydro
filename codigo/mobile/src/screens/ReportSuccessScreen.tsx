import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Check, CloudOff, Map, Share2 } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '../components/PrimaryButton';
import { colors, radii, spacing, typography } from '../theme';
import type { RootStackParamList } from '../types/navigation';
import { USE_MOCKS } from '../services/api/client';

type Props = NativeStackScreenProps<RootStackParamList, 'ReportSuccess'>;

export function ReportSuccessScreen({ navigation, route }: Props) {
  const { pending } = route.params;
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <View style={[styles.iconRing, pending && styles.pendingRing]}>
          {pending ? (
            <CloudOff color={colors.amber} size={38} />
          ) : (
            <Check color={colors.green} size={40} strokeWidth={3} />
          )}
        </View>
        <Text style={styles.title}>
          {pending
            ? 'Relato salvo no aparelho'
            : USE_MOCKS
              ? 'Envio simulado concluído'
              : 'Relato enviado!'}
        </Text>
        <Text style={styles.subtitle}>
          {pending
            ? 'Seus dados continuam neste aparelho. Consulte a aba Atividade para acompanhar o envio e eventuais erros.'
            : USE_MOCKS
              ? 'Este relato faz parte da demonstração local e não foi enviado a um servidor.'
              : 'Obrigado por colaborar. Sua informação já aparece como um relato da comunidade.'}
        </Text>
        <View style={styles.protocol}>
          <Text style={styles.protocolLabel}>IDENTIFICADOR DO RELATO</Text>
          <Text style={styles.protocolValue}>{route.params.reportId.slice(-14).toUpperCase()}</Text>
        </View>
      </View>
      <View style={styles.actions}>
        <PrimaryButton
          label="Ver no mapa"
          onPress={() =>
            navigation.navigate('Main', {
              screen: 'Mapa',
              params: { focusReportId: route.params.reportId, focusAt: Date.now() },
            })
          }
          icon={<Map color={colors.white} size={19} />}
        />
        <View style={styles.gap} />
        <PrimaryButton
          label="Voltar ao início"
          onPress={() => navigation.navigate('Main', { screen: 'Inicio' })}
          variant="secondary"
          icon={<Share2 color={colors.blue} size={18} />}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },
  iconRing: {
    width: 96,
    height: 96,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.greenSoft,
  },
  pendingRing: { backgroundColor: colors.amberSoft },
  title: { ...typography.h1, color: colors.ink, textAlign: 'center', marginTop: spacing.xxl },
  subtitle: {
    ...typography.body,
    color: colors.muted,
    textAlign: 'center',
    marginTop: spacing.sm,
    maxWidth: 330,
  },
  protocol: {
    alignItems: 'center',
    marginTop: spacing.xxl,
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.canvas,
    minWidth: 250,
  },
  protocolLabel: { ...typography.caption, color: colors.muted, letterSpacing: 0.7 },
  protocolValue: { ...typography.h3, color: colors.ink, marginTop: spacing.xs, letterSpacing: 1 },
  actions: { padding: spacing.xl, paddingBottom: spacing.xxl },
  gap: { height: spacing.md },
});
