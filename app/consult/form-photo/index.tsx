import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppButton } from '../../../components/AppButton';
import { Card } from '../../../components/Card';
import { ScreenShell } from '../../../components/ScreenShell';
import { SectionTitle } from '../../../components/SectionTitle';
import {
  formAdviceCategoryLabels,
  formPhotoTypeLabels,
  formSelfCheckAnswerLabels,
  throwingHandLabels,
} from '../../../constants/formPhoto';
import { getPracticeMenuById } from '../../../constants/practiceMenus';
import { colors } from '../../../constants/theme';
import { useAppState } from '../../../contexts/AppStateContext';
import type {
  FormPhotoAdviceResult,
  FormPhotoEntry,
  FormPhotoType,
  FormSelfCheck,
  FormSelfCheckAnswer,
  ThrowingHand,
} from '../../../types';
import {
  generateFormPhotoAdvice,
  getLatestPhotoScoreRecord,
} from '../../../utils/generateFormPhotoAdvice';

const photoTypes: FormPhotoType[] = ['front', 'side', 'releaseAfter'];

const selfCheckQuestions: {
  key: keyof FormSelfCheck;
  label: string;
  helper: string;
}[] = [
  {
    key: 'stanceFeelsStable',
    label: 'スタンスは安定している',
    helper: '足位置と重心が毎投大きく変わらない',
  },
  {
    key: 'shoulderLineFeelsAligned',
    label: '肩ラインが狙いに向いている',
    helper: '構えた時の肩の向きに違和感が少ない',
  },
  {
    key: 'elbowHeightFeelsStable',
    label: '肘の高さが安定している',
    helper: '引き始めからリリースまで高さが大きく変わらない',
  },
  {
    key: 'releaseFeelsClean',
    label: 'リリースが抜ける',
    helper: '指に残りすぎず、引っかかりが少ない',
  },
  {
    key: 'followThroughGoesToTarget',
    label: 'フォロースルーが狙い方向へ出る',
    helper: '投げ終わりの手がターゲット方向へ残る',
  },
  {
    key: 'bodyOpensEarly',
    label: '体が早く開く感覚がある',
    helper: '投げる前に肩や腰が先に開いてしまう',
  },
  {
    key: 'gripFeelsTooStrong',
    label: 'グリップが強すぎる感覚がある',
    helper: '構えてから離すまで指先に力が残る',
  },
  {
    key: 'feelsRushed',
    label: '投げ急いでいる感覚がある',
    helper: '呼吸や構え直しが入らず、テンポだけ速くなる',
  },
];

const answerOptions: FormSelfCheckAnswer[] = ['yes', 'no', 'unknown'];

const initialSelfCheck: FormSelfCheck = {
  stanceFeelsStable: 'unknown',
  shoulderLineFeelsAligned: 'unknown',
  elbowHeightFeelsStable: 'unknown',
  releaseFeelsClean: 'unknown',
  followThroughGoesToTarget: 'unknown',
  bodyOpensEarly: 'unknown',
  gripFeelsTooStrong: 'unknown',
  feelsRushed: 'unknown',
};

export default function FormPhotoConsultScreen() {
  const router = useRouter();
  const { addFormPhotoAdviceResult, formPhotoAdviceResults, records } = useAppState();
  const [throwingHand, setThrowingHand] = useState<ThrowingHand>('right');
  const [photos, setPhotos] = useState<FormPhotoEntry[]>(
    photoTypes.map((type) => ({ type, note: '' })),
  );
  const [selfCheck, setSelfCheck] = useState<FormSelfCheck>(initialSelfCheck);
  const [result, setResult] = useState<FormPhotoAdviceResult | null>(null);
  const [error, setError] = useState('');
  const latestPhotoScoreRecord = useMemo(() => getLatestPhotoScoreRecord(records), [records]);
  const recommendedMenus = useMemo(
    () =>
      result
        ? result.recommendedPracticeMenuIds
            .map((menuId) => getPracticeMenuById(menuId))
            .filter(
              (menu): menu is NonNullable<ReturnType<typeof getPracticeMenuById>> => menu !== null,
            )
        : [],
    [result],
  );
  const latestSavedResult = formPhotoAdviceResults[0] ?? null;

  const pickImage = async (type: FormPhotoType) => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setError('写真ライブラリへのアクセスを許可してください。');
      return;
    }

    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });

    if (!pickerResult.canceled) {
      setError('');
      updatePhoto(type, { imageUri: pickerResult.assets[0]?.uri ?? '' });
    }
  };

  const takePhoto = async (type: FormPhotoType) => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      setError('カメラへのアクセスを許可してください。');
      return;
    }

    const pickerResult = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });

    if (!pickerResult.canceled) {
      setError('');
      updatePhoto(type, { imageUri: pickerResult.assets[0]?.uri ?? '' });
    }
  };

  const handleGenerate = async () => {
    const selectedPhotoCount = photos.filter((photo) => photo.imageUri).length;

    if (selectedPhotoCount === 0) {
      setError('少なくとも1枚はフォーム写真を登録してください。');
      return;
    }

    const nextResult = generateFormPhotoAdvice({
      throwingHand,
      photos,
      selfCheck,
      linkedPracticeRecord: latestPhotoScoreRecord,
    });

    setError('');
    setResult(nextResult);
    await addFormPhotoAdviceResult(nextResult);
  };

  const updatePhoto = (type: FormPhotoType, nextValue: Partial<FormPhotoEntry>) => {
    setPhotos((currentPhotos) =>
      currentPhotos.map((photo) => (photo.type === type ? { ...photo, ...nextValue } : photo)),
    );
  };

  const updateSelfCheck = (key: keyof FormSelfCheck, value: FormSelfCheckAnswer) => {
    setSelfCheck((currentValue) => ({
      ...currentValue,
      [key]: value,
    }));
  };

  return (
    <ScreenShell>
      <SectionTitle
        title="フォーム写真3枚相談"
        subtitle="写真AI診断ではなく、3枚写真・自己チェック・写真スコア傾向から固定ロジックで助言します。"
      />

      <Card muted>
        <Text style={styles.cardTitle}>MVPでできること</Text>
        <Text style={styles.bodyText}>
          正面、横、リリース後の写真を登録し、自己チェックと直近の写真スコア分析を合わせて、確認ポイントを整理します。画像はMVPでは永続保存前提ではありません。
        </Text>
        <Text style={styles.noticeText}>
          骨格推定や自動フォーム診断はまだ行いません。痛みや強い違和感がある場合は無理に投げ込まないでください。
        </Text>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>利き手</Text>
        <View style={styles.chipGrid}>
          {(['right', 'left'] as ThrowingHand[]).map((hand) => (
            <ChoiceChip
              key={hand}
              label={throwingHandLabels[hand]}
              selected={throwingHand === hand}
              onPress={() => setThrowingHand(hand)}
            />
          ))}
        </View>
      </Card>

      <SectionTitle title="フォーム写真" />
      {photos.map((photo) => (
        <Card key={photo.type}>
          <Text style={styles.cardTitle}>{formPhotoTypeLabels[photo.type]}写真</Text>
          <Text style={styles.bodyText}>
            {photo.type === 'front'
              ? '肩、腰、足位置の左右差を確認します。'
              : photo.type === 'side'
                ? '肘の高さ、体の開き、重心の前後を確認します。'
                : '投げ終わりの手、フォロースルー、リリース後の向きを確認します。'}
          </Text>
          {photo.imageUri ? (
            <Image source={{ uri: photo.imageUri }} resizeMode="contain" style={styles.preview} />
          ) : (
            <Text style={styles.noticeText}>写真はまだ登録されていません。</Text>
          )}
          <View style={styles.actionStack}>
            <AppButton label="写真を選択" onPress={() => void pickImage(photo.type)} />
            <AppButton
              label="カメラで撮影"
              onPress={() => void takePhoto(photo.type)}
              variant="secondary"
            />
          </View>
          <TextInput
            value={photo.note ?? ''}
            onChangeText={(note) => updatePhoto(photo.type, { note })}
            placeholder="メモ: 違和感、撮影角度、気になった点"
            placeholderTextColor={colors.textMuted}
            style={styles.noteInput}
          />
        </Card>
      ))}

      <SectionTitle title="自己チェック" />
      <Card>
        {selfCheckQuestions.map((question) => (
          <View key={question.key} style={styles.questionBlock}>
            <Text style={styles.questionTitle}>{question.label}</Text>
            <Text style={styles.bodyText}>{question.helper}</Text>
            <View style={styles.chipGrid}>
              {answerOptions.map((answer) => (
                <ChoiceChip
                  key={`${question.key}-${answer}`}
                  label={formSelfCheckAnswerLabels[answer]}
                  selected={selfCheck[question.key] === answer}
                  onPress={() => updateSelfCheck(question.key, answer)}
                />
              ))}
            </View>
          </View>
        ))}
      </Card>

      <Card muted>
        <Text style={styles.cardTitle}>直近の写真スコア連携</Text>
        {latestPhotoScoreRecord?.photoScore ? (
          <>
            <Text style={styles.bodyText}>
              {formatDate(latestPhotoScoreRecord.date)} /{' '}
              {latestPhotoScoreRecord.photoScore.totalScore}点 / Bull{' '}
              {latestPhotoScoreRecord.photoScore.bullCount}
            </Text>
            <Text style={styles.bodyText}>
              {latestPhotoScoreRecord.photoScore.groupingAnalysis?.summaryText ??
                'グルーピング分析なし'}
            </Text>
          </>
        ) : (
          <Text style={styles.bodyText}>
            写真スコア記録がまだありません。今回は自己チェック中心で助言します。
          </Text>
        )}
      </Card>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      <AppButton label="フォーム写真から相談する" onPress={() => void handleGenerate()} />
      <AppButton
        label="フォーム写真相談履歴を見る"
        onPress={() => router.push('/consult/form-photo/history')}
        variant="secondary"
      />
      <AppButton
        label="通常のフォーム相談へ戻る"
        onPress={() => router.push('/consult')}
        variant="secondary"
      />

      {result ? (
        <>
          <SectionTitle title="相談結果" />
          <Card muted>
            <Text style={styles.cardTitle}>まとめ</Text>
            <Text style={styles.bodyText}>{result.summaryText}</Text>
            {result.linkedPhotoScoreSummary ? (
              <Text style={styles.bodyText}>{result.linkedPhotoScoreSummary}</Text>
            ) : null}
          </Card>

          <Card>
            <Text style={styles.cardTitle}>優先カテゴリ</Text>
            <View style={styles.chipGrid}>
              {result.adviceCategories.map((category) => (
                <Text key={category} style={styles.resultPill}>
                  {formAdviceCategoryLabels[category]}
                </Text>
              ))}
            </View>
          </Card>

          <ResultList title="アドバイス" items={result.adviceTexts} />
          <ResultList title="次回見るポイント" items={result.checkPoints} />

          {recommendedMenus.length > 0 ? (
            <>
              <SectionTitle title="おすすめ練習" />
              {recommendedMenus.map((menu) => (
                <Card key={menu.id}>
                  <Text style={styles.cardTitle}>{menu.title}</Text>
                  <Text style={styles.bodyText}>{menu.purpose}</Text>
                  <View style={styles.actionStack}>
                    <AppButton
                      label="練習詳細を開く"
                      onPress={() => router.push(`/practice/${menu.id}`)}
                      variant="secondary"
                    />
                    <AppButton
                      label="この練習を記録する"
                      onPress={() =>
                        router.push({
                          pathname: '/record',
                          params: { practiceMenuId: menu.id },
                        })
                      }
                    />
                  </View>
                </Card>
              ))}
            </>
          ) : null}
          <AppButton
            label="保存した履歴を見る"
            onPress={() => router.push(`/consult/form-photo/history/${result.id}`)}
            variant="secondary"
          />
        </>
      ) : null}

      {latestSavedResult && !result ? (
        <Card muted>
          <Text style={styles.cardTitle}>前回のフォーム写真相談</Text>
          <Text style={styles.bodyText}>{formatDate(latestSavedResult.date)}</Text>
          <Text style={styles.bodyText}>{latestSavedResult.summaryText}</Text>
          <View style={styles.actionStack}>
            <AppButton
              label="前回の履歴を見る"
              onPress={() => router.push(`/consult/form-photo/history/${latestSavedResult.id}`)}
              variant="secondary"
            />
          </View>
        </Card>
      ) : null}
    </ScreenShell>
  );
}

function ResultList({ title, items }: { title: string; items: string[] }) {
  return (
    <Card>
      <Text style={styles.cardTitle}>{title}</Text>
      <View style={styles.resultList}>
        {items.map((item, index) => (
          <Text key={`${item}-${index}`} style={styles.bodyText}>
            {index + 1}. {item}
          </Text>
        ))}
      </View>
    </Card>
  );
}

function ChoiceChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

const styles = StyleSheet.create({
  cardTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  bodyText: {
    marginTop: 8,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
  noticeText: {
    marginTop: 10,
    color: colors.warning,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 20,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  chip: {
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  chipText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  chipTextSelected: {
    color: colors.primaryDark,
  },
  preview: {
    width: '100%',
    height: 220,
    marginTop: 14,
    borderRadius: 8,
    backgroundColor: colors.surfaceMuted,
  },
  actionStack: {
    gap: 10,
    marginTop: 14,
  },
  noteInput: {
    minHeight: 54,
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    textAlignVertical: 'top',
    backgroundColor: colors.background,
  },
  questionBlock: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  questionTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  resultPill: {
    minHeight: 34,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    overflow: 'hidden',
    color: colors.primaryDark,
    backgroundColor: colors.primarySoft,
    fontSize: 12,
    fontWeight: '900',
  },
  resultList: {
    gap: 6,
    marginTop: 8,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '800',
  },
});
