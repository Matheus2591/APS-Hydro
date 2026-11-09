import { AppImage as Image } from '../components/AppImage';
import { showMessage } from '../utils/showMessage';
import { selectPhoto } from '../services/selectPhoto';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MapPin, Phone, UserRound, X } from 'lucide-react-native';
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

import { AppHeader } from '../components/AppHeader';
import { PrimaryButton } from '../components/PrimaryButton';
import { useAppStore } from '../store/useAppStore';
import { colors, radii, spacing, typography } from '../theme';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'ProfileEdit'>;

export function ProfileEditScreen({ navigation }: Props) {
  const user = useAppStore((state) => state.user);
  const updateProfile = useAppStore((state) => state.updateProfile);
  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [address, setAddress] = useState(user?.address ?? '');
  const [profilePhotoUri, setProfilePhotoUri] = useState(user?.profilePhotoUri ?? '');
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
    if (!name.trim()) {
      showMessage('Revise seus dados', 'Informe o nome que deseja mostrar no perfil.');
      return;
    }

    setLoading(true);
    try {
      const updated = await updateProfile({
        name,
        phone,
        address,
        profilePhotoUri: profilePhotoUri || undefined,
      });
      setLoading(false);

      if (!updated) {
        showMessage('Nome já cadastrado', 'Escolha outro nome para atualizar seu perfil.');
        return;
      }
      navigation.goBack();
    } catch (error) {
      showMessage(
        'Não foi possível salvar',
        error instanceof Error ? error.message : 'Confira o armazenamento do aparelho.',
      );
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <AppHeader
        title="Editar perfil"
        subtitle="Atualize seus dados pessoais"
        onBack={navigation.goBack}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.optional}>
            Seu nome de acesso continua sendo {user.username ?? user.name}.
          </Text>
          <Text style={styles.label}>Nome</Text>
          <View style={styles.inputWrap}>
            <UserRound color={colors.blue} size={19} />
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Seu nome"
              placeholderTextColor={colors.muted}
              style={styles.input}
              autoCapitalize="words"
              maxLength={80}
              accessibilityLabel="Nome exibido no perfil"
            />
          </View>

          <Text style={styles.label}>Telefone (opcional)</Text>
          <View style={styles.inputWrap}>
            <Phone color={colors.blue} size={19} />
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="(13) 99999-9999"
              placeholderTextColor={colors.muted}
              style={styles.input}
              keyboardType="phone-pad"
              maxLength={30}
              accessibilityLabel="Telefone opcional"
            />
          </View>

          <Text style={styles.label}>Endereço (opcional)</Text>
          <View style={styles.inputWrap}>
            <MapPin color={colors.blue} size={19} />
            <TextInput
              value={address}
              onChangeText={setAddress}
              placeholder="Rua, número e bairro"
              maxLength={300}
              accessibilityLabel="Endereço opcional"
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
                {profilePhotoUri ? 'Trocar foto' : 'Adicionar foto'}
              </Text>
              <Text style={styles.photoSubtitle}>Seu perfil pode ficar sem uma imagem</Text>
            </View>
          </Pressable>

          {profilePhotoUri ? (
            <Pressable style={styles.removePhotoButton} onPress={() => setProfilePhotoUri('')}>
              <X color={colors.red} size={17} />
              <Text style={styles.removePhotoText}>Remover foto</Text>
            </Pressable>
          ) : null}

          <View style={styles.submit}>
            <PrimaryButton label="Salvar alterações" onPress={submit} loading={loading} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    padding: spacing.xl,
    paddingBottom: spacing.xxxl,
    backgroundColor: colors.canvas,
  },
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
  optional: { color: colors.muted, fontWeight: '500' },
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
  removePhotoButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
  },
  removePhotoText: { ...typography.small, color: colors.red, fontWeight: '700' },
  submit: { marginTop: spacing.xxl },
});
