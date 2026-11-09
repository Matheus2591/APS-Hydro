import { AppImage as Image } from '../components/AppImage';
import { showMessage } from '../utils/showMessage';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { selectPhoto } from '../services/selectPhoto';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  Camera,
  Check,
  Clock3,
  MapPin,
  MessageCircle,
  Pencil,
  ShieldAlert,
  UserRound,
} from 'lucide-react-native';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '../components/AppHeader';
import { PrimaryButton } from '../components/PrimaryButton';
import { StatusPill } from '../components/StatusPill';
import { useAppStore } from '../store/useAppStore';
import { useVisibleReports } from '../store/useVisibleReports';
import { colors, radii, spacing, typography } from '../theme';
import type { RootStackParamList } from '../types/navigation';
import { formatDateTime } from '../utils/format';
import { USE_MOCKS } from '../services/api/client';
import { hasConfirmedLocation } from '../map/geo';

type Props = NativeStackScreenProps<RootStackParamList, 'ReportDetail'>;

export function ReportDetailScreen({ navigation, route }: Props) {
  const reports = useVisibleReports();
  const user = useAppStore((state) => state.user);
  const confirmedReportIds = useAppStore((state) => state.confirmedReportIds);
  const confirmReport = useAppStore((state) => state.confirmReport);
  const submitDispute = useAppStore((state) => state.submitDispute);
  const pendingConfirmations = useAppStore((s) => s.pendingConfirmations);
  const pendingUpdates = useAppStore((s) => s.pendingReportUpdates);
  const updateStatus = useAppStore((s) => s.updateReportStatus);
  const allDisputes = useAppStore((s) => s.disputes);
  const disputes = allDisputes.filter(
    (d) =>
      d.reportId === route.params.reportId &&
      (d.authorId === user?.id || reports.find((r) => r.id === d.reportId)?.authorId === user?.id),
  );
  const report = reports.find((item) => item.id === route.params.reportId);
  const [showDispute, setShowDispute] = useState(false);
  const [justification, setJustification] = useState('');
  const [photoUri, setPhotoUri] = useState('');
  const [submittingDispute, setSubmittingDispute] = useState(false);
  const [lifecycle, setLifecycle] = useState<'active' | 'resolved'>(report?.lifecycle ?? 'active');
  const [updateNote, setUpdateNote] = useState(report?.stateNote ?? '');
  const [savingUpdate, setSavingUpdate] = useState(false);
  if (!report)
    return (
      <SafeAreaView style={styles.safe}>
        <AppHeader title="Relato indisponível" onBack={navigation.goBack} />
        <Text style={{ padding: 24 }}>
          Este relato não está salvo neste aparelho. Sincronize na aba Atividade.
        </Text>
      </SafeAreaView>
    );
  const confirmed = confirmedReportIds.includes(report.id);
  const isOwner = report.authorId === user?.id;

  const pickEvidence = async () => {
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

  const sendDispute = async () => {
    if (justification.trim().length < 10) {
      showMessage('Explique melhor', 'Escreva uma justificativa com pelo menos 10 caracteres.');
      return;
    }
    setSubmittingDispute(true);
    try {
      const result = await submitDispute({
        reportId: report.id,
        justification: justification.trim(),
        photoUri: photoUri || undefined,
      });
      setSubmittingDispute(false);
      setShowDispute(false);
      setJustification('');
      setPhotoUri('');
      showMessage(
        result.status === 'sent'
          ? 'Contestação recebida pelo servidor'
          : 'Contestação salva no aparelho',
        result.status === 'sent'
          ? 'A justificativa foi registrada e o autor receberá um aviso. O relato original foi preservado.'
          : 'A justificativa está na fila e será enviada ao sincronizar com sua conta.',
      );
    } catch (error) {
      showMessage(
        'Não foi possível registrar',
        error instanceof Error ? error.message : 'Tente novamente.',
      );
    } finally {
      setSubmittingDispute(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <AppHeader title="Relato da comunidade" onBack={navigation.goBack} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <View style={styles.topRow}>
            <StatusPill
              status={
                report.visibility === 'hidden'
                  ? 'hidden'
                  : report.lifecycle === 'resolved'
                    ? 'resolved'
                    : report.status === 'synced'
                      ? report.category
                      : report.status
              }
            />
            <View style={styles.communityBadge}>
              <UserRound color={colors.blue} size={14} />
              <Text style={styles.communityText}>Comunidade</Text>
            </View>
          </View>
          <Text style={styles.address}>{report.address}</Text>
          <Text style={styles.metaText}>
            {hasConfirmedLocation(report)
              ? `${report.locationMode === 'gps' ? 'GPS' : 'Ponto escolhido no mapa'} · ${report.coordinates.latitude.toFixed(6)}, ${report.coordinates.longitude.toFixed(6)}`
              : 'Localização não confirmada; este relato não tem marcador geográfico.'}
          </Text>
          {hasConfirmedLocation(report) && report.visibility !== 'hidden' && (
            <PrimaryButton
              label="Ver no mapa"
              variant="secondary"
              onPress={() =>
                navigation.navigate('Main', {
                  screen: 'Mapa',
                  params: { focusReportId: report.id, focusAt: Date.now() },
                })
              }
            />
          )}
          {report.photoUri && report.visibility !== 'hidden' ? (
            <Image source={{ uri: report.photoUri }} style={styles.reportPhoto} />
          ) : null}
          <View style={styles.metaRow}>
            <MapPin color={colors.muted} size={15} />
            <Text style={styles.metaText}>
              Endereço informado pelo colaborador; consulte as coordenadas do relato.
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Clock3 color={colors.muted} size={15} />
            <Text style={styles.metaText}>Observado em {formatDateTime(report.observedAt)}</Text>
          </View>
          <View style={styles.divider} />
          <Text style={styles.sectionLabel}>Descrição</Text>
          <Text style={styles.description}>{report.description}</Text>
          {!!report.stateNote && (
            <Text style={styles.metaText}>Atualização: {report.stateNote}</Text>
          )}
          {!!report.stateUpdatedAt && (
            <Text style={styles.metaText}>
              Registro atualizado em {formatDateTime(report.stateUpdatedAt)}
            </Text>
          )}
          {report.visibility === 'hidden' && (
            <Text style={styles.metaText}>
              Este relato foi ocultado do mapa pela moderação. Confira a decisão na divergência
              recebida.
            </Text>
          )}
        </View>

        <View style={styles.confirmCard}>
          <View style={styles.confirmIcon}>
            <MessageCircle color={colors.blue} size={22} />
          </View>
          <View style={styles.confirmCopy}>
            <Text style={styles.confirmTitle}>
              {report.confirmations}{' '}
              {report.confirmations === 1
                ? USE_MOCKS
                  ? 'confirmação simulada'
                  : 'confirmação da comunidade'
                : USE_MOCKS
                  ? 'confirmações simuladas'
                  : 'confirmações da comunidade'}
            </Text>
            <Text style={styles.confirmText}>Você também está vendo esta situação?</Text>
          </View>
        </View>
        <PrimaryButton
          label={
            isOwner
              ? 'Você publicou este relato'
              : confirmed
                ? 'Ocorrência confirmada'
                : pendingConfirmations.some(
                      (i) => i.reportId === report.id && i.authorId === user?.id,
                    )
                  ? 'Confirmação aguardando envio'
                  : 'Confirmar ocorrência'
          }
          onPress={() =>
            void confirmReport(report.id).catch((error) =>
              showMessage(
                'Não foi possível confirmar',
                error instanceof Error ? error.message : 'Tente novamente.',
              ),
            )
          }
          disabled={
            confirmed ||
            isOwner ||
            pendingConfirmations.some((i) => i.reportId === report.id && i.authorId === user?.id)
          }
          variant="secondary"
          icon={confirmed ? <Check color={colors.green} size={18} /> : undefined}
        />

        <Pressable style={styles.disputeLink} onPress={() => setShowDispute((value) => !value)}>
          <Text style={styles.disputeLinkText}>
            {showDispute ? 'Fechar formulário' : 'Informar uma divergência'}
          </Text>
        </Pressable>

        {showDispute ? (
          <View style={styles.disputeCard}>
            <Text style={styles.disputeTitle}>Informar uma divergência</Text>
            <Text style={styles.disputeSubtitle}>
              Sua justificativa será registrada no servidor e enviada ao autor. Isso não remove o
              relato nem substitui uma avaliação de autoridade.
            </Text>
            <TextInput
              value={justification}
              onChangeText={setJustification}
              maxLength={500}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              placeholder="Ex.: a via está livre e o relato parece ser de outro momento..."
              placeholderTextColor={colors.muted}
              style={styles.disputeInput}
            />
            <Pressable style={styles.evidenceButton} onPress={pickEvidence}>
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.evidencePhoto} />
              ) : (
                <View style={styles.evidenceIcon}>
                  <Camera color={colors.blue} size={20} />
                </View>
              )}
              <View style={styles.evidenceCopy}>
                <Text style={styles.evidenceTitle}>
                  {photoUri ? 'Trocar foto da evidência' : 'Adicionar foto da evidência'}
                </Text>
                <Text style={styles.evidenceSubtitle}>Opcional, mas ajuda na análise</Text>
              </View>
            </Pressable>
            <PrimaryButton
              label="Enviar contestação"
              onPress={sendDispute}
              loading={submittingDispute}
            />
          </View>
        ) : null}

        {disputes.map((d) => (
          <View key={d.id} style={styles.disputeCard}>
            <Text style={styles.disputeTitle}>
              {d.status === 'sent' ? 'Contestação registrada' : 'Contestação aguardando envio'}
            </Text>
            <Text style={styles.disputeSubtitle}>{d.justification}</Text>
            {!!d.reviewStatus && (
              <Text style={styles.disputeSubtitle}>
                {d.reviewStatus === 'pending'
                  ? 'Aguardando análise da moderação.'
                  : d.reviewStatus === 'kept'
                    ? 'Análise concluída: relato mantido.'
                    : 'Análise concluída: relato ocultado.'}
              </Text>
            )}
            {!!d.moderationNote && (
              <Text style={styles.disputeSubtitle}>Decisão: {d.moderationNote}</Text>
            )}
            {d.photoUri && <Image source={{ uri: d.photoUri }} style={styles.evidencePhoto} />}
            {d.lastError && <Text style={styles.disputeSubtitle}>{d.lastError}</Text>}
          </View>
        ))}

        {isOwner && report.status === 'synced' && !USE_MOCKS && (
          <View style={styles.disputeCard}>
            <Text style={styles.disputeTitle}>Atualizar minha ocorrência</Text>
            <Text style={styles.disputeSubtitle}>
              O relato original fica preservado. Informe a situação atual ou registre que foi
              resolvida.
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {(['active', 'resolved'] as const).map((value) => (
                <Pressable
                  key={value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: lifecycle === value }}
                  onPress={() => setLifecycle(value)}
                  style={styles.editButton}
                >
                  <Text style={styles.editButtonText}>
                    {lifecycle === value ? '✓ ' : ''}
                    {value === 'active' ? 'Em andamento' : 'Resolvida'}
                  </Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              placeholderTextColor={colors.muted}
              accessibilityLabel="Atualização da ocorrência"
              value={updateNote}
              onChangeText={setUpdateNote}
              maxLength={300}
              multiline
              placeholder="Explique o que mudou (opcional)"
              style={styles.disputeInput}
            />
            <PrimaryButton
              label={
                pendingUpdates.some((u) => u.reportId === report.id)
                  ? 'Atualização aguardando envio'
                  : 'Salvar atualização'
              }
              loading={savingUpdate}
              disabled={pendingUpdates.some((u) => u.reportId === report.id)}
              onPress={() =>
                void (async () => {
                  setSavingUpdate(true);
                  try {
                    await updateStatus(report.id, lifecycle, updateNote);
                    showMessage('Atualização salva', 'Acompanhe o envio na aba Atividade.');
                  } catch (error) {
                    showMessage(
                      'Não foi possível atualizar',
                      error instanceof Error ? error.message : 'Tente novamente.',
                    );
                  } finally {
                    setSavingUpdate(false);
                  }
                })()
              }
            />
          </View>
        )}
        {isOwner && (USE_MOCKS || report.status === 'pending') ? (
          <Pressable
            style={styles.editButton}
            onPress={() => navigation.navigate('ReportEdit', { reportId: report.id })}
          >
            <Pencil color={colors.blue} size={18} />
            <Text style={styles.editButtonText}>Editar meu relato</Text>
          </Pressable>
        ) : null}

        <View style={styles.notice}>
          <ShieldAlert color={colors.amber} size={20} />
          <Text style={styles.noticeText}>
            Informação colaborativa não verificada por autoridade. Evite a área se houver risco e
            ligue 199 em emergências.
          </Text>
        </View>
        {report.lastError && (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>{report.lastError}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl, backgroundColor: colors.canvas },
  card: {
    padding: spacing.xl,
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  communityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radii.pill,
    backgroundColor: colors.ice,
  },
  communityText: { ...typography.caption, color: colors.blueDark },
  address: { ...typography.h1, color: colors.ink, marginTop: spacing.xl },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: spacing.sm },
  metaText: { ...typography.small, color: colors.muted },
  divider: { height: 1, backgroundColor: colors.line, marginVertical: spacing.xl },
  sectionLabel: {
    ...typography.caption,
    color: colors.muted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  description: { ...typography.body, color: colors.navySoft, marginTop: spacing.sm },
  reportPhoto: { width: '100%', height: 170, borderRadius: radii.md, marginTop: spacing.lg },
  confirmCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  confirmIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.ice,
  },
  confirmCopy: { flex: 1, marginLeft: spacing.md },
  confirmTitle: { ...typography.h3, color: colors.ink },
  confirmText: { ...typography.caption, color: colors.muted, marginTop: 2 },
  disputeLink: { alignItems: 'center', paddingVertical: spacing.lg },
  disputeLinkText: { ...typography.small, color: colors.red, fontWeight: '700' },
  disputeCard: {
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: '#F2CACA',
  },
  disputeTitle: { ...typography.h3, color: colors.ink },
  disputeSubtitle: { ...typography.small, color: colors.muted, marginTop: spacing.xs },
  disputeInput: {
    minHeight: 120,
    padding: spacing.md,
    marginTop: spacing.lg,
    borderRadius: radii.md,
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.line,
    ...typography.body,
    color: colors.ink,
  },
  evidenceButton: {
    minHeight: 70,
    padding: spacing.sm,
    marginVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.md,
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#E6B5B5',
  },
  evidenceIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.ice,
  },
  evidencePhoto: { width: 48, height: 48, borderRadius: 14 },
  evidenceCopy: { flex: 1, marginLeft: spacing.md },
  evidenceTitle: { ...typography.small, color: colors.blueDark, fontWeight: '700' },
  evidenceSubtitle: { ...typography.caption, color: colors.muted, marginTop: 2 },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
  },
  editButtonText: { ...typography.small, color: colors.blue, fontWeight: '700' },
  notice: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xxl,
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.amberSoft,
  },
  noticeText: { ...typography.small, color: '#77500A', flex: 1 },
});
