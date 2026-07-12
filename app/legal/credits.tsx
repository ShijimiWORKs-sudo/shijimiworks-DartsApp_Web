import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../components/AppButton';
import { Card } from '../../components/Card';
import { ScreenShell } from '../../components/ScreenShell';
import { SectionTitle } from '../../components/SectionTitle';
import { colors } from '../../constants/theme';

const creditItems = [
  'アプリ名: DartsSupportApp',
  '開発: ShijimiWORKs',
  'ロゴ: オリジナル馬ロゴ',
  '技術: Expo / React Native / TypeScript',
  'DARTSLIVE / PHOENIX の公式ロゴ、公式画像、公式APIは使用していません。',
  '練習・相談文はプロトタイプ用に一般化した独自要約です。',
];

export default function CreditsScreen() {
  const router = useRouter();

  return (
    <ScreenShell>
      <SectionTitle title="クレジット" subtitle="DartsSupportAppの制作情報です。" />

      <Card>
        <Text style={styles.title}>Credits</Text>
        <View style={styles.list}>
          {creditItems.map((item) => (
            <Text key={item} style={styles.body}>
              ・{item}
            </Text>
          ))}
        </View>
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
