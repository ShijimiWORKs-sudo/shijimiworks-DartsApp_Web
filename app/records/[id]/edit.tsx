import { useLocalSearchParams, useRouter } from 'expo-router';

import { AppButton } from '../../../components/AppButton';
import { PracticeRecordForm } from '../../../components/PracticeRecordForm';
import { ScreenShell } from '../../../components/ScreenShell';
import { SectionTitle } from '../../../components/SectionTitle';
import { useAppState } from '../../../contexts/AppStateContext';
import type { PracticeRecordInput } from '../../../types';

export default function RecordEditScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { getRecordById, updatePracticeRecord } = useAppState();
  const record = id ? getRecordById(id) : null;

  const handleSubmit = async (input: PracticeRecordInput) => {
    if (!record) {
      return;
    }

    await updatePracticeRecord(record.id, input);
    router.replace(`/records/${record.id}`);
  };

  if (!record) {
    return (
      <ScreenShell>
        <SectionTitle title="記録が見つかりません" subtitle="一覧からもう一度選択してください。" />
        <AppButton label="一覧へ戻る" onPress={() => router.replace('/records')} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell>
      <SectionTitle title="練習記録を編集" subtitle="保存すると詳細画面へ戻ります。" />
      <PracticeRecordForm
        initialRecord={record}
        submitLabel="変更を保存"
        onSubmit={handleSubmit}
        onCancel={() => router.replace(`/records/${record.id}`)}
      />
    </ScreenShell>
  );
}
