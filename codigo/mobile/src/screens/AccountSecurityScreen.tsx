import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppHeader } from '../components/AppHeader';
import { PrimaryButton } from '../components/PrimaryButton';
import { useAppStore } from '../store/useAppStore';
import { confirmAction } from '../utils/confirmAction';
import { showMessage } from '../utils/showMessage';
import { colors, radii, spacing, typography } from '../theme';
import type { RootStackParamList } from '../types/navigation';

export function AccountSecurityScreen({
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'AccountSecurity'>) {
  const user = useAppStore((s) => s.user);
  const change = useAppStore((s) => s.changePassword);
  const recovery = useAppStore((s) => s.generateRecoveryCode);
  const remove = useAppStore((s) => s.deleteAccount);
  const [current, setCurrent] = useState('');
  const [section, setSection] = useState<'password' | 'recovery' | 'delete'>('password');
  const [recoveryPassword, setRecoveryPassword] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    try {
      await task();
      setCurrent('');
      setRecoveryPassword('');
      setDeletePassword('');
      setPassword('');
      setRepeat('');
    } catch (error) {
      showMessage(
        'Não foi possível concluir',
        error instanceof Error ? error.message : 'Tente novamente.',
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <AppHeader title="Conta e segurança" onBack={navigation.goBack} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.title}>Seu nome de usuário</Text>
          <Text selectable style={styles.username}>
            {user?.username ?? user?.name}
          </Text>
          <Text style={styles.text}>
            Use este nome para entrar. Editar o nome do perfil não muda seu acesso.
          </Text>
        </View>
        <View style={styles.choices}>
          {(
            [
              { id: 'password', label: 'Trocar senha' },
              { id: 'recovery', label: 'Recuperação' },
              { id: 'delete', label: 'Excluir conta' },
            ] as const
          ).map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: section === item.id }}
              disabled={busy}
              onPress={() => setSection(item.id)}
              style={[styles.choice, section === item.id && styles.selectedChoice]}
            >
              <Text style={styles.choiceText}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
        {section === 'password' && (
          <View style={styles.card}>
            <Text style={styles.title}>Trocar senha</Text>
            <Text style={styles.text}>
              As outras sessões serão encerradas. Uma nova chave de recuperação será exibida.
            </Text>
            <Text style={styles.label}>Senha atual</Text>
            <TextInput
              placeholderTextColor={colors.muted}
              accessibilityLabel="Senha atual para trocar a senha"
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="password"
              secureTextEntry
              maxLength={128}
              editable={!busy}
              value={current}
              onChangeText={setCurrent}
              style={styles.input}
              placeholder="Sua senha atual"
            />
            <Text style={styles.label}>Nova senha (8 a 128 caracteres)</Text>
            <TextInput
              placeholderTextColor={colors.muted}
              accessibilityLabel="Nova senha"
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="newPassword"
              secureTextEntry
              maxLength={128}
              editable={!busy}
              value={password}
              onChangeText={setPassword}
              style={styles.input}
              placeholder="Nova senha: mínimo de 8 caracteres"
            />
            <Text style={styles.label}>Repita a nova senha</Text>
            <TextInput
              placeholderTextColor={colors.muted}
              accessibilityLabel="Confirmar nova senha"
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              maxLength={128}
              editable={!busy}
              value={repeat}
              onChangeText={setRepeat}
              style={styles.input}
              placeholder="Repita a nova senha"
            />
            <PrimaryButton
              label="Salvar nova senha"
              loading={busy}
              onPress={() => {
                if (!current || password.length < 8 || password !== repeat) {
                  showMessage(
                    'Confira os campos',
                    'Informe a senha atual e repita a nova senha de pelo menos 8 caracteres.',
                  );
                  return;
                }
                void run(() => change(current, password));
              }}
            />
            {!!repeat && password !== repeat && (
              <Text style={styles.error}>As senhas precisam ser iguais.</Text>
            )}
          </View>
        )}
        {section === 'recovery' && (
          <View style={styles.card}>
            <Text style={styles.title}>Chave de recuperação</Text>
            <Text style={styles.text}>
              Se perdeu a chave anterior, gere outra usando sua senha atual. A antiga deixará de
              funcionar. Não há envio de senha por e-mail.
            </Text>
            <Text style={styles.label}>Senha atual</Text>
            <TextInput
              placeholderTextColor={colors.muted}
              accessibilityLabel="Senha atual para gerar a chave"
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="password"
              secureTextEntry
              maxLength={128}
              editable={!busy}
              value={recoveryPassword}
              onChangeText={setRecoveryPassword}
              style={styles.input}
              placeholder="Sua senha atual"
            />
            <PrimaryButton
              label="Gerar nova chave"
              variant="secondary"
              loading={busy}
              onPress={() => {
                if (!recoveryPassword) {
                  showMessage(
                    'Confirme sua identidade',
                    'Informe a senha atual neste campo para gerar uma nova chave.',
                  );
                  return;
                }
                void run(() => recovery(recoveryPassword));
              }}
            />
          </View>
        )}
        {section === 'delete' && (
          <View style={styles.card}>
            <Text style={styles.title}>Excluir minha conta</Text>
            <Text style={styles.text}>
              Seu perfil, fotos, relatos enviados e interações serão removidos do serviço. As
              pendências desta conta também serão apagadas deste aparelho. Outros aparelhos
              atualizam o conteúdo ao sincronizar. Cópias de segurança seguem a retenção informada
              na privacidade.
            </Text>
            <Text style={styles.label}>Senha atual para excluir</Text>
            <TextInput
              placeholderTextColor={colors.muted}
              accessibilityLabel="Senha atual para excluir a conta"
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="password"
              secureTextEntry
              maxLength={128}
              editable={!busy}
              value={deletePassword}
              onChangeText={setDeletePassword}
              style={styles.input}
              placeholder="Sua senha atual"
            />
            <Text style={styles.label}>Confirmação da exclusão</Text>
            <TextInput
              placeholderTextColor={colors.muted}
              accessibilityLabel="Digite EXCLUIR para confirmar"
              autoCapitalize="characters"
              autoCorrect={false}
              value={confirmation}
              onChangeText={(value) => setConfirmation(value.toLocaleUpperCase('pt-BR'))}
              maxLength={7}
              editable={!busy}
              style={styles.input}
              placeholder="Digite EXCLUIR"
            />
            <PrimaryButton
              label="Excluir minha conta definitivamente"
              variant="secondary"
              loading={busy}
              onPress={() =>
                void (async () => {
                  if (!deletePassword || confirmation.trim() !== 'EXCLUIR') {
                    showMessage(
                      'Confirme a exclusão',
                      'Preencha a senha atual no campo desta seção e digite EXCLUIR. Depois confirme o aviso final.',
                    );
                    return;
                  }
                  if (
                    await confirmAction(
                      'Excluir sua conta?',
                      'Esta ação remove seus dados e contribuições do serviço e não pode ser desfeita.',
                      'Excluir conta',
                    )
                  )
                    await run(() => remove(deletePassword, confirmation.trim()));
                })()
              }
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: spacing.lg, gap: spacing.lg },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  choice: {
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  selectedChoice: { borderColor: colors.blue, backgroundColor: colors.ice },
  choiceText: { ...typography.small, color: colors.blueDark, fontWeight: '700' },
  card: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: radii.lg,
    gap: spacing.md,
  },
  title: { ...typography.h3, color: colors.ink },
  label: { ...typography.h3, color: colors.ink },
  username: { ...typography.body, color: colors.blue },
  text: { ...typography.body, color: colors.muted },
  input: {
    ...typography.body,
    color: colors.ink,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: radii.md,
  },
  error: { ...typography.small, color: colors.red },
});
