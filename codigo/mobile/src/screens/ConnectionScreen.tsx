import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from '../components/AppHeader';
import { PrimaryButton } from '../components/PrimaryButton';
import { isConnectionSetupCode } from '../config/connectionSetup';
import { useAppStore } from '../store/useAppStore';
import { colors, spacing, typography, radii } from '../theme';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Connection'>;
export function ConnectionScreen({ navigation }: Props) {
  const user = useAppStore((state) => state.user);
  const administrator = user?.role === 'moderator';
  const currentUrl = useAppStore((state) => state.apiUrl);
  const saveApiUrl = useAppStore((state) => state.saveApiUrl);
  const busy = useAppStore((state) => state.configuringServer || state.syncing);
  const online = useAppStore((state) => state.isOnline);
  const [address, setAddress] = useState(currentUrl);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [setupCode, setSetupCode] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [codeError, setCodeError] = useState('');
  const unlock = () => {
    if (user || !isConnectionSetupCode(setupCode)) {
      setCodeError('Código incorreto. Confira com o responsável pelo serviço.');
      return;
    }
    setCodeError('');
    setUnlocked(true);
  };
  const save = async () => {
    setLoading(true);
    setMessage('');
    try {
      await saveApiUrl(address, administrator ? undefined : setupCode);
      const error = useAppStore.getState().syncError;
      setMessage(error ? `Endereço salvo. ${error}` : 'Serviço verificado. Dados sincronizados.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível verificar o servidor.');
    } finally {
      setLoading(false);
    }
  };
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <AppHeader title="Conexão do serviço" onBack={navigation.goBack} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {!administrator && (!unlocked || !!user) ? (
          <>
            <Text style={styles.title}>Liberar configuração</Text>
            <Text style={styles.text}>
              Informe o código fornecido pelo responsável pelo serviço para configurar a conexão
              deste aparelho. Sua conta e suas permissões continuam sendo verificadas ao entrar.
            </Text>
            <Text style={styles.label}>Código de configuração</Text>
            <TextInput
              value={setupCode}
              onChangeText={(value) => {
                setSetupCode(value.replace(/\D/g, ''));
                setCodeError('');
              }}
              placeholder="Digite o código de 6 dígitos"
              placeholderTextColor={colors.muted}
              keyboardType="number-pad"
              maxLength={6}
              secureTextEntry
              autoComplete="off"
              autoCorrect={false}
              autoCapitalize="none"
              onSubmitEditing={unlock}
              accessibilityLabel="Código de configuração"
              style={styles.input}
            />
            {!!codeError && (
              <Text accessibilityRole="alert" style={[styles.text, { color: colors.red }]}>
                {codeError}
              </Text>
            )}
            <PrimaryButton
              label="Liberar configuração"
              onPress={unlock}
              disabled={setupCode.length !== 6 || !!user}
            />
            <Text style={styles.text}>
              A liberação vale somente enquanto esta tela estiver aberta.
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.title}>
              {administrator ? 'Administração do serviço' : 'Configurar este aparelho'}
            </Text>
            <Text style={styles.text}>
              {administrator
                ? 'Defina o endereço do serviço responsável por sincronizar os relatos.'
                : 'Cole a URL HTTPS fornecida pelo responsável. Vamos verificar o serviço antes de salvar; depois, volte para entrar na sua conta.'}
            </Text>
            <Text style={styles.label}>URL do servidor</Text>
            <TextInput
              placeholderTextColor={colors.muted}
              value={address}
              onChangeText={(value) => {
                setAddress(value);
                setMessage('');
              }}
              placeholder="https://api.seudominio.com"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              maxLength={500}
              style={styles.input}
              accessibilityLabel="URL da API Hydro Pulse"
            />
            <Text style={styles.text}>
              Use somente o endereço base, sem /health ou /v1 ao final.
            </Text>
            <PrimaryButton
              label="Testar e salvar conexão"
              onPress={save}
              loading={loading || busy}
              disabled={!online || !address.trim()}
            />
            {!online && (
              <Text style={styles.text}>
                Ative o Wi-Fi ou os dados móveis do aparelho para verificar a conexão.
              </Text>
            )}
            {!!message && (
              <View style={styles.notice} accessibilityLiveRegion="polite">
                <Text style={styles.text}>{message}</Text>
              </View>
            )}
            {!administrator && (
              <PrimaryButton
                label="Voltar para entrar"
                variant="secondary"
                onPress={() => navigation.goBack()}
              />
            )}
            <Text style={styles.text}>
              Os relatos só aparecem como enviados após confirmação da API. Se o servidor ficar
              indisponível, os registros permanecem no aparelho para reenvio.
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: spacing.xl, gap: spacing.lg },
  title: { ...typography.h2, color: colors.ink },
  label: { ...typography.h3, color: colors.ink },
  text: { ...typography.body, color: colors.muted },
  input: {
    ...typography.body,
    color: colors.ink,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    padding: spacing.lg,
    minHeight: 56,
  },
  notice: { padding: spacing.lg, borderRadius: radii.md, backgroundColor: colors.ice },
});
