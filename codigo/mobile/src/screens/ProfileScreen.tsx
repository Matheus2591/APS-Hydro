import { AppImage as Image } from '../components/AppImage';
import { useBottomTabBarHeight, type BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import {
  Bell,
  ChevronRight,
  CircleHelp,
  Database,
  Link,
  LogOut,
  MapPinned,
  Pencil,
  ShieldCheck,
} from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from '../components/AppHeader';
import { colors, radii, spacing, typography } from '../theme';
import { useAppStore } from '../store/useAppStore';
import type { MainTabParamList } from '../types/navigation';
import { showMessage } from '../utils/showMessage';

type Props = BottomTabScreenProps<MainTabParamList, 'Perfil'>;
type MenuItem = { label: string; detail: string; icon: typeof Bell; onPress: () => void };

function MenuGroup({ title, items }: { title: string; items: MenuItem[] }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{title}</Text>
      <View style={styles.menu}>
        {items.map(({ label, detail, icon: Icon, onPress }, index) => (
          <Pressable
            key={label}
            style={({ pressed }) => [
              styles.menuItem,
              index < items.length - 1 && styles.menuDivider,
              pressed && styles.pressed,
            ]}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={label}
          >
            <View style={styles.menuIcon}>
              <Icon color={colors.blue} size={20} />
            </View>
            <View style={styles.menuCopy}>
              <Text style={styles.menuTitle}>{label}</Text>
              <Text style={styles.menuDetail}>{detail}</Text>
            </View>
            <ChevronRight color={colors.muted} size={18} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function ProfileScreen({ navigation }: Props) {
  const user = useAppStore((state) => state.user);
  const logout = useAppStore((state) => state.logout);
  const tabHeight = useBottomTabBarHeight();
  const open = (
    screen:
      | 'ProfileEdit'
      | 'AccountSecurity'
      | 'Notifications'
      | 'OfficialData'
      | 'Moderation'
      | 'Connection',
  ) => navigation.getParent()?.navigate(screen);
  const section = (value: 'location' | 'privacy' | 'help') =>
    navigation.getParent()?.navigate('ProfileSection', { section: value });
  const initials =
    (user?.name ?? '')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0] ?? '')
      .join('')
      .toUpperCase() || '?';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppHeader title="Meu perfil" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: tabHeight + spacing.xl }]}
      >
        <View style={styles.profileCard}>
          {user?.profilePhotoUri ? (
            <Image source={{ uri: user.profilePhotoUri }} style={styles.avatar} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          )}
          <View style={styles.profileCopy}>
            <Text style={styles.profileTitle}>{user?.name ?? 'Minha conta'}</Text>
            <Text style={styles.profileSubtitle}>@{user?.username ?? user?.name ?? 'usuário'}</Text>
            {user?.role === 'moderator' && <Text style={styles.role}>Administrador</Text>}
          </View>
        </View>

        <MenuGroup
          title="Minha conta"
          items={[
            {
              label: 'Editar perfil',
              detail: 'Nome, foto e informações pessoais',
              icon: Pencil,
              onPress: () => open('ProfileEdit'),
            },
            {
              label: 'Conta e segurança',
              detail: 'Senha, recuperação e exclusão',
              icon: ShieldCheck,
              onPress: () => open('AccountSecurity'),
            },
            {
              label: 'Notificações',
              detail: 'Novidades sobre seus relatos',
              icon: Bell,
              onPress: () => open('Notifications'),
            },
          ]}
        />

        <MenuGroup
          title="Informações"
          items={[
            {
              label: 'Dados de chuva',
              detail: 'Medições e fonte oficial de Santos',
              icon: Database,
              onPress: () => open('OfficialData'),
            },
            {
              label: 'Localização',
              detail: 'Santos, SP · GPS e ponto no mapa',
              icon: MapPinned,
              onPress: () => section('location'),
            },
            {
              label: 'Privacidade',
              detail: 'Seus dados e as permissões do app',
              icon: ShieldCheck,
              onPress: () => section('privacy'),
            },
            {
              label: 'Ajuda',
              detail: 'Orientações para usar o Hydro Pulse',
              icon: CircleHelp,
              onPress: () => section('help'),
            },
          ]}
        />

        {user?.role === 'moderator' && (
          <MenuGroup
            title="Administração"
            items={[
              {
                label: 'Analisar contestações',
                detail: 'Revisar conteúdo sinalizado',
                icon: ShieldCheck,
                onPress: () => open('Moderation'),
              },
              {
                label: 'Conexão do serviço',
                detail: 'Endereço e sincronização',
                icon: Link,
                onPress: () => open('Connection'),
              },
            ]}
          />
        )}

        <Pressable
          style={({ pressed }) => [styles.logoutButton, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Sair da conta"
          onPress={() =>
            void logout().catch(() =>
              showMessage('Não foi possível sair', 'Tente novamente. Seus dados continuam salvos.'),
            )
          }
        >
          <LogOut color={colors.red} size={20} />
          <Text style={styles.logoutText}>Sair da conta</Text>
        </Pressable>
        <Text style={styles.version}>Hydro Pulse · versão 3.0.4</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  content: { padding: spacing.lg, backgroundColor: colors.canvas },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.navy,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.blue,
  },
  avatarText: { ...typography.h1, color: colors.white },
  profileCopy: { flex: 1, gap: spacing.xs },
  profileTitle: { ...typography.h2, color: colors.white },
  profileSubtitle: { ...typography.small, color: '#BCD1E0' },
  role: { ...typography.caption, color: '#91E0D0' },
  section: { marginTop: spacing.xxl },
  sectionLabel: { ...typography.h3, color: colors.ink, marginBottom: spacing.sm },
  menu: {
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  menuItem: {
    minHeight: 74,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  menuDivider: { borderBottomWidth: 1, borderBottomColor: colors.line },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.ice,
  },
  menuCopy: { flex: 1, gap: 3 },
  menuTitle: { ...typography.body, fontWeight: '700', color: colors.ink },
  menuDetail: { ...typography.caption, color: colors.muted },
  logoutButton: {
    minHeight: 52,
    marginTop: spacing.xxl,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  logoutText: { ...typography.body, color: colors.red, fontWeight: '600' },
  version: {
    ...typography.caption,
    color: colors.muted,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  pressed: { opacity: 0.7 },
});
