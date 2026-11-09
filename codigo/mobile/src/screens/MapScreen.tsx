import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useEffect, useMemo, useState } from 'react';
import { ListFilter, Search } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CityMap } from '../components/CityMap';
import { ReportCard } from '../components/ReportCard';
import { stations as simulatedStations } from '../data/mock';
import { hasConfirmedLocation, SANTOS_CENTER, type MapFocus } from '../map/geo';
import { getDeviceLocation } from '../services/location';
import { USE_MOCKS } from '../services/api/client';
import { useAppStore } from '../store/useAppStore';
import { useVisibleReports } from '../store/useVisibleReports';
import { colors, radii, spacing, typography } from '../theme';
import type { Coordinates, ReportCategory } from '../types/domain';
import type { MainTabParamList } from '../types/navigation';
import { matchesSearch } from '../utils/search';
import { showMessage } from '../utils/showMessage';

type Props = BottomTabScreenProps<MainTabParamList, 'Mapa'>;
const categories = ['all', 'passable', 'partial', 'blocked'] as const;
const labels = { all: 'Todas', passable: 'Leve', partial: 'Moderado', blocked: 'Grave' };

export function MapScreen({ navigation, route }: Props) {
  const reports = useVisibleReports();
  const realStations = useAppStore((state) => state.stations);
  const tabHeight = useBottomTabBarHeight();
  const [query, setQuery] = useState('');
  const [showStations, setShowStations] = useState(true);
  const [showReports, setShowReports] = useState(true);
  const [showList, setShowList] = useState(false);
  const [category, setCategory] = useState<ReportCategory | 'all'>('all');
  const [focus, setFocus] = useState<MapFocus>();
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [locating, setLocating] = useState(false);
  const [period, setPeriod] = useState<'24h' | '7d' | 'all'>('24h');
  const [showResolved, setShowResolved] = useState(false);
  const visibleReports = useMemo(
    () =>
      showReports
        ? reports.filter(
            (report) =>
              report.visibility !== 'hidden' &&
              report.visibility !== 'removed' &&
              (showResolved || report.lifecycle !== 'resolved') &&
              (period === 'all' ||
                Date.now() - Date.parse(report.observedAt) <=
                  (period === '24h' ? 24 : 168) * 3600_000) &&
              (category === 'all' || report.category === category) &&
              matchesSearch(query, report.address, report.description),
          )
        : [],
    [reports, query, category, showReports, period, showResolved],
  );
  const stations = useMemo(
    () =>
      showStations
        ? (USE_MOCKS ? simulatedStations : realStations).filter((station) =>
            matchesSearch(query, station.name, station.neighborhood),
          )
        : [],
    [showStations, realStations, query],
  );
  const located = visibleReports.filter(hasConfirmedLocation).length;
  useEffect(() => {
    const id = route.params?.focusReportId;
    if (!id) return;
    const report = reports.find((item) => item.id === id);
    if (report && hasConfirmedLocation(report)) {
      setQuery('');
      setCategory('all');
      setShowReports(true);
      setPeriod('all');
      setShowResolved(report.lifecycle === 'resolved');
      setFocus({
        id: `report-${id}-${route.params?.focusAt}`,
        coordinates: report.coordinates,
        zoom: 17,
      });
    }
    navigation.setParams({ focusReportId: undefined, focusAt: undefined });
  }, [route.params?.focusReportId, route.params?.focusAt, reports, navigation]);
  const locate = async () => {
    setLocating(true);
    try {
      const point = await getDeviceLocation();
      setUserLocation(point);
      setFocus({ id: `gps-${Date.now()}`, coordinates: point, zoom: 16 });
    } catch (error) {
      showMessage(
        'Localização indisponível',
        error instanceof Error ? error.message : 'Tente novamente.',
      );
    } finally {
      setLocating(false);
    }
  };
  return (
    <SafeAreaView style={[styles.safe, { paddingBottom: tabHeight }]} edges={['top']}>
      <View style={styles.toolbar}>
        {USE_MOCKS && (
          <Text style={styles.caption}>Modo de teste: relatos e estações simulados.</Text>
        )}
        <View style={styles.search}>
          <Search size={19} color={colors.muted} />
          <TextInput
            placeholderTextColor={colors.muted}
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar nos relatos"
            maxLength={100}
            style={styles.input}
            accessibilityLabel="Buscar nos relatos"
          />
          <Pressable
            onPress={() =>
              setCategory(categories[(categories.indexOf(category) + 1) % categories.length])
            }
            accessibilityRole="button"
            accessibilityLabel={`Filtrar situação: ${labels[category]}`}
            style={styles.smallButton}
          >
            <ListFilter size={20} color={colors.blue} />
          </Pressable>
        </View>
        <View style={styles.row}>
          <Pressable
            style={styles.smallButton}
            onPress={() => setShowReports(!showReports)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: showReports }}
          >
            <Text style={styles.buttonText}>
              Relatos {showReports ? '✓' : '—'} · {labels[category]}
            </Text>
          </Pressable>
          {(USE_MOCKS || realStations.length > 0) && (
            <Pressable
              style={styles.smallButton}
              onPress={() => setShowStations(!showStations)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: showStations }}
            >
              <Text style={styles.buttonText}>Estações {showStations ? '✓' : '—'}</Text>
            </Pressable>
          )}
        </View>
        <View style={styles.row}>
          <Pressable
            style={styles.smallButton}
            onPress={() =>
              setFocus({ id: `city-${Date.now()}`, coordinates: SANTOS_CENTER, zoom: 13 })
            }
          >
            <Text style={styles.buttonText}>Santos</Text>
          </Pressable>
          <Pressable
            style={styles.smallButton}
            onPress={() => setFocus({ id: `fit-${Date.now()}`, fit: true })}
            accessibilityLabel="Enquadrar todos os relatos localizados"
          >
            <Text style={styles.buttonText}>Ver relatos</Text>
          </Pressable>
          <Pressable
            style={styles.smallButton}
            onPress={locate}
            disabled={locating}
            accessibilityLabel="Obter minha posição pelo GPS"
          >
            <Text style={styles.buttonText}>{locating ? 'Localizando…' : 'Minha localização'}</Text>
          </Pressable>
        </View>
        <View style={styles.row}>
          {(['24h', '7d', 'all'] as const).map((value) => (
            <Pressable
              key={value}
              style={styles.smallButton}
              accessibilityRole="button"
              accessibilityState={{ selected: period === value }}
              onPress={() => setPeriod(value)}
            >
              <Text style={styles.buttonText}>
                {period === value ? '✓ ' : ''}
                {value === '24h' ? '24 horas' : value === '7d' ? '7 dias' : 'Todo histórico'}
              </Text>
            </Pressable>
          ))}
          <Pressable
            style={styles.smallButton}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: showResolved }}
            onPress={() => setShowResolved(!showResolved)}
          >
            <Text style={styles.buttonText}>Encerradas {showResolved ? '✓' : '—'}</Text>
          </Pressable>
        </View>
      </View>
      <CityMap
        stations={stations}
        reports={visibleReports}
        focus={focus}
        userLocation={userLocation}
        onStationPress={(station) =>
          navigation.getParent()?.navigate('StationDetail', { stationId: station.id })
        }
        onReportPress={(report) =>
          navigation.getParent()?.navigate('ReportDetail', { reportId: report.id })
        }
      />
      <View style={styles.summary}>
        <Text style={styles.caption}>
          Verde: leve · laranja: moderado · vermelho: grave · cinza: encerrada
        </Text>
        <Text style={styles.caption}>
          {located} {located === 1 ? 'relato com ponto confirmado' : 'relatos com ponto confirmado'}
          {period === '24h'
            ? ' · observados nas últimas 24 horas'
            : period === '7d'
              ? ' · observados nos últimos 7 dias'
              : ' · histórico completo'}
          {visibleReports.length > located
            ? ` · ${visibleReports.length - located} sem posição confirmada (somente na lista)`
            : ''}
        </Text>
        <Pressable
          style={styles.smallButton}
          onPress={() => setShowList(!showList)}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>
            {showList ? 'Recolher lista' : `Ver lista de relatos (${visibleReports.length})`}
          </Text>
        </Pressable>
        {showList && (
          <ScrollView horizontal style={{ maxHeight: 180 }} contentContainerStyle={{ gap: 10 }}>
            {!visibleReports.length && (
              <Text style={styles.caption}>
                Nenhum relato para estes filtros. Os dados de chuva não possuem coordenadas de
                estação publicadas.
              </Text>
            )}
            {visibleReports.map((report) => (
              <View key={report.id} style={{ width: 280 }}>
                <ReportCard
                  report={report}
                  onPress={() =>
                    navigation.getParent()?.navigate('ReportDetail', { reportId: report.id })
                  }
                />
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  toolbar: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, gap: 6, paddingBottom: 8 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingLeft: 12,
    minHeight: 48,
  },
  input: { flex: 1, padding: 10, ...typography.body, color: colors.ink },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  smallButton: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  buttonText: { ...typography.small, color: colors.blue },
  caption: { ...typography.caption, color: colors.muted },
  summary: { padding: 8, gap: 4, backgroundColor: colors.surface },
});
