import { useRouter } from 'expo-router';
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
import { useActiveAccountOverview } from '../../hooks/useActiveAccountOverview';

export default function AccountRatingStatusScreen() {
  const router = useRouter();
  const isDesktopWeb = useDesktopWebLayout();
  const {
    errorMessage,
    isResolving,
    overview,
    status: accountStatus,
  } = useActiveAccountOverview({ processPendingRating: true });

  return (
    <ScreenShell>
      <SectionTitle title="Rating測定状態" subtitle="DartsApp Ratingの基盤状態です。" />

      <AccountLocalNotice />

      {accountStatus === 'database_loading' ? (
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
            {getMissingRatingStatusMessage(isResolving, errorMessage)}
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

function getMissingRatingStatusMessage(isResolving: boolean, errorMessage: string | null) {
  if (isResolving) {
    return 'Rating状態を読み込んでいます。';
  }
  if (errorMessage) {
    return 'Rating状態を読み込めませんでした。';
  }
  return 'Account登録が必要です。';
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
