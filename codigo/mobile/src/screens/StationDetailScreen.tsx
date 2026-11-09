import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CloudRain, Database, Gauge, MapPin, ShieldCheck } from 'lucide-react-native';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '../components/AppHeader';
import { StatusPill } from '../components/StatusPill';
import { rainHistory, stations as simulatedStations } from '../data/mock';
import { USE_MOCKS } from '../services/api/client';
import { useAppStore } from '../store/useAppStore';
import { colors, radii, spacing, typography } from '../theme';
import type { RootStackParamList } from '../types/navigation';
import { formatDateTime } from '../utils/format';

type Props = NativeStackScreenProps<RootStackParamList, 'StationDetail'>;

export function StationDetailScreen({ navigation, route }: Props) {
  const realStations = useAppStore((state) => state.stations);
  const stations = USE_MOCKS ? simulatedStations : realStations;
  const station = stations.find((item) => item.id === route.params.stationId);
  const max = Math.max(...rainHistory.map((item) => item.value));
  if (!station)
    return (
      <SafeAreaView style={styles.safe}>
        <AppHeader title="Fonte indisponível" onBack={navigation.goBack} />
        <Text style={{ padding: 24 }}>
          A fonte importada não possui estações com coordenadas. Consulte o histórico oficial no
          Início.
        </Text>
      </SafeAreaView>
    );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <AppHeader title="Detalhes da estação" onBack={navigation.goBack} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.iconBox}>
              <CloudRain color={colors.white} size={30} />
            </View>
            <StatusPill status={station.status} />
          </View>
          <Text style={styles.value}>
            {station.rainfallMm.toFixed(1).replace('.', ',')} <Text style={styles.unit}>mm</Text>
          </Text>
          <Text style={styles.name}>{station.name}</Text>
          <View style={styles.location}>
            <MapPin color="#B6D4E5" size={14} />
            <Text style={styles.locationText}>{station.neighborhood}, Santos - SP</Text>
          </View>
        </View>

        <View style={styles.metaGrid}>
          <View style={styles.metaCard}>
            <Gauge color={colors.blue} size={21} />
            <Text style={styles.metaLabel}>Período</Text>
            <Text style={styles.metaValue}>{station.accumulationPeriodHours} hora</Text>
          </View>
          <View style={styles.metaCard}>
            <Database color={colors.blue} size={21} />
            <Text style={styles.metaLabel}>Fonte oficial</Text>
            <Text style={styles.metaValue}>{station.source}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Últimas 6 horas</Text>
          <View style={styles.chart}>
            {rainHistory.map((item, index) => (
              <View key={item.label} style={styles.barGroup}>
                <Text style={styles.barValue}>{item.value}</Text>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.bar,
                      { height: `${(item.value / max) * 100}%`, opacity: 0.55 + index * 0.08 },
                    ]}
                  />
                </View>
                <Text style={styles.barLabel}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Procedência da medição</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Observado em</Text>
            <Text style={styles.detailValue}>{formatDateTime(station.observedAt)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Variável</Text>
            <Text style={styles.detailValue}>Precipitação acumulada</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Unidade</Text>
            <Text style={styles.detailValue}>Milímetros (mm)</Text>
          </View>
        </View>

        <View style={styles.notice}>
          <ShieldCheck color={colors.blue} size={20} />
          <Text style={styles.noticeText}>
            Esta é uma medição institucional de chuva e não confirma alagamento no local.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl, backgroundColor: colors.canvas },
  hero: { padding: spacing.xl, borderRadius: radii.xl, backgroundColor: colors.navy },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconBox: {
    width: 54,
    height: 54,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.blue,
  },
  value: { ...typography.display, color: colors.white, marginTop: spacing.xl },
  unit: { ...typography.h3, color: '#A9C7D8' },
  name: { ...typography.h2, color: colors.white, marginTop: spacing.xs },
  location: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: spacing.sm },
  locationText: { ...typography.small, color: '#B6D4E5' },
  metaGrid: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  metaCard: {
    flex: 1,
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  metaLabel: { ...typography.caption, color: colors.muted, marginTop: spacing.md },
  metaValue: { ...typography.h3, color: colors.ink, marginTop: 2 },
  card: {
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  cardTitle: { ...typography.h2, color: colors.ink },
  chart: { height: 160, flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  barGroup: { flex: 1, alignItems: 'center' },
  barValue: { ...typography.caption, color: colors.muted },
  barTrack: {
    flex: 1,
    width: '62%',
    justifyContent: 'flex-end',
    backgroundColor: colors.canvas,
    borderRadius: 7,
    overflow: 'hidden',
    marginVertical: 5,
  },
  bar: { width: '100%', borderRadius: 7, backgroundColor: colors.blue },
  barLabel: { ...typography.caption, color: colors.muted },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  detailLabel: { ...typography.small, color: colors.muted },
  detailValue: {
    ...typography.small,
    color: colors.ink,
    fontWeight: '700',
    maxWidth: '60%',
    textAlign: 'right',
  },
  notice: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.ice,
  },
  noticeText: { ...typography.small, color: colors.blueDark, flex: 1 },
});
