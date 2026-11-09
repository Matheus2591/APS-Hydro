import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from '../components/AppHeader';
import { PrimaryButton } from '../components/PrimaryButton';
import { officialSnapshot } from '../data/official';
import { useAppStore } from '../store/useAppStore';
import { colors, spacing, typography, radii } from '../theme';
import { showMessage } from '../utils/showMessage';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'OfficialData'>;
const date = (value: string) => value.split('-').reverse().join('/');
export function OfficialDataScreen({ navigation }: Props) {
  const stored = useAppStore((state) => state.observations);
  const sources = useAppStore((state) => state.sources);
  const source = sources.find((item) => item.source === officialSnapshot.metadata.source);
  const items = stored
    .filter(
      (item) => item.source === officialSnapshot.metadata.source && item.scopeName === 'Santos',
    )
    .sort((a, b) => b.observationDate.localeCompare(a.observationDate));
  const total = items.reduce((sum, item) => sum + (item.value ?? 0), 0);
  const sourceUrl = items[0]?.sourceUrl ?? officialSnapshot.metadata.sourceUrl;
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <AppHeader title="Medições reais de chuva" onBack={navigation.goBack} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>Prefeitura de Santos</Text>
          <Text style={styles.text}>Dados de Pluviometria · histórico oficial por data.</Text>
          <Text style={styles.total}>{total.toFixed(1).replace('.', ',')} mm</Text>
          <Text style={styles.text}>
            Soma das {items.length} medições salvas
            {items.length
              ? `, de ${date(items.at(-1)!.observationDate)} a ${date(items[0].observationDate)}`
              : ''}
            .
          </Text>
          <Text style={styles.text}>
            A última data publicada pode ser anterior a hoje. Esses dados não indicam chuva em tempo
            real nem confirmam alagamento.
          </Text>
          <Text style={styles.text}>
            Última consulta bem-sucedida:{' '}
            {source?.lastSuccessAt
              ? new Date(source.lastSuccessAt).toLocaleString('pt-BR')
              : 'ainda não informada'}
            .
          </Text>
          {source?.lastError ? (
            <Text accessibilityRole="alert" style={styles.text}>
              A última consulta à fonte falhou. O histórico anterior foi preservado.
              {source.lastAttemptAt
                ? ` Tentativa: ${new Date(source.lastAttemptAt).toLocaleString('pt-BR')}.`
                : ''}
            </Text>
          ) : null}
          <Text style={styles.text}>
            O servidor consulta a fonte a cada 6 horas. A data de consulta é diferente da data de
            medição; novas datas aparecem quando a Prefeitura as publica.
          </Text>
        </View>
        <PrimaryButton
          label="Conferir na página oficial"
          variant="secondary"
          onPress={() =>
            void Linking.openURL(sourceUrl).catch(() =>
              showMessage('Fonte oficial', `Abra este endereço no navegador: ${sourceUrl}`),
            )
          }
        />
        <Text selectable style={styles.link}>
          {sourceUrl}
        </Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.heading}>Data da medição</Text>
            <Text style={styles.heading}>Índice (mm)</Text>
          </View>
          {items.map((item) => (
            <View key={item.id} style={styles.row}>
              <Text style={styles.text}>{date(item.observationDate)}</Text>
              <Text style={styles.value}>
                {item.value === null ? 'Não informado' : item.value.toFixed(2).replace('.', ',')}
              </Text>
            </View>
          ))}
        </View>
        <Text style={styles.text}>
          A publicação não identifica estações, coordenadas ou horário de medição. A unidade mm está
          indicada no acumulado da fonte. Zero só é exibido quando foi publicado como zero; ausência
          não é uma medição de 0 mm.
        </Text>
        <Text style={styles.text}>
          A cópia incluída no APK foi consultada em{' '}
          {new Date(officialSnapshot.metadata.accessedAt).toLocaleString('pt-BR')}. Atualizações
          recebidas pela API mantêm a data original de cada medição.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: 40 },
  card: {
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    gap: spacing.md,
  },
  title: { ...typography.h2, color: colors.ink },
  total: { ...typography.h1, color: colors.blue },
  text: { ...typography.small, color: colors.muted },
  value: { ...typography.body, color: colors.ink },
  heading: { ...typography.h3, color: colors.ink },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  link: { ...typography.caption, color: colors.blue },
});
