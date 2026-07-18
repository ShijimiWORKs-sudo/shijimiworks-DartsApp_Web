import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../../components/AppButton';
import { Card } from '../../../components/Card';
import { ScreenShell } from '../../../components/ScreenShell';
import { SectionTitle } from '../../../components/SectionTitle';
import { colors } from '../../../constants/theme';

export default function CameraLocalGameScreen() {
  const router = useRouter();

  return (
    <ScreenShell>
      <SectionTitle
        title="このPCでゲーム"
        subtitle="カメラPCをゲーム管理者として使います。ゲーム進行とSQLite保存はこのPCで行います。"
      />

      <Card>
        <SectionTitle
          title="ローカルゲーム選択"
          subtitle="ゲームロジックは既存Serviceを再利用します。"
          tone="card"
        />
        <View style={styles.actionGrid}>
          <AppButton
            label="COUNT-UP"
            onPress={() => router.push('/game/count-up/settings')}
            variant="countUp"
          />
          <AppButton
            label="01 GAME"
            onPress={() => router.push('/game/01/settings')}
            variant="zeroOne"
          />
          <AppButton
            label="STANDARD CRICKET"
            onPress={() => router.push('/game/cricket/settings')}
            variant="cricket"
          />
          <AppButton label="MATCH" onPress={() => router.push('/game/match/settings')} />
        </View>
        <Text style={styles.note}>
          CameraLocalGameAdapterが候補確定を既存Game Serviceのdart入力へ渡します。
        </Text>
      </Card>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  actionGrid: {
    gap: 10,
    marginTop: 12,
  },
  note: {
    marginTop: 12,
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
});
