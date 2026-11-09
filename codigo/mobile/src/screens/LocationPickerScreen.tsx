import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CityMap } from '../components/CityMap';
import { AppHeader } from '../components/AppHeader';
import { PrimaryButton } from '../components/PrimaryButton';
import { SANTOS_CENTER } from '../map/geo';
import type { Coordinates } from '../types/domain';
import type { RootStackParamList } from '../types/navigation';
import { colors, spacing, typography } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'LocationPicker'>;
export function LocationPickerScreen({ navigation, route }: Props) {
  const [selected, setSelected] = useState<Coordinates | null>(null);
  const [focus] = useState({
    id: 'initial-picker',
    coordinates: route.params.initialCoordinates ?? SANTOS_CENTER,
    zoom: 16,
  });
  const confirm = () => {
    if (!selected) return;
    const selectedLocation = { coordinates: selected, selectedAt: Date.now() };
    if (route.params.target === 'edit' && route.params.reportId)
      navigation.popTo('ReportEdit', { reportId: route.params.reportId, selectedLocation });
    else navigation.popTo('Main', { screen: 'Relatar', params: { selectedLocation } });
  };
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <AppHeader title="Local da ocorrência" onBack={navigation.goBack} />
      <Text style={styles.hint}>
        Arraste, amplie e toque no local exato da ocorrência. O ponto azul indica sua seleção.
      </Text>
      <CityMap selectable selection={selected} onCoordinateSelect={setSelected} focus={focus} />
      <View style={styles.footer}>
        <Text style={styles.hint}>
          {selected
            ? `Latitude ${selected.latitude.toFixed(6)} · Longitude ${selected.longitude.toFixed(6)}`
            : 'Toque no mapa para escolher um ponto.'}
        </Text>
        <PrimaryButton label="Usar este local" onPress={confirm} disabled={!selected} />
      </View>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  hint: { ...typography.small, padding: spacing.md, color: colors.muted },
  footer: { padding: spacing.lg },
});
