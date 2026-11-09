import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppHeader } from '../components/AppHeader';
import { PrimaryButton } from '../components/PrimaryButton';
import { AppImage } from '../components/AppImage';
import { useAccountApi } from '../services/api/useAccountApi';
import { useAppStore } from '../store/useAppStore';
import { confirmAction } from '../utils/confirmAction';
import { showMessage } from '../utils/showMessage';
import { isModerationItem } from '../utils/validation';
import type { ModerationItem } from '../types/domain';
import type { RootStackParamList } from '../types/navigation';
import { colors, radii, spacing, typography } from '../theme';

export function ModerationScreen({
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'Moderation'>) {
  const api = useAccountApi();
  const moderate = useAppStore((s) => s.moderateDispute);
  const [items, setItems] = useState<ModerationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [action, setAction] = useState<'keep' | 'hide'>('keep');
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.moderation();
      if (!Array.isArray(data.items) || !data.items.every(isModerationItem))
        throw new Error('A lista recebida é inválida.');
      setItems(data.items);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível carregar.');
    } finally {
      setLoading(false);
    }
  }, [api]);
  useEffect(() => {
    void load();
  }, [load]);
  const decide = async (id: string) => {
    if (
      !(await confirmAction(
        'Concluir análise?',
        `${action === 'hide' ? 'Ocultar o relato do mapa' : 'Manter o relato disponível'}. A decisão e a justificativa serão comunicadas às pessoas envolvidas.`,
        'Registrar decisão',
      ))
    )
      return;
    setLoading(true);
    try {
      await moderate(id, action, note);
      setSelected(null);
      setNote('');
      await load();
      showMessage(
        'Análise registrada',
        'As pessoas envolvidas receberão a decisão ao sincronizar.',
      );
    } catch (cause) {
      showMessage(
        'Não foi possível concluir',
        cause instanceof Error ? cause.message : 'Tente novamente.',
      );
    } finally {
      setLoading(false);
    }
  };
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <AppHeader title="Analisar contestações" onBack={navigation.goBack} />
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.text}>
              Área da equipe responsável. Confira o relato e a justificativa antes de decidir. A
              análise de conteúdo não equivale a confirmação de alagamento por autoridade.
            </Text>
            <PrimaryButton
              label="Atualizar lista"
              loading={loading}
              variant="secondary"
              onPress={() => void load()}
            />
            {!!error && (
              <Text accessibilityLiveRegion="polite" style={styles.error}>
                {error}
              </Text>
            )}
          </View>
        }
        ListEmptyComponent={
          !loading ? (
            <Text style={styles.text}>Nenhuma contestação disponível para análise.</Text>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.title}>{item.address}</Text>
            <Text style={styles.text}>Relato: {item.description}</Text>
            <Text style={styles.text}>Divergência: {item.justification}</Text>
            <Text style={styles.status}>
              {item.reviewStatus === 'pending'
                ? 'Aguardando análise'
                : item.reviewStatus === 'hidden'
                  ? 'Analisado: ocultado'
                  : 'Analisado: mantido'}
            </Text>
            {!!item.moderationNote && (
              <Text style={styles.text}>Decisão anterior: {item.moderationNote}</Text>
            )}
            {selected === item.id ? (
              <>
                {item.reportPhotoUri && item.reviewStatus !== 'hidden' && (
                  <AppImage source={{ uri: item.reportPhotoUri }} style={styles.photo} />
                )}
                {!!item.evidencePhotoUri && (
                  <AppImage source={{ uri: item.evidencePhotoUri }} style={styles.photo} />
                )}
                <View style={styles.choices}>
                  {(['keep', 'hide'] as const).map((value) => (
                    <Pressable
                      key={value}
                      disabled={loading}
                      accessibilityRole="button"
                      accessibilityState={{ selected: action === value }}
                      onPress={() => setAction(value)}
                      style={styles.choice}
                    >
                      <Text style={styles.status}>
                        {action === value ? '✓ ' : ''}
                        {value === 'keep' ? 'Manter relato' : 'Ocultar relato'}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <TextInput
                  placeholderTextColor={colors.muted}
                  accessibilityLabel="Justificativa da decisão"
                  value={note}
                  editable={!loading}
                  onChangeText={setNote}
                  maxLength={300}
                  multiline
                  placeholder="Explique a decisão (mínimo de 10 caracteres)"
                  style={styles.input}
                />
                <PrimaryButton
                  label="Concluir análise"
                  loading={loading}
                  disabled={note.trim().length < 10}
                  onPress={() => void decide(item.id)}
                />
                <PrimaryButton
                  label="Fechar análise"
                  variant="secondary"
                  disabled={loading}
                  onPress={() => setSelected(null)}
                />
              </>
            ) : (
              <PrimaryButton
                label={item.reviewStatus === 'pending' ? 'Analisar' : 'Revisar decisão'}
                variant="secondary"
                disabled={loading}
                onPress={() => {
                  setSelected(item.id);
                  setAction('keep');
                  setNote('');
                }}
              />
            )}
          </View>
        )}
      />
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: spacing.lg, gap: spacing.lg },
  header: { gap: spacing.lg },
  card: {
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    gap: spacing.md,
  },
  title: { ...typography.h3, color: colors.ink },
  text: { ...typography.body, color: colors.muted },
  status: { ...typography.small, color: colors.blue },
  error: { ...typography.body, color: colors.red },
  photo: { width: '100%', height: 180, borderRadius: radii.md },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  choice: { padding: spacing.md, backgroundColor: colors.ice, borderRadius: radii.md },
  input: {
    ...typography.body,
    minHeight: 110,
    textAlignVertical: 'top',
    color: colors.ink,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    padding: spacing.lg,
  },
});
