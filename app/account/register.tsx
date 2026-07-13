import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
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
  const { accountBootstrapStatus, services, isAvailable } = useGameDatabase();
  const accountService = (services as ServicesWithAccount | null)?.account ?? null;
  const activeAccountId = appState.activeAccountId ?? null;
  const setActiveAccountId = appState.setActiveAccountId;
  const [registrationTarget, setRegistrationTarget] = useState<AccountOverview | null>(null);
  const [userName, setUserName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);

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
          const activeAccount = activeAccountId
            ? await accountService.getAccountById(activeAccountId)
            : null;
          if (!mounted) {
            return;
          }

          if (activeAccount?.account.status === 'local_registered') {
            router.replace('/account/profile');
            return;
          }

          const registeredAccount = await accountService.getActiveAccount(null);
          if (!mounted) {
            return;
          }

          if (registeredAccount) {
            await Promise.resolve(setActiveAccountId?.(registeredAccount.account.id));
            if (mounted) {
              router.replace('/account/profile');
            }
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
            setErrorMessage(getUserFacingErrorMessage(error));
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
    }, [accountService, activeAccountId, router, setActiveAccountId]),
  );

  const handleRegister = useCallback(async () => {
    if (!accountService || isSubmittingRef.current) {
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const existing = await accountService.getActiveAccount(activeAccountId);
      if (existing?.account.status === 'local_registered') {
        await Promise.resolve(setActiveAccountId?.(existing.account.id));
        router.replace('/account/profile');
        return;
      }

      const overview = await accountService.registerLocalAccount({
        userName,
        displayName,
        email,
      });
      await Promise.resolve(setActiveAccountId?.(overview.account.id));
      router.replace('/account/profile');
    } catch (error) {
      const message = getUserFacingErrorMessage(error);
      setErrorMessage(message);
      Alert.alert('Accountを登録できませんでした', message);
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }, [accountService, activeAccountId, displayName, email, router, setActiveAccountId, userName]);

  const isAccountTemporarilyUnavailable = accountBootstrapStatus === 'temporarilyUnavailable';
  const isDisabled =
    !isAvailable || !accountService || isLoading || isSubmitting || isAccountTemporarilyUnavailable;

  return (
    <ScreenShell>
      <SectionTitle title="Account登録" subtitle="Ratingの所有者をこの端末内に保存します。" />

      <AccountLocalNotice />

      {!accountService ? (
        <Card muted>
          <Text style={styles.message}>Accountサービスの接続を待っています。</Text>
        </Card>
      ) : null}

      {isAccountTemporarilyUnavailable ? (
        <Card muted>
          <Text style={styles.message}>
            Account情報を確認できませんでした。少し待ってからもう一度お試しください。
          </Text>
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

function getUserFacingErrorMessage(error: unknown) {
  if (isDatabaseLockError(error)) {
    return 'Account情報を確認できませんでした。少し待ってからもう一度お試しください。';
  }

  return error instanceof Error ? error.message : '不明なエラーです。';
}

function isDatabaseLockError(error: unknown): boolean {
  const candidate = error as { message?: unknown; code?: unknown; cause?: unknown };
  const code = typeof candidate?.code === 'string' ? candidate.code : '';
  const message = typeof candidate?.message === 'string' ? candidate.message : '';

  return (
    code === 'SQLITE_BUSY' ||
    code === 'SQLITE_LOCKED' ||
    /SQLITE_BUSY|SQLITE_LOCKED|database is locked|error code 5/i.test(message) ||
    (candidate?.cause ? isDatabaseLockError(candidate.cause) : false)
  );
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
