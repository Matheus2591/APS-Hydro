import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BellRing, CircleHelp, Database, MapPinned, ShieldCheck } from 'lucide-react-native';
import type { ComponentType } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { showMessage } from '../utils/showMessage';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '../components/AppHeader';
import { colors, radii, spacing, typography } from '../theme';
import type { RootStackParamList } from '../types/navigation';
import { USE_MOCKS } from '../services/api/client';

type Props = NativeStackScreenProps<RootStackParamList, 'ProfileSection'>;
type Icon = ComponentType<{ color?: string; size?: number; strokeWidth?: number }>;

const sections: Record<
  RootStackParamList['ProfileSection']['section'],
  {
    title: string;
    icon: Icon;
    intro: string;
    rows: Array<{ label: string; value: string; description?: string }>;
  }
> = {
  location: {
    title: 'Localização',
    icon: MapPinned,
    intro: 'A localização é usada para posicionar relatos e mostrar informações da sua região.',
    rows: [
      { label: 'Cidade monitorada', value: 'Santos - SP' },
      {
        label: 'Precisão',
        value: 'Aproximada',
        description: 'Use o GPS ou escolha um ponto no mapa. O endereço é uma descrição editável.',
      },
    ],
  },
  sources: {
    title: 'Fontes de dados',
    icon: Database,
    intro:
      'O Hydro Pulse reúne fontes institucionais e contribuições da comunidade em uma única visualização.',
    rows: [
      {
        label: 'Fonte de chuva',
        value: USE_MOCKS
          ? 'Exemplos simulados de estações'
          : 'Prefeitura de Santos — histórico importado',
      },
      {
        label: 'Relatos',
        value: 'Comunidade Hydro Pulse',
        description: 'Relatos são colaborativos e podem aguardar confirmação.',
      },
    ],
  },
  privacy: {
    title: 'Privacidade',
    icon: ShieldCheck,
    intro:
      'Nome, foto do relato e ponto escolhido são compartilhados com a comunidade. Telefone e endereço do perfil são opcionais e ficam restritos à sua conta. Sua senha é protegida e a sessão fica guardada com segurança no Android. Evite fotografar rostos, placas ou documentos.',
    rows: [
      {
        label: 'Controle da conta',
        value: 'Perfil → Conta e segurança',
        description:
          'Troque a senha, gere uma chave de recuperação ou exclua a conta e suas contribuições. O servidor conserva os três backups mais recentes. A hospedagem pode manter snapshots por sete dias; outros aparelhos descartam suas cópias ao sincronizar.',
      },
      { label: 'Localização', value: 'GPS somente ao tocar em Minha localização' },
      {
        label: 'Cartografia',
        value: 'OpenStreetMap',
        description:
          'Ao abrir o mapa, o serviço recebe os pedidos das imagens da região exibida. As ruas precisam de internet ou cache do aparelho.',
      },
      {
        label: 'Relatos pendentes',
        value: 'Salvos neste aparelho',
        description: 'Quando a conexão voltar, eles poderão ser sincronizados com o serviço.',
      },
    ],
  },
  help: {
    title: 'Ajuda',
    icon: CircleHelp,
    intro: 'Consulte as orientações rápidas para usar o Hydro Pulse.',
    rows: [
      {
        label: 'Como relatar?',
        value: 'Use o botão Relatar',
        description: 'Informe a situação, o local e uma descrição objetiva.',
      },
      {
        label: 'Esqueceu a senha?',
        value: 'Use sua chave de recuperação',
        description:
          'Na tela de entrada, toque em Esqueci minha senha. Guarde a chave fora do celular. Sem senha e sem chave não será possível recuperar a conta.',
      },
      {
        label: 'Situação do relato',
        value: 'Atualize quando a ocorrência terminar',
        description:
          'Abra seu relato enviado e informe se a ocorrência continua ativa ou foi encerrada. A comunidade pode informar divergências; um moderador avalia e pode ocultar conteúdo inadequado.',
      },
      {
        label: 'Como interpretar o mapa?',
        value: 'Mapa geográfico OpenStreetMap',
        description:
          'Arraste para explorar, use + e − para ampliar e toque nos pontos para abrir os relatos. Só aparecem relatos com coordenadas confirmadas por GPS ou escolha no mapa. Chuva oficial sem coordenadas não vira um marcador.',
      },
    ],
  },
};

export function ProfileSectionScreen({ navigation, route }: Props) {
  const section = sections[route.params.section];
  const Icon = section.icon;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <AppHeader title={section.title} onBack={navigation.goBack} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Icon color={colors.white} size={25} />
          </View>
          <Text style={styles.heroTitle}>{section.title}</Text>
          <Text style={styles.heroText}>{section.intro}</Text>
        </View>

        <View style={styles.card}>
          {section.rows.map((row, index) => (
            <View
              key={row.label}
              style={[styles.row, index < section.rows.length - 1 && styles.rowDivider]}
            >
              <Text style={styles.rowLabel}>{row.label}</Text>
              <Text style={styles.rowValue}>{row.value}</Text>
              {row.description ? (
                <Text style={styles.rowDescription}>{row.description}</Text>
              ) : null}
            </View>
          ))}
        </View>

        {route.params.section === 'privacy' ? (
          <Pressable
            style={styles.action}
            onPress={() => {
              if (Platform.OS === 'web')
                showMessage(
                  'Permissões do navegador',
                  'Use o menu do site na barra de endereço do navegador para revisar as permissões.',
                );
              else
                void Linking.openSettings().catch(() =>
                  showMessage('Permissões', 'Abra os ajustes do aparelho e procure Hydro Pulse.'),
                );
            }}
          >
            <BellRing color={colors.blue} size={19} />
            <Text style={styles.actionText}>
              Gerenciar permissões nas configurações do aparelho
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  content: {
    flexGrow: 1,
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
    backgroundColor: colors.canvas,
  },
  hero: { padding: spacing.xl, borderRadius: radii.xl, backgroundColor: colors.navy },
  heroIcon: {
    width: 50,
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.blue,
  },
  heroTitle: { ...typography.h1, color: colors.white, marginTop: spacing.lg },
  heroText: { ...typography.body, color: '#B9D4E4', marginTop: spacing.sm },
  card: {
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  row: { paddingVertical: spacing.lg },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: colors.line },
  rowLabel: { ...typography.caption, color: colors.muted, letterSpacing: 0.3 },
  rowValue: { ...typography.h3, color: colors.ink, marginTop: spacing.xs },
  rowDescription: { ...typography.small, color: colors.muted, marginTop: spacing.xs },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xl,
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.ice,
  },
  actionText: { ...typography.small, color: colors.blueDark, flex: 1, fontWeight: '700' },
});
