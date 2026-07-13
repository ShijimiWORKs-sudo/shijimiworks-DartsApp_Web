import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppButton } from '../../components/AppButton';
import { Card } from '../../components/Card';
import { AccountLocalNotice } from '../../components/account/AccountLocalNotice';
import { AccountSummaryCard } from '../../components/account/AccountSummaryCard';
import { RatingStatusCard } from '../../components/account/RatingStatusCard';
import { ScreenShell } from '../../components/ScreenShell';
import { SectionTitle } from '../../components/SectionTitle';
import { colors } from '../../constants/theme';
import { useAppState } from '../../contexts/AppStateContext';
import { useGameDatabase } from '../../contexts/GameDatabaseContext';
import type { AccountServicePort } from '../../features/account/application/AccountServicePort';
import type { AccountOverview } from '../../features/account/domain';

type AccountAppState = ReturnType<typeof useAppState> & {
  activeAccountId?: string | null;
};

type ServicesWithAccount = {
  account?: AccountServicePort;
};

export default function AccountProfileScreen() {
  const router = useRouter();
  const appState = useAppState() as AccountAppState;
  const { services } = useGameDatabase();
  const accountService = (services as ServicesWithAccount | null)?.account ?? null;
  const activeAccountId = appState.activeAccountId ?? null;
  const [overview, setOverview] = useState<AccountOverview | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadAccount = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    if (!accountService) {
      setOverview(null);
      setIsLoading(false);
      return;
    }

    try {
      const nextOverview = await accountService.getActiveAccount(activeAccountId);
      if (!nextOverview) {
        router.replace('/account/register');
        return;
      }

      setOverview(nextOverview);
      setDisplayName(nextOverview.account.displayName);
      setEmail(nextOverview.account.emailNormalized ?? '');
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, [accountService, activeAccountId, router]);

  useFocusEffect(
    useCallback(() => {
      void loadAccount();
    }, [loadAccount]),
  );

  const handleSave = useCallback(async () => {
    if (!accountService || !overview || isSaving) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const nextOverview = await accountService.updateProfile(overview.account.id, {
        displayName,
        email,
      });
      setOverview(nextOverview);
      setDisplayName(nextOverview.account.displayName);
      setEmail(nextOverview.account.emailNormalized ?? '');
      Alert.alert('保存しました', 'Accountプロフィールを更新しました。');
    } catch (error) {
      const message = getErrorMessage(error);
      setErrorMessage(message);
      Alert.alert('保存できませんでした', message);
    } finally {
      setIsSaving(false);
    }
  }, [accountService, displayName, email, isSaving, overview]);

  return (
    <ScreenShell>
      <SectionTitle title="Accountプロフィール" subtitle="Rating所有者の登録情報です。" />

      <AccountLocalNotice />

      {!accountService ? (
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
            {isLoading ? 'Accountを読み込んでいます。' : 'Account登録が必要です。'}
          </Text>
        </Card>
      )}

      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

      <View style={styles.actions}>
        <AppButton
          label={isSaving ? '保存中...' : '保存する'}
          onPress={() => void handleSave()}
          disabled={!overview || isSaving}
        />
        <AppButton
          label="Rating状態を見る"
          onPress={() => router.push('/account/rating-status')}
          variant="secondary"
          disabled={!overview}
        />
      </View>
    </ScreenShell>
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '不明なエラーです。';
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
