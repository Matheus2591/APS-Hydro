import { showMessage } from '../utils/showMessage';
import { selectPhoto } from '../services/selectPhoto';
import { AppImage } from '../components/AppImage';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
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
import { colors, radii, spacing, typography } from '../theme';
import type { ReportCategory } from '../types/domain';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'ReportEdit'>;
const categories: Array<{ id: ReportCategory; title: string; subtitle: string }> = [
  { id: 'passable', title: 'Leve', subtitle: 'Via transitável' },
  { id: 'partial', title: 'Moderado', subtitle: 'Passagem parcial' },
  { id: 'blocked', title: 'Grave', subtitle: 'Via bloqueada' },
];

export function ReportEditScreen({ navigation, route }: Props) {
  const report = useAppStore((state) =>
    state.reports.find((item) => item.id === route.params.reportId),
  );
  const updateReport = useAppStore((state) => state.updateReport);
  const [category, setCategory] = useState<ReportCategory>(report?.category ?? 'partial');
  const [address, setAddress] = useState(report?.address ?? '');
  const [description, setDescription] = useState(report?.description ?? '');
  const [photoUri, setPhotoUri] = useState(report?.photoUri);
  const [loading, setLoading] = useState(false);
  const [coordinates, setCoordinates] = useState(report?.coordinates);
  const [locationMode, setLocationMode] = useState(report?.locationMode);
  useEffect(() => {
    const selected = route.params.selectedLocation;
    if (!selected) return;
    setCoordinates(selected.coordinates);
    setLocationMode('map');
    navigation.setParams({ selectedLocation: undefined });
  }, [route.params.selectedLocation, navigation]);

  if (!report)
    return (
      <SafeAreaView style={styles.safe}>
        <AppHeader title="Relato indisponível" onBack={navigation.goBack} />
        <Text style={{ padding: 24 }}>Sincronize na aba Atividade para procurar este relato.</Text>
      </SafeAreaView>
    );

  const submit = async () => {
    if (!coordinates || !['gps', 'map'].includes(locationMode ?? '')) {
      showMessage(
        'Escolha o local no mapa',
        'Este relato ainda não tem um ponto confirmado. Escolha a posição antes de salvar.',
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
    setLoading(true);
    try {
      const updated = await updateReport(report.id, {
        category,
        address: address.trim(),
        description: description.trim(),
        coordinates,
        locationMode,
        observedAt: report.observedAt,
        photoUri,
      });
      setLoading(false);
      if (!updated) {
        showMessage('Não foi possível editar', 'Apenas quem criou o relato pode alterá-lo.');
        return;
      }
      navigation.goBack();
    } catch (error) {
      showMessage(
        'Não foi possível editar',
        error instanceof Error ? error.message : 'Confira a conexão e tente novamente.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <AppHeader
        title="Editar relato"
        subtitle="Atualize as informações observadas"
        onBack={navigation.goBack}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
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
            <PrimaryButton
              label="Escolher ponto no mapa"
              variant="secondary"
              onPress={() =>
                navigation.navigate('LocationPicker', {
                  target: 'edit',
                  reportId: report.id,
                  initialCoordinates: coordinates,
                })
              }
            />
            <Text style={styles.counter}>
              {coordinates && (locationMode === 'gps' || locationMode === 'map')
                ? `Latitude ${coordinates.latitude.toFixed(6)} · Longitude ${coordinates.longitude.toFixed(6)}`
                : 'Sem localização confirmada.'}
            </Text>
            <TextInput
              value={address}
              maxLength={300}
              onChangeText={setAddress}
              placeholder="Rua, número ou ponto de referência"
              placeholderTextColor={colors.muted}
              style={styles.input}
            />
          </View>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Foto do relato</Text>
            {photoUri && (
              <AppImage
                source={{ uri: photoUri }}
                style={{ width: 120, height: 100, borderRadius: 12 }}
              />
            )}
            <PrimaryButton
              label="Escolher ou trocar foto"
              variant="secondary"
              onPress={() =>
                void selectPhoto()
                  .then((uri) => {
                    if (uri) setPhotoUri(uri);
                  })
                  .catch((error) => showMessage('Foto indisponível', error.message))
              }
            />
            {photoUri && (
              <PrimaryButton
                label="Remover foto"
                variant="secondary"
                onPress={() => setPhotoUri(undefined)}
              />
            )}
          </View>
          <View style={styles.fieldGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Descrição</Text>
              <Text style={styles.counter}>{description.length}/240</Text>
            </View>
            <TextInput
              value={description}
              onChangeText={setDescription}
              maxLength={240}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              placeholder="Descreva o que está acontecendo..."
              placeholderTextColor={colors.muted}
              style={styles.textarea}
            />
          </View>
          <View style={styles.notice}>
            <Text style={styles.noticeText}>
              A edição mantém as confirmações já recebidas e registra os dados atualizados.
            </Text>
          </View>
          <PrimaryButton label="Salvar alterações" onPress={submit} loading={loading} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: 120, backgroundColor: colors.canvas },
  label: { ...typography.h3, color: colors.ink, marginBottom: spacing.md },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  counter: { ...typography.caption, color: colors.muted },
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
  input: {
    minHeight: 54,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    ...typography.body,
    color: colors.ink,
  },
  textarea: {
    minHeight: 140,
    padding: spacing.lg,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    ...typography.body,
    color: colors.ink,
  },
  notice: {
    marginVertical: spacing.xxl,
    padding: spacing.lg,
    borderRadius: radii.md,
    backgroundColor: colors.ice,
  },
  noticeText: { ...typography.small, color: colors.blueDark },
});
