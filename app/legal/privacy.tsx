import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../components/AppButton';
import { Card } from '../../components/Card';
import { ScreenShell } from '../../components/ScreenShell';
import { SectionTitle } from '../../components/SectionTitle';
import { colors } from '../../constants/theme';

const privacyItems = [
  '現在のDartsSupportAppはログイン機能を提供していません。',
  'クラウド同期は行わず、入力されたプロフィール、練習記録、相談履歴は端末内のAsyncStorageに保存されます。',
  'AI API連携、公式API連携、外部サーバーへのデータ送信は行っていません。',
  '今後クラウド同期やAI連携を追加する場合は、利用前にプライバシーポリシーを更新します。',
];

export default function PrivacyScreen() {
  const router = useRouter();

  return (
    <ScreenShell>
      <SectionTitle title="プライバシーポリシー" subtitle="MVP v0.1.0時点のデータ取り扱いです。" />

      <Card>
        <Text style={styles.title}>データ保存について</Text>
        <View style={styles.list}>
          {privacyItems.map((item) => (
            <Text key={item} style={styles.body}>
              ・{item}
            </Text>
          ))}
        </View>
      </Card>

      <Card muted>
        <Text style={styles.body}>
          このページはTestFlight提出前の準備用ドラフトです。公開配布前に正式なURLと内容確認を行ってください。
        </Text>
      </Card>

      <AppButton label="設定へ戻る" onPress={() => router.push('/settings')} variant="secondary" />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  list: {
    gap: 10,
    marginTop: 12,
  },
  body: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 22,
  },
});
