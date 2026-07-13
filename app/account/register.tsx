import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppButton } from '../../components/AppButton';
import { Card } from '../../components/Card';
import { AccountLocalNotice } from '../../components/account/AccountLocalNotice';
import { ScreenShell } from '../../components/ScreenShell';
import { SectionTitle } from '../../components/SectionTitle';
import { colors } from '../../constants/theme';
import { useAppState } from '../../contexts/AppStateContext';
import { useGameDatabase } from '../../contexts/GameDatabaseContext';
import type { AccountServicePort } from '../../features/account/application/AccountServicePort';
import type { AccountOverview } from '../../features/account/domain';

type AccountAppState = ReturnType<typeof useAppState> & {
  activeAccountId?: string | null;
  setActiveAccountId?: (accountId: string | null) => Promise<void> | void;
};

type ServicesWithAccount = {
  account?: AccountServicePort;
};

export default function AccountRegisterScreen() {
  const router = useRouter();
  const appState = useAppState() as AccountAppState;
  const { services, isAvailable } = useGameDatabase();
  const accountService = (services as ServicesWithAccount | null)?.account ?? null;
  const activeAccountId = appState.activeAccountId ?? null;
  const [registrationTarget, setRegistrationTarget] = useState<AccountOverview | null>(null);
  const [userName, setUserName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      async function loadRegistrationTarget() {
        setIsLoading(true);
        setErrorMessage(null);

        if (!accountService) {
          if (mounted) {
            setIsLoading(false);
          }
          return;
        }

        try {
          const activeAccount = await accountService.getActiveAccount(activeAccountId);
          if (!mounted) {
            return;
          }

          if (activeAccount?.account.status === 'local_registered') {
            router.replace('/account/profile');
            return;
          }

          const target = activeAccount ?? (await accountService.getRegistrationTarget());
          if (!mounted) {
            return;
          }

          setRegistrationTarget(target);
          setDisplayName((current) => current || target?.ownerPlayer.displayName || '');
        } catch (error) {
          if (mounted) {
            setErrorMessage(getErrorMessage(error));
          }
        } finally {
          if (mounted) {
            setIsLoading(false);
          }
        }
      }

      void loadRegistrationTarget();
      return () => {
        mounted = false;
      };
    }, [accountService, activeAccountId, router]),
  );

  const handleRegister = useCallback(async () => {
    if (!accountService || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const overview = await accountService.registerLocalAccount({
        userName,
        displayName,
        email,
      });
      await Promise.resolve(appState.setActiveAccountId?.(overview.account.id));
      router.replace('/account/profile');
    } catch (error) {
      const message = getErrorMessage(error);
      setErrorMessage(message);
      Alert.alert('Accountを登録できませんでした', message);
    } finally {
      setIsSubmitting(false);
    }
  }, [accountService, appState, displayName, email, isSubmitting, router, userName]);

  const isDisabled = !isAvailable || !accountService || isLoading || isSubmitting;

  return (
    <ScreenShell>
      <SectionTitle title="Account登録" subtitle="Ratingの所有者をこの端末内に保存します。" />

      <AccountLocalNotice />

      {!accountService ? (
        <Card muted>
          <Text style={styles.message}>Accountサービスの接続を待っています。</Text>
        </Card>
      ) : null}

      {registrationTarget ? (
        <Card muted>
          <Text style={styles.message}>
            OWNER「{registrationTarget.ownerPlayer.displayName}」へ紐付けて登録します。
          </Text>
        </Card>
      ) : null}

      <Card>
        <SectionTitle title="登録情報" subtitle="パスワードは使用しません。" tone="card" />

        <View style={styles.form}>
          <FieldLabel label="ユーザーID" helper="3〜20文字の英小文字・数字・_のみ" />
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isDisabled}
            onChangeText={setUserName}
            placeholder="dart_owner"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            value={userName}
          />

          <FieldLabel label="表示名" helper="1〜30文字" />
          <TextInput
            editable={!isDisabled}
            onChangeText={setDisplayName}
            placeholder="PLAYER 1"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            value={displayName}
          />

          <FieldLabel label="メール" helper="任意。クラウド連携の本人確認は未対応です。" />
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isDisabled}
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="name@example.com"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            value={email}
          />
        </View>
      </Card>

      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

      <View style={styles.actions}>
        <AppButton
          label={isSubmitting ? '登録中...' : '登録する'}
          onPress={() => void handleRegister()}
          disabled={isDisabled}
        />
        <AppButton label="戻る" onPress={() => router.back()} variant="secondary" />
      </View>
    </ScreenShell>
  );
}

function FieldLabel({ label, helper }: { label: string; helper: string }) {
  return (
    <View style={styles.fieldLabel}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.helper}>{helper}</Text>
    </View>
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
  fieldLabel: {
    gap: 2,
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  helper: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
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
