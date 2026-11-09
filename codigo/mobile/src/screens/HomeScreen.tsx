import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import { AlertTriangle, ArrowRight, CloudRain, Map, Radio, ShieldCheck } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '../components/AppHeader';
import { ReportCard } from '../components/ReportCard';
import { SectionTitle } from '../components/SectionTitle';
import { PrimaryButton } from '../components/PrimaryButton';
import { StationCard } from '../components/StationCard';
import {
  citySummary,
  rainHistory as simulatedHistory,
  stations as simulatedStations,
} from '../data/mock';
import { USE_MOCKS } from '../services/api/client';
import { useAppStore } from '../store/useAppStore';
import { useVisibleReports } from '../store/useVisibleReports';
import { colors, radii, spacing, typography } from '../theme';
import type { MainTabParamList } from '../types/navigation';

type Props = BottomTabScreenProps<MainTabParamList, 'Inicio'>;

export function HomeScreen({ navigation }: Props) {
  const reports = useVisibleReports();
  const observations = useAppStore((state) => state.observations);
  const sources = useAppStore((state) => state.sources);
  const realStations = useAppStore((state) => state.stations);
  const syncError = useAppStore((state) => state.syncError);
  const stations = USE_MOCKS ? simulatedStations : realStations;
  const sorted = [...observations].sort((a, b) =>
    a.observationDate.localeCompare(b.observationDate),
  );
  const latest = sorted.at(-1);
  const rainHistory = USE_MOCKS
    ? simulatedHistory
    : sorted.slice(-7).map((item) => ({
        label: item.observationDate.slice(5).split('-').reverse().join('/'),
        value: item.value,
      }));
  const maxRain = Math.max(1, ...rainHistory.map((item) => item.value ?? 0));
  const rainfall = USE_MOCKS ? citySummary.rainfall24hMm : latest?.value;
  const rainfallLabel =
    rainfall === null || rainfall === undefined ? '—' : rainfall.toFixed(1).replace('.', ',');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppHeader
        showSource
        locationSubtitle
        subtitle="Santos - SP"
        onNotifications={() => navigation.getParent()?.navigate('Notifications')}
      />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <LinearGradient
          colors={[colors.navy, '#0A4168']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroTop}>
            <View style={{ flex: 1, paddingRight: spacing.md }}>
              <View style={styles.liveBadge}>
                <Radio color={colors.aqua} size={12} />
                <Text style={styles.liveText}>
                  {USE_MOCKS ? 'CENÁRIO SIMULADO' : 'HISTÓRICO OFICIAL DE CHUVA'}
                </Text>
              </View>
              <Text style={styles.heroTitle}>
                {USE_MOCKS ? 'Cenário de demonstração' : 'Dados reais de Santos'}
              </Text>
              <Text style={styles.heroSubtitle}>
                {USE_MOCKS
                  ? 'Exemplo fictício para apresentação'
                  : latest
                    ? `Medição de ${latest.observationDate.split('-').reverse().join('/')} · sem informação em tempo real`
                    : 'Sincronize em Atividade para consultar a fonte oficial'}
              </Text>
            </View>
            <View style={styles.weatherIcon}>
              <CloudRain color={colors.white} size={30} />
            </View>
          </View>
          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroValue}>{rainfallLabel}</Text>
              <Text style={styles.heroLabel}>
                {USE_MOCKS ? 'mm simulados em 24h' : 'mm · índice por data'}
              </Text>
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroValue}>{reports.length}</Text>
              <Text style={styles.heroLabel}>
                {reports.length === 1 ? 'relato disponível' : 'relatos disponíveis'}
              </Text>
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroValue}>
                {USE_MOCKS ? simulatedStations.length : sources.length}
              </Text>
              <Text style={styles.heroLabel}>
                {USE_MOCKS
                  ? simulatedStations.length === 1
                    ? 'estação simulada'
                    : 'estações simuladas'
                  : sources.length === 1
                    ? 'fonte oficial'
                    : 'fontes oficiais'}
              </Text>
            </View>
          </View>
        </LinearGradient>
        {!USE_MOCKS && (
          <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.lg }}>
            <PrimaryButton
              label="Ver medições e fonte oficial"
              variant="secondary"
              onPress={() => navigation.getParent()?.navigate('OfficialData')}
            />
          </View>
        )}
        {syncError ? (
          <View style={styles.disclaimer}>
            <Text style={styles.disclaimerText}>{syncError}</Text>
          </View>
        ) : null}
        {sources
          .filter((source) => source.lastError)
          .map((source) => (
            <View key={source.source} style={styles.disclaimer}>
              <Text style={styles.disclaimerText}>
                A atualização da fonte falhou. O último dado foi mantido. {source.lastError}
              </Text>
            </View>
          ))}

        <View style={styles.quickActions}>
          <Pressable style={styles.actionCard} onPress={() => navigation.navigate('Mapa')}>
            <View style={[styles.actionIcon, { backgroundColor: colors.ice }]}>
              <Map color={colors.blue} size={22} />
            </View>
            <View style={styles.actionCopy}>
              <Text style={styles.actionTitle}>Ver mapa</Text>
              <Text style={styles.actionSubtitle}>Pontos e ocorrências</Text>
            </View>
            <ArrowRight color={colors.muted} size={18} />
          </Pressable>
          <Pressable style={styles.actionCard} onPress={() => navigation.navigate('Relatar')}>
            <View style={[styles.actionIcon, { backgroundColor: colors.amberSoft }]}>
              <AlertTriangle color={colors.amber} size={22} />
            </View>
            <View style={styles.actionCopy}>
              <Text style={styles.actionTitle}>Relatar agora</Text>
              <Text style={styles.actionSubtitle}>Informe um alagamento</Text>
            </View>
            <ArrowRight color={colors.muted} size={18} />
          </Pressable>
        </View>

        <View style={styles.section}>
          <SectionTitle
            title={USE_MOCKS ? 'Estações simuladas' : 'Fonte dos dados'}
            action={USE_MOCKS ? 'Ver no mapa' : undefined}
            onAction={() =>
              USE_MOCKS
                ? navigation.navigate('Mapa')
                : navigation.getParent()?.navigate('OfficialData')
            }
          />
          {!USE_MOCKS && (
            <View style={styles.chartCard}>
              <Text style={styles.disclaimerText}>
                {latest?.source ?? 'Prefeitura de Santos — Dados de Pluviometria'}. Histórico
                importado; a fonte não identifica estações, coordenadas ou horário de medição.
                Unidade mm interpretada do contexto publicado. Não representa a situação atual de
                uma via.
              </Text>
            </View>
          )}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.horizontalBreakout}
          >
            {stations.map((station) => (
              <StationCard
                key={station.id}
                station={station}
                onPress={() =>
                  navigation.getParent()?.navigate('StationDetail', { stationId: station.id })
                }
              />
            ))}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <SectionTitle
            title={USE_MOCKS ? 'Exemplo de precipitação' : 'Índices publicados por data'}
          />
          <View style={styles.chartCard}>
            <View style={styles.chartHeader}>
              <View>
                <Text style={styles.chartLabel}>
                  {USE_MOCKS ? 'Acumulado simulado' : 'Último índice disponível'}
                </Text>
                <Text style={styles.chartValue}>
                  {USE_MOCKS ? '41,0' : rainfallLabel} <Text style={styles.chartUnit}>mm</Text>
                </Text>
              </View>
              <Text style={styles.chartSource}>
                {USE_MOCKS
                  ? 'Dado fictício · Vila Mathias'
                  : 'Prefeitura de Santos · histórico importado'}
              </Text>
            </View>
            <View style={styles.chart}>
              {rainHistory.map((item, index) => (
                <View key={item.label} style={styles.barGroup}>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.bar,
                        {
                          height: `${Math.max(item.value === null || item.value === 0 ? 0 : 2, ((item.value ?? 0) / maxRain) * 100)}%`,
                          backgroundColor:
                            index === rainHistory.length - 1 ? colors.sky : '#A7DDF8',
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.barLabel}>{item.label}</Text>
                  {item.value === null && <Text style={styles.barLabel}>n/d</Text>}
                </View>
              ))}
            </View>
            {!rainHistory.length && (
              <Text style={styles.disclaimerText}>
                Nenhuma medição salva. Use Sincronizar agora na aba Atividade.
              </Text>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <SectionTitle
            title="Relatos recentes"
            action="Ver todos"
            onAction={() => navigation.navigate('Atividade')}
          />
          {reports.slice(0, 2).map((report) => (
            <ReportCard
              key={report.id}
              report={report}
              onPress={() =>
                navigation.getParent()?.navigate('ReportDetail', { reportId: report.id })
              }
            />
          ))}
          {!reports.length && (
            <Text style={{ paddingHorizontal: spacing.lg, color: colors.muted }}>
              Nenhum relato salvo. Use Relatar para registrar uma observação.
            </Text>
          )}
        </View>

        <View style={styles.disclaimer}>
          <ShieldCheck color={colors.blue} size={20} />
          <Text style={styles.disclaimerText}>
            Dados de chuva não confirmam alagamentos. Siga sempre as orientações da Defesa Civil.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  content: { paddingBottom: 110, backgroundColor: colors.canvas },
  hero: { margin: spacing.lg, padding: spacing.xl, borderRadius: radii.xl, overflow: 'hidden' },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: spacing.md },
  liveText: { ...typography.caption, color: '#9EE8DF', letterSpacing: 0.7 },
  heroTitle: { ...typography.h1, color: colors.white, letterSpacing: -0.5 },
  heroSubtitle: { ...typography.small, color: '#B9D4E4', marginTop: 3 },
  weatherIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  heroStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xxl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.14)',
  },
  heroStat: { flex: 1 },
  heroValue: { ...typography.h2, color: colors.white },
  heroLabel: { ...typography.caption, color: '#9FBED0', marginTop: 2 },
  heroDivider: {
    width: 1,
    height: 34,
    backgroundColor: 'rgba(255,255,255,0.14)',
    marginRight: spacing.md,
  },
  quickActions: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  actionIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCopy: { flex: 1, marginLeft: spacing.md },
  actionTitle: { ...typography.h3, color: colors.ink },
  actionSubtitle: { ...typography.caption, color: colors.muted, marginTop: 2 },
  section: { paddingHorizontal: spacing.lg, marginTop: spacing.xxl },
  horizontalBreakout: {
    marginHorizontal: -spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  chartCard: {
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chartHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  chartLabel: { ...typography.caption, color: colors.muted },
  chartValue: { ...typography.h1, color: colors.ink, marginTop: 2 },
  chartUnit: { ...typography.small, color: colors.muted },
  chartSource: { ...typography.caption, color: colors.muted, maxWidth: 140, textAlign: 'right' },
  chart: {
    height: 130,
    marginTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  barGroup: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  barTrack: {
    flex: 1,
    width: '68%',
    justifyContent: 'flex-end',
    backgroundColor: colors.canvas,
    borderRadius: 8,
    overflow: 'hidden',
  },
  bar: { width: '100%', borderRadius: 8 },
  barLabel: { ...typography.caption, color: colors.muted, marginTop: 6 },
  disclaimer: {
    flexDirection: 'row',
    gap: spacing.md,
    margin: spacing.lg,
    marginTop: spacing.xxl,
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.ice,
  },
  disclaimerText: { ...typography.small, color: colors.blueDark, flex: 1 },
});
