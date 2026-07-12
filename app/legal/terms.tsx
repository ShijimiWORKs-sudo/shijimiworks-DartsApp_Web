import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../components/AppButton';
import { Card } from '../../components/Card';
import { ScreenShell } from '../../components/ScreenShell';
import { SectionTitle } from '../../components/SectionTitle';
import { colors } from '../../constants/theme';

const termsItems = [
  '練習アドバイスは一般化したプロトタイプ情報であり、医療、診断、専門指導の代替ではありません。',
  'イップスや痛み、強い違和感がある場合は、無理に投げ込まず休養や専門家への相談も検討してください。',
  'DartsSupportAppはDARTSLIVEまたはPHOENIXの公式アプリではありません。',
  'DARTSLIVE、PHOENIXその他の商標は、各権利者に帰属します。',
];

export default function TermsScreen() {
  const router = useRouter();

  return (
    <ScreenShell>
      <SectionTitle title="利用規約" subtitle="MVP v0.1.0時点の利用上の注意です。" />

      <Card>
        <Text style={styles.title}>利用にあたって</Text>
        <View style={styles.list}>
          {termsItems.map((item) => (
            <Text key={item} style={styles.body}>
              ・{item}
            </Text>
          ))}
        </View>
      </Card>

      <Card muted>
        <Text style={styles.body}>
          このページはTestFlight提出前の準備用ドラフトです。公開配布前に正式な規約として確認してください。
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
