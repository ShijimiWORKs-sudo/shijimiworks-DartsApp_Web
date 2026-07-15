import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

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

export default function AccountRatingStatusScreen() {
  const router = useRouter();
  const appState = useAppState() as AccountAppState;
  const { services } = useGameDatabase();
  const isDesktopWeb = useDesktopWebLayout();
  const accountService = (services as ServicesWithAccount | null)?.account ?? null;
  const ratingService = services?.rating ?? null;
  const activeAccountId = appState.activeAccountId ?? null;
  const [overview, setOverview] = useState<AccountOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      async function loadAccount() {
        setIsLoading(true);
        setErrorMessage(null);

        if (!accountService) {
          if (mounted) {
            setIsLoading(false);
          }
          return;
        }

        try {
          await ratingService?.processPending();
          const nextOverview = await accountService.getActiveAccount(activeAccountId);
          if (!mounted) {
            return;
          }

          if (!nextOverview) {
            router.replace('/account/register');
            return;
          }

          setOverview(nextOverview);
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

      void loadAccount();
      return () => {
        mounted = false;
      };
    }, [accountService, activeAccountId, ratingService, router]),
  );

  return (
    <ScreenShell>
      <SectionTitle title="Rating測定状態" subtitle="DartsApp Ratingの基盤状態です。" />

      <AccountLocalNotice />

      {!accountService ? (
        <Card muted>
          <Text style={styles.message}>Accountサービスの接続を待っています。</Text>
        </Card>
      ) : null}

      {overview ? (
        <>
          <RatingStatusCard overview={overview} />
          <AccountSummaryCard overview={overview} />
          <Card muted>
            <Text style={styles.message}>
              Ratingは端末内で計算・保存されます。履歴では有効なSnapshotを新しい順に確認できます。
            </Text>
          </Card>
        </>
      ) : (
        <Card muted>
          <Text style={styles.message}>
            {isLoading ? 'Rating状態を読み込んでいます。' : 'Account登録が必要です。'}
          </Text>
        </Card>
      )}

      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

      <View style={[styles.actions, isDesktopWeb && webGameStyles.desktopFooterActions]}>
        <AppButton
          label="プロフィールへ"
          onPress={() => router.replace('/account/profile')}
          variant="secondary"
          disabled={!overview}
          style={isDesktopWeb && webGameStyles.desktopFooterButton}
        />
        <AppButton
          label="戻る"
          onPress={() => router.back()}
          variant="secondary"
          style={isDesktopWeb && webGameStyles.desktopFooterButton}
        />
      </View>
    </ScreenShell>
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '不明なエラーです。';
}

const styles = StyleSheet.create({
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
