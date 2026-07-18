import { useRouter } from 'expo-router';
import { Text } from 'react-native';

import { AppButton } from '../../../components/AppButton';
import { Card } from '../../../components/Card';
import { ScreenShell } from '../../../components/ScreenShell';
import { SectionTitle } from '../../../components/SectionTitle';
import { AwardRegistry } from '../../../features/awards/application/AwardRegistry';

const registry = new AwardRegistry();

export default function CameraAwardsScreen() {
  const router = useRouter();
  const awards = registry.list();

  return (
    <ScreenShell>
      <SectionTitle
        title="Award確認"
        subtitle="動画・音声が未接続のAwardもfallback animationで確認できます。"
      />
      <Card>
        <SectionTitle title="Award Registry" subtitle={`${awards.length}件`} tone="card" />
        {awards.map((award) => (
          <Text key={award.code}>
            {award.label}: {award.videoUri ? 'video' : 'fallback'}
          </Text>
        ))}
        <AppButton label="Awardテスト" onPress={() => router.push('/camera/awards/test')} />
      </Card>
    </ScreenShell>
  );
}
