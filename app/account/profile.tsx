import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppButton } from '../../components/AppButton';
import { Card } from '../../components/Card';
import { AccountLocalNotice } from '../../components/account/AccountLocalNotice';
import { AccountSummaryCard } from '../../components/account/AccountSummaryCard';
import { RatingStatusCard } from '../../components/account/RatingStatusCard';
import { ScreenShell } from '../../components/ScreenShell';
import { SectionTitle } from '../../components/SectionTitle';
import { useDesktopWebLayout } from '../../components/web/useDesktopWebLayout';
import { webGameStyles } from '../../components/web/WebGameShell';
import { colors } from '../../constants/theme';
import { useGameDatabase } from '../../contexts/GameDatabaseContext';
import { useActiveAccountOverview } from '../../hooks/useActiveAccountOverview';

export default function AccountProfileScreen() {
  const router = useRouter();
  const { services } = useGameDatabase();
  const isDesktopWeb = useDesktopWebLayout();
  const {
    errorMessage: accountErrorMessage,
    isResolving,
    overview,
    reload,
    status: accountStatus,
  } = useActiveAccountOverview();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!overview) {
      return;
    }
    setDisplayName(overview.account.displayName);
    setEmail(overview.account.emailNormalized ?? '');
  }, [overview]);

  useEffect(() => {
    if (accountStatus === 'unregistered') {
      router.replace('/account/register');
    }
  }, [accountStatus, router]);

  const handleSave = useCallback(async () => {
    if (!services?.account || !overview || isSaving) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const nextOverview = await services.account.updateProfile(overview.account.id, {
        displayName,
        email,
      });
      setDisplayName(nextOverview.account.displayName);
      setEmail(nextOverview.account.emailNormalized ?? '');
      reload();
      Alert.alert('保存しました', 'Accountプロフィールを更新しました。');
    } catch (error) {
      const message = getErrorMessage(error);
      setErrorMessage(message);
      Alert.alert('保存できませんでした', message);
    } finally {
      setIsSaving(false);
    }
  }, [displayName, email, isSaving, overview, reload, services]);

  return (
    <ScreenShell>
      <SectionTitle title="Accountプロフィール" subtitle="Rating所有者の登録情報です。" />

      <AccountLocalNotice />

      {accountStatus === 'database_loading' ? (
        <Card muted>
          <Text style={styles.message}>Accountサービスの接続を待っています。</Text>
        </Card>
      ) : null}

      {overview ? (
        <>
          <AccountSummaryCard overview={overview} />
          <RatingStatusCard overview={overview} />

          <Card>
            <SectionTitle
              title="共通Account契約"
              subtitle="このIDは将来のDartsApp / DartsSupportApp連携で使用します。"
              tone="card"
            />
            <View style={styles.contractRows}>
              <InfoRow label="Common Account ID" value={overview.account.id} />
              <InfoRow label="JSON契約" value="darts_common_data v1" />
              <InfoRow label="Export / Import" value="基盤のみ実装、通信は未実装" />
            </View>
          </Card>

          <Card>
            <SectionTitle
              title="編集"
              subtitle="ユーザーIDはPhase 4では変更しません。"
              tone="card"
            />
            <View style={styles.form}>
              <Text style={styles.label}>表示名</Text>
              <TextInput
                editable={!isSaving}
                onChangeText={setDisplayName}
                placeholder="PLAYER 1"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                value={displayName}
              />

              <Text style={styles.label}>メール</Text>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isSaving}
                keyboardType="email-address"
                onChangeText={setEmail}
                placeholder="name@example.com"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                value={email}
              />
            </View>
          </Card>

          <Card muted>
            <Text style={styles.message}>クラウド連携は準備中です。</Text>
          </Card>
        </>
      ) : (
        <Card muted>
          <Text style={styles.message}>
            {getMissingAccountMessage(isResolving, accountErrorMessage)}
          </Text>
        </Card>
      )}

      {accountErrorMessage || errorMessage ? (
        <Text style={styles.error}>{errorMessage ?? accountErrorMessage}</Text>
      ) : null}

      <View style={[styles.actions, isDesktopWeb && webGameStyles.desktopFooterActions]}>
        <AppButton
          label={isSaving ? '保存中...' : '保存する'}
          onPress={() => void handleSave()}
          disabled={!overview || isSaving}
          style={isDesktopWeb && webGameStyles.desktopFooterButton}
        />
        <AppButton
          label="Rating状態を見る"
          onPress={() => router.push('/account/rating-status')}
          variant="secondary"
          disabled={!overview}
          style={isDesktopWeb && webGameStyles.desktopFooterButton}
        />
      </View>
    </ScreenShell>
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '不明なエラーです。';
}

function getMissingAccountMessage(isResolving: boolean, errorMessage: string | null) {
  if (isResolving) {
    return 'Accountを読み込んでいます。';
  }
  if (errorMessage) {
    return 'Accountを読み込めませんでした。';
  }
  return 'Account登録が必要です。';
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text selectable style={styles.infoValue}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 10,
    marginTop: 14,
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surfaceMuted,
    color: colors.text,
    fontSize: 16,
    paddingHorizontal: 12,
  },
  actions: {
    gap: 10,
  },
  contractRows: {
    gap: 8,
    marginTop: 14,
  },
  infoRow: {
    minHeight: 46,
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  infoLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  infoValue: {
    marginTop: 3,
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  message: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 20,
  },
});
