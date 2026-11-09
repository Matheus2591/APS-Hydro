import { AppImage as Image } from '../components/AppImage';
import { showMessage } from '../utils/showMessage';
import { selectPhoto } from '../services/selectPhoto';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { Eye, EyeOff, LockKeyhole, MapPin, Phone, Settings2, UserRound } from 'lucide-react-native';
import { useState } from 'react';
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

import { PrimaryButton } from '../components/PrimaryButton';
import { useAppStore } from '../store/useAppStore';
import { colors, radii, spacing, typography } from '../theme';

type Mode = 'login' | 'register' | 'recover';

export function AuthScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Auth'>) {
  const login = useAppStore((state) => state.login);
  const register = useAppStore((state) => state.register);
  const recover = useAppStore((state) => state.recoverAccount);
  const syncError = useAppStore((state) => state.syncError);
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [profilePhotoUri, setProfilePhotoUri] = useState('');
  const [loading, setLoading] = useState(false);

  const pickPhoto = async () => {
    try {
      const uri = await selectPhoto(true);
      if (uri) setProfilePhotoUri(uri);
    } catch (error) {
      showMessage(
        'Não foi possível escolher a foto',
        error instanceof Error ? error.message : 'Tente novamente.',
      );
    }
  };

  const submit = async () => {
    if (!name.trim() || password.length < (mode === 'login' ? 1 : 8)) {
      showMessage(
        'Revise seus dados',
        'Informe nome e senha. No cadastro, use pelo menos 8 caracteres.',
      );
      return;
    }
    if (mode !== 'login' && password !== repeat) {
      showMessage('Confira a senha', 'As duas senhas precisam ser iguais.');
      return;
    }
    if (mode === 'recover') {
      if (!recoveryCode.trim()) {
        showMessage(
          'Chave de recuperação',
          'Informe a chave que você guardou ao criar ou proteger sua conta.',
        );
        return;
      }
      setLoading(true);
      try {
        await recover(name, recoveryCode, password);
      } catch (error) {
        showMessage(
          'Não foi possível recuperar',
          error instanceof Error ? error.message : 'Confira os dados e tente novamente.',
        );
      } finally {
        setLoading(false);
      }
      return;
    }
    if (mode === 'login') {
      setLoading(true);
      try {
        const valid = await login(name, password);
        if (!valid) showMessage('Não foi possível entrar', 'Confira o nome e a senha informados.');
      } catch (error) {
        showMessage(
          'Não foi possível entrar',
          error instanceof Error ? error.message : 'Não foi possível entrar. Confira a conexão.',
        );
      } finally {
        setLoading(false);
      }
      return;
    }
    setLoading(true);
    try {
      const created = await register({
        name,
        password,
        phone,
        address,
        profilePhotoUri: profilePhotoUri || undefined,
      });
      if (!created) showMessage('Nome já cadastrado', 'Escolha outro nome para criar sua conta.');
    } catch (error) {
      showMessage(
        'Não foi possível cadastrar',
        error instanceof Error ? error.message : 'Confira o armazenamento do aparelho.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.brandMark}>
            <Text style={styles.brandMarkText}>HP</Text>
          </View>
          <Text style={styles.eyebrow}>HYDRO PULSE</Text>
          {syncError ? (
            <Text
              accessibilityRole="alert"
              style={{ ...typography.small, color: colors.red, marginTop: spacing.md }}
            >
              {syncError}
            </Text>
          ) : null}
          <Text style={styles.title}>
            {mode === 'login'
              ? 'Entre para colaborar'
              : mode === 'register'
                ? 'Crie sua conta'
                : 'Recupere sua conta'}
          </Text>
          <Text style={styles.subtitle}>
            {mode === 'login'
              ? 'Acompanhe relatos, confirme ocorrências e ajude sua cidade.'
              : mode === 'register'
                ? 'Escolha um usuário e uma senha. Telefone, endereço e foto são opcionais.'
                : 'Use sua chave de recuperação e escolha uma nova senha.'}
          </Text>

          <View style={styles.switcher}>
            <Pressable
              style={[styles.switchButton, mode === 'login' && styles.switchButtonActive]}
              onPress={() => setMode('login')}
            >
              <Text style={[styles.switchText, mode === 'login' && styles.switchTextActive]}>
                Entrar
              </Text>
            </Pressable>
            <Pressable
              style={[styles.switchButton, mode === 'register' && styles.switchButtonActive]}
              onPress={() => setMode('register')}
            >
              <Text style={[styles.switchText, mode === 'register' && styles.switchTextActive]}>
                Criar conta
              </Text>
            </Pressable>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Nome de usuário</Text>
            <View style={styles.inputWrap}>
              <UserRound color={colors.blue} size={19} />
              <TextInput
                value={name}
                maxLength={100}
                onChangeText={setName}
                placeholder="Seu nome de usuário para entrar"
                placeholderTextColor={colors.muted}
                style={styles.input}
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel="Nome de usuário"
              />
            </View>

            {mode === 'recover' && (
              <>
                <Text style={styles.label}>Chave de recuperação</Text>
                <View style={styles.inputWrap}>
                  <TextInput
                    placeholderTextColor={colors.muted}
                    value={recoveryCode}
                    onChangeText={setRecoveryCode}
                    maxLength={100}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    accessibilityLabel="Chave de recuperação"
                    placeholder="Cole a chave que você guardou"
                    style={styles.input}
                  />
                </View>
              </>
            )}
            <Text style={styles.label}>{mode === 'recover' ? 'Nova senha' : 'Senha'}</Text>
            <View style={styles.inputWrap}>
              <LockKeyhole color={colors.blue} size={19} />
              <TextInput
                value={password}
                maxLength={128}
                onChangeText={setPassword}
                placeholder={mode !== 'login' ? 'Mínimo de 8 caracteres' : 'Sua senha'}
                placeholderTextColor={colors.muted}
                style={styles.input}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel={mode === 'recover' ? 'Nova senha' : 'Senha'}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                onPress={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff color={colors.blue} size={20} />
                ) : (
                  <Eye color={colors.blue} size={20} />
                )}
              </Pressable>
            </View>

            {mode !== 'login' && (
              <>
                <Text style={styles.label}>Confirme a senha</Text>
                <View style={styles.inputWrap}>
                  <LockKeyhole color={colors.blue} size={19} />
                  <TextInput
                    value={repeat}
                    maxLength={128}
                    onChangeText={setRepeat}
                    placeholder="Digite a senha novamente"
                    placeholderTextColor={colors.muted}
                    style={styles.input}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    accessibilityLabel="Confirme a senha"
                  />
                </View>
              </>
            )}

            {mode === 'register' ? (
              <>
                <Text style={styles.label}>Telefone (opcional)</Text>
                <View style={styles.inputWrap}>
                  <Phone color={colors.blue} size={19} />
                  <TextInput
                    value={phone}
                    maxLength={30}
                    onChangeText={setPhone}
                    placeholder="(13) 99999-9999"
                    placeholderTextColor={colors.muted}
                    style={styles.input}
                    keyboardType="phone-pad"
                  />
                </View>

                <Text style={styles.label}>Endereço (opcional)</Text>
                <View style={styles.inputWrap}>
                  <MapPin color={colors.blue} size={19} />
                  <TextInput
                    value={address}
                    maxLength={300}
                    onChangeText={setAddress}
                    placeholder="Rua, número e bairro"
                    placeholderTextColor={colors.muted}
                    style={styles.input}
                  />
                </View>

                <Text style={styles.label}>
                  Foto de perfil <Text style={styles.optional}>(opcional)</Text>
                </Text>
                <Pressable style={styles.photoButton} onPress={pickPhoto}>
                  {profilePhotoUri ? (
                    <Image source={{ uri: profilePhotoUri }} style={styles.photo} />
                  ) : (
                    <View style={styles.photoPlaceholder}>
                      <UserRound color={colors.blue} size={24} />
                    </View>
                  )}
                  <View style={styles.photoCopy}>
                    <Text style={styles.photoTitle}>
                      {profilePhotoUri ? 'Trocar foto' : 'Escolher foto'}
                    </Text>
                    <Text style={styles.photoSubtitle}>
                      Você pode adicionar uma imagem agora ou depois
                    </Text>
                  </View>
                </Pressable>
              </>
            ) : null}
          </View>

          <PrimaryButton
            label={
              mode === 'login'
                ? 'Entrar'
                : mode === 'register'
                  ? 'Criar minha conta'
                  : 'Recuperar e entrar'
            }
            onPress={submit}
            loading={loading}
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setMode(mode === 'recover' ? 'login' : 'recover');
              setPassword('');
              setRepeat('');
            }}
            style={{ padding: spacing.lg, alignItems: 'center' }}
          >
            <Text style={{ color: colors.blue, ...typography.body }}>
              {mode === 'recover' ? 'Voltar para entrar' : 'Esqueci minha senha'}
            </Text>
          </Pressable>
          <PrimaryButton
            label="Consultar chuva sem entrar"
            variant="secondary"
            onPress={() => navigation.navigate('OfficialData')}
          />
          <Text style={styles.privacy}>
            A conta é compartilhada entre seus aparelhos. A senha é protegida no servidor e não fica
            salva no aplicativo.
          </Text>
          {mode === 'login' && (
            <Pressable
              onPress={() => navigation.navigate('Connection')}
              accessibilityRole="button"
              accessibilityLabel="Configurar conexão"
              disabled={loading}
              style={styles.connectionLink}
            >
              <Settings2 color={colors.blue} size={16} />
              <Text style={styles.connectionLinkText}>Configurar conexão</Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  content: { padding: spacing.xl, paddingBottom: spacing.xxxl },
  brandMark: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.navy,
  },
  brandMarkText: { ...typography.h2, color: colors.sky },
  eyebrow: {
    ...typography.caption,
    color: colors.blue,
    letterSpacing: 1.4,
    marginTop: spacing.xxl,
  },
  title: { ...typography.display, color: colors.ink, marginTop: spacing.xs },
  subtitle: { ...typography.body, color: colors.muted, marginTop: spacing.sm },
  switcher: {
    flexDirection: 'row',
    padding: 4,
    marginTop: spacing.xxl,
    borderRadius: radii.md,
    backgroundColor: '#E6EEF2',
  },
  switchButton: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderRadius: radii.sm,
  },
  switchButtonActive: { backgroundColor: colors.surface },
  switchText: { ...typography.small, color: colors.muted },
  switchTextActive: { color: colors.blueDark, fontWeight: '700' },
  form: { marginTop: spacing.xl, marginBottom: spacing.xxl },
  label: { ...typography.h3, color: colors.ink, marginTop: spacing.lg, marginBottom: spacing.sm },
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
  photoButton: {
    minHeight: 78,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#9CCFE8',
  },
  photoPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.ice,
  },
  photo: { width: 50, height: 50, borderRadius: 17 },
  photoCopy: { flex: 1, marginLeft: spacing.md },
  photoTitle: { ...typography.h3, color: colors.blueDark },
  photoSubtitle: { ...typography.caption, color: colors.muted, marginTop: 2 },
  optional: { color: colors.muted, fontWeight: '500' },
  privacy: {
    ...typography.caption,
    color: colors.muted,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  connectionLink: {
    minHeight: 48,
    marginTop: spacing.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  connectionLinkText: { ...typography.small, color: colors.blue },
});
