import { useLocalSearchParams, useRouter } from 'expo-router';

import { AppButton } from '../components/AppButton';
import { Card } from '../components/Card';
import { PracticeRecordForm } from '../components/PracticeRecordForm';
import { ScreenShell } from '../components/ScreenShell';
import { SectionTitle } from '../components/SectionTitle';
import { getPracticeMenuById } from '../constants/practiceMenus';
import { colors } from '../constants/theme';
import { useAppState } from '../contexts/AppStateContext';
import type { PracticeRecordInput } from '../types';
import { StyleSheet, Text, View } from 'react-native';

export default function RecordScreen() {
  const router = useRouter();
  const { practiceMenuId } = useLocalSearchParams<{ practiceMenuId?: string }>();
  const { addPracticeRecord } = useAppState();
  const selectedMenu = practiceMenuId ? getPracticeMenuById(practiceMenuId) : null;

  const handleSubmit = async (record: PracticeRecordInput) => {
    await addPracticeRecord(record);
    router.push('/analysis');
  };

  return (
    <ScreenShell>
      <SectionTitle
        title="練習記録入力"
        subtitle={
          selectedMenu
            ? `${selectedMenu.title} の記録を残します。`
            : '保存した内容は端末内に残り、分析と記録一覧に反映されます。'
        }
      />
      <Card muted>
        <Text style={styles.photoTitle}>写真からスコア記録</Text>
        <Text style={styles.photoBody}>
          写真を撮影または選択して、ダーツ3本の位置をタップして採点します。
        </Text>
        <View style={styles.photoAction}>
          <AppButton label="写真からスコア記録" onPress={() => router.push('/photo-score')} />
        </View>
      </Card>
      <PracticeRecordForm
        initialPracticeMenu={selectedMenu}
        submitLabel="保存して分析へ"
        onSubmit={handleSubmit}
      />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  photoTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  photoBody: {
    marginTop: 8,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 22,
  },
  photoAction: {
    marginTop: 14,
  },
});
