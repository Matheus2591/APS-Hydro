import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Bell } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAppStore } from '../store/useAppStore';
import { PrimaryButton } from '../components/PrimaryButton';
import { showMessage } from '../utils/showMessage';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '../components/AppHeader';
import { colors, radii, spacing, typography } from '../theme';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Notifications'>;

export function NotificationsScreen({ navigation }: Props) {
  const notifications = useAppStore((s) => s.notifications);
  const sync = useAppStore((s) => s.syncPending);
  const syncing = useAppStore((s) => s.syncing);
  const read = useAppStore((s) => s.readNotification);
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <AppHeader title="Notificações" onBack={navigation.goBack} />
      <ScrollView contentContainerStyle={styles.content}>
        <PrimaryButton
          label="Atualizar notificações"
          onPress={() => void sync()}
          loading={syncing}
          variant="secondary"
        />
        <Text style={styles.endText}>
          Avisos recebidos ao sincronizar. Não são alertas da Defesa Civil nem notificações push.
        </Text>
        {notifications.map((item) => (
          <Pressable
            key={item.id}
            style={styles.item}
            onPress={() => {
              void read(item.id).catch((error) =>
                showMessage('Não foi possível marcar como lida', error.message),
              );
              navigation.navigate('ReportDetail', { reportId: item.reportId });
            }}
          >
            <View
              style={[styles.icon, { backgroundColor: item.readAt ? colors.canvas : colors.ice }]}
            >
              <Bell color={colors.blue} size={21} />
            </View>
            <View style={styles.copy}>
              <Text style={styles.title}>
                {!item.readAt ? 'Nova · ' : ''}
                {item.title}
              </Text>
              <Text style={styles.text}>{item.body}</Text>
              <Text style={styles.time}>{new Date(item.createdAt).toLocaleString('pt-BR')}</Text>
            </View>
          </Pressable>
        ))}
        <View style={styles.emptyIcon}>
          <Bell color={colors.muted} size={22} />
        </View>
        <Text style={styles.endText}>
          {notifications.length
            ? 'Você chegou ao fim dos avisos recebidos.'
            : 'Nenhuma notificação recebida. Novos relatos, confirmações e contestações geram avisos para as contas envolvidas.'}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  content: { padding: spacing.lg, backgroundColor: colors.canvas, flexGrow: 1 },
  item: {
    flexDirection: 'row',
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  icon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, marginLeft: spacing.md },
  title: { ...typography.h3, color: colors.ink },
  text: { ...typography.small, color: colors.navySoft, marginTop: spacing.xs },
  time: { ...typography.caption, color: colors.muted, marginTop: spacing.sm },
  emptyIcon: {
    alignSelf: 'center',
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E7ECEF',
    marginTop: spacing.xl,
  },
  endText: { ...typography.small, color: colors.muted, textAlign: 'center', marginTop: spacing.sm },
});
