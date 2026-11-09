import { AppImage as Image } from '../components/AppImage';
import { showMessage } from '../utils/showMessage';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import * as Location from 'expo-location';
import { Camera, Clock3, LocateFixed, MapPin, ShieldAlert } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '../components/AppHeader';
import { PrimaryButton } from '../components/PrimaryButton';
import { useAppStore } from '../store/useAppStore';
import { selectPhoto } from '../services/selectPhoto';
import { getDeviceLocation } from '../services/location';
import { colors, radii, spacing, typography } from '../theme';
import type { Coordinates, ReportCategory } from '../types/domain';
import type { MainTabParamList } from '../types/navigation';

type Props = BottomTabScreenProps<MainTabParamList, 'Relatar'>;

const categories: Array<{ id: ReportCategory; title: string; subtitle: string }> = [
  { id: 'passable', title: 'Leve', subtitle: 'Via transitável' },
  { id: 'partial', title: 'Moderado', subtitle: 'Passagem parcial' },
  { id: 'blocked', title: 'Grave', subtitle: 'Via bloqueada' },
];

export function ReportScreen({ navigation, route }: Props) {
  const createReport = useAppStore((state) => state.createReport);
  const isOnline = useAppStore((state) => state.isOnline);
  const [category, setCategory] = useState<ReportCategory>('partial');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [locationMode, setLocationMode] = useState<'gps' | 'map' | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [photoUri, setPhotoUri] = useState('');
  const [minutesAgo, setMinutesAgo] = useState(0);
  useEffect(() => {
    const selected = route.params?.selectedLocation;
    if (!selected) return;
    setCoordinates(selected.coordinates);
    setLocationMode('map');
    setAddress((current) =>
      current.trim()
        ? current
        : `Ponto selecionado no mapa (${selected.coordinates.latitude.toFixed(5)}, ${selected.coordinates.longitude.toFixed(5)})`,
    );
    navigation.setParams({ selectedLocation: undefined });
  }, [route.params?.selectedLocation, navigation]);

  const pickPhoto = async () => {
    try {
      const uri = await selectPhoto();
      if (uri) setPhotoUri(uri);
    } catch (error) {
      showMessage(
        'Não foi possível escolher a foto',
        error instanceof Error ? error.message : 'Tente novamente.',
      );
    }
  };

  const requestLocation = async () => {
    setLoadingLocation(true);
    try {
      const point = await getDeviceLocation();
      setCoordinates(point);
      setLocationMode('gps');
      // O GPS pode funcionar mesmo quando o serviço de endereço está indisponível.
      setAddress(`Coordenadas ${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}`);
      try {
        const [place] = await Location.reverseGeocodeAsync(point);
        const resolved =
          place &&
          [place.street, place.streetNumber, place.district, place.city].filter(Boolean).join(', ');
        if (resolved) setAddress(resolved);
      } catch {
        /* Preservar a posição confirmada e permitir informar o endereço. */
      }
    } catch (error) {
      showMessage(
        'Localização indisponível',
        error instanceof Error
          ? error.message
          : 'Escolha o local no mapa ou tente o GPS novamente.',
      );
    } finally {
      setLoadingLocation(false);
    }
  };

  const submit = async () => {
    if (!coordinates || !locationMode) {
      showMessage(
        'Escolha o local da ocorrência',
        'Use o GPS ou toque em Escolher ponto no mapa. Nenhuma posição de demonstração será enviada.',
      );
      return;
    }
    if (!address.trim() || description.trim().length < 10) {
      showMessage(
        'Revise o relato',
        'Informe o local e uma descrição com pelo menos 10 caracteres.',
      );
      return;
    }
    setSubmitting(true);
    try {
      const report = await createReport({
        category,
        address: address.trim(),
        description: description.trim(),
        coordinates,
        observedAt: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
        locationMode,
        photoUri: photoUri || undefined,
      });
      setSubmitting(false);
      setDescription('');
      setPhotoUri('');
      setCoordinates(null);
      setLocationMode(null);
      setAddress('');
      setMinutesAgo(0);
      navigation.getParent()?.navigate('ReportSuccess', {
        reportId: report.id,
        pending: report.status !== 'synced',
      });
    } catch (error) {
      showMessage(
        'Não foi possível salvar',
        error instanceof Error
          ? error.message
          : 'A gravação local não foi confirmada. Confira o espaço do aparelho e tente novamente.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppHeader title="Novo relato" subtitle={isOnline ? 'Conectado' : 'Modo offline'} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {!isOnline ? (
            <View style={styles.offlineBanner}>
              <ShieldAlert color={colors.amber} size={20} />
              <Text style={styles.offlineText}>
                Sem conexão. Seu relato ficará salvo neste aparelho e será enviado depois.
              </Text>
            </View>
          ) : null}

          <Text style={styles.label}>Qual é a situação?</Text>
          <View style={styles.categoryRow}>
            {categories.map((item) => {
              const selected = item.id === category;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => setCategory(item.id)}
                  style={[styles.category, selected && styles.categorySelected]}
                >
                  <View
                    style={[
                      styles.categoryDot,
                      {
                        backgroundColor:
                          item.id === 'passable'
                            ? colors.green
                            : item.id === 'partial'
                              ? colors.amber
                              : colors.red,
                      },
                    ]}
                  />
                  <Text style={[styles.categoryTitle, selected && styles.categoryTitleSelected]}>
                    {item.title}
                  </Text>
                  <Text style={styles.categorySubtitle}>{item.subtitle}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Local da ocorrência</Text>
            <View style={styles.inputWrap}>
              <MapPin color={colors.blue} size={20} />
              <TextInput
                value={address}
                maxLength={300}
                onChangeText={setAddress}
                placeholder="Rua, número ou ponto de referência"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
            </View>
            <Pressable
              style={styles.locationButton}
              onPress={requestLocation}
              disabled={loadingLocation || submitting}
            >
              <LocateFixed color={colors.blue} size={17} />
              <Text style={styles.locationButtonText}>
                {loadingLocation ? 'Localizando...' : 'Usar minha localização atual'}
              </Text>
            </Pressable>
            <Pressable
              style={styles.locationButton}
              disabled={loadingLocation || submitting}
              onPress={() =>
                navigation.getParent()?.navigate('LocationPicker', {
                  target: 'new',
                  initialCoordinates: coordinates ?? undefined,
                })
              }
              accessibilityRole="button"
            >
              <MapPin color={colors.blue} size={17} />
              <Text style={styles.locationButtonText}>
                {coordinates ? 'Alterar ponto no mapa' : 'Escolher ponto no mapa'}
              </Text>
            </Pressable>
            <Text style={styles.counter}>
              {coordinates
                ? `${locationMode === 'gps' ? 'GPS' : 'Escolhido no mapa'} · ${coordinates.latitude.toFixed(6)}, ${coordinates.longitude.toFixed(6)}. O endereço é descritivo e não muda as coordenadas.`
                : 'Nenhuma posição escolhida. Localize a ocorrência pelo GPS ou pelo mapa.'}
            </Text>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Quando você observou?</Text>
            <View style={styles.inputWrap}>
              <Clock3 color={colors.blue} size={20} />
              <Text style={styles.staticInput}>
                {minutesAgo === 0 ? 'Agora mesmo' : `Há ${minutesAgo} minutos`}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[0, 15, 60].map((value) => (
                <Pressable
                  key={value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: minutesAgo === value }}
                  onPress={() => setMinutesAgo(value)}
                  style={{
                    padding: 12,
                    backgroundColor: minutesAgo === value ? colors.ice : colors.canvas,
                    borderRadius: 8,
                  }}
                >
                  <Text>{value === 0 ? 'Agora' : value === 60 ? 'Há 1 hora' : 'Há 15 min'}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Descreva o que está vendo</Text>
              <Text style={styles.counter}>{description.length}/240</Text>
            </View>
            <TextInput
              value={description}
              onChangeText={setDescription}
              maxLength={240}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              placeholder="Ex.: a água cobre metade da pista e os carros passam lentamente..."
              placeholderTextColor={colors.muted}
              style={styles.textarea}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>
              Foto <Text style={styles.optional}>(opcional)</Text>
            </Text>
            <Pressable style={styles.photoButton} onPress={pickPhoto}>
              {photoUri ? (
                <Image
                  source={{ uri: photoUri }}
                  style={{ width: 48, height: 48, borderRadius: 12 }}
                />
              ) : (
                <View style={styles.photoIcon}>
                  <Camera color={colors.blue} size={22} />
                </View>
              )}
              <View style={styles.photoCopy}>
                <Text style={styles.photoTitle}>
                  {photoUri ? 'Trocar foto' : 'Escolher uma foto'}
                </Text>
                <Text style={styles.photoSubtitle}>
                  A foto será compartilhada ao sincronizar (até 2 MB)
                </Text>
              </View>
            </Pressable>
            {photoUri ? (
              <Pressable
                onPress={() => setPhotoUri('')}
                style={{ paddingVertical: 12 }}
                accessibilityRole="button"
              >
                <Text style={{ color: colors.red }}>Remover foto</Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.notice}>
            <ShieldAlert color={colors.muted} size={19} />
            <Text style={styles.noticeText}>
              Não se coloque em risco para registrar uma ocorrência. Em emergência, ligue 199.
            </Text>
          </View>

          <PrimaryButton
            label="Enviar relato"
            onPress={submit}
            loading={submitting}
            disabled={loadingLocation}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: 120, backgroundColor: colors.canvas },
  offlineBanner: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    borderRadius: radii.md,
    backgroundColor: colors.amberSoft,
  },
  offlineText: { ...typography.small, color: '#77500A', flex: 1 },
  label: { ...typography.h3, color: colors.ink, marginBottom: spacing.md },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  counter: { ...typography.caption, color: colors.muted, marginBottom: spacing.md },
  categoryRow: { flexDirection: 'row', gap: spacing.sm },
  category: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  categorySelected: { borderColor: colors.blue, backgroundColor: colors.ice },
  categoryDot: { width: 10, height: 10, borderRadius: 5, marginBottom: spacing.sm },
  categoryTitle: { ...typography.small, color: colors.ink, fontWeight: '700' },
  categoryTitleSelected: { color: colors.blueDark },
  categorySubtitle: {
    ...typography.caption,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 2,
  },
  fieldGroup: { marginTop: spacing.xxl },
  inputWrap: {
    minHeight: 54,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  input: { flex: 1, minHeight: 52, ...typography.body, color: colors.ink },
  staticInput: { ...typography.body, color: colors.ink },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
  },
  locationButtonText: { ...typography.small, color: colors.blue, fontWeight: '700' },
  textarea: {
    minHeight: 128,
    padding: spacing.lg,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    ...typography.body,
    color: colors.ink,
  },
  optional: { color: colors.muted, fontWeight: '500' },
  photoButton: {
    minHeight: 80,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#9CCFE8',
  },
  photoIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.ice,
  },
  photoCopy: { flex: 1, marginLeft: spacing.md },
  photoTitle: { ...typography.h3, color: colors.blueDark },
  photoSubtitle: { ...typography.caption, color: colors.muted, marginTop: 2 },
  notice: {
    flexDirection: 'row',
    gap: spacing.md,
    marginVertical: spacing.xxl,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: '#EDF1F4',
  },
  noticeText: { ...typography.small, color: colors.muted, flex: 1 },
});
