import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../AppButton';
import { Card } from '../Card';
import { SectionTitle } from '../SectionTitle';
import { colors } from '../../constants/theme';
import type { CameraPermissionState } from '../../features/camera/domain/types';

type CameraPermissionCardProps = {
  permissionState: CameraPermissionState;
  onRequestPermission: () => void;
};

export function CameraPermissionCard({
  permissionState,
  onRequestPermission,
}: CameraPermissionCardProps) {
  const content = getPermissionContent(permissionState);

  return (
    <Card>
      <SectionTitle title={content.title} subtitle={content.subtitle} tone="card" />
      {content.showRequest ? (
        <View style={styles.action}>
          <AppButton label="カメラ権限を許可する" onPress={onRequestPermission} />
        </View>
      ) : null}
      {content.note ? <Text style={styles.note}>{content.note}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  action: {
    marginTop: 14,
  },
  note: {
    marginTop: 12,
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
});

function getPermissionContent(permissionState: CameraPermissionState) {
  switch (permissionState) {
    case 'granted':
      return {
        title: 'カメラ準備中',
        subtitle: 'プレビューを起動しています。',
        showRequest: false,
        note: null,
      };
    case 'denied':
      return {
        title: 'カメラ権限が必要です',
        subtitle: 'ダーツボードを撮影するにはカメラの利用許可が必要です。',
        showRequest: true,
        note: null,
      };
    case 'blocked':
      return {
        title: 'カメラ権限がブロックされています',
        subtitle: 'ブラウザまたは端末設定からDartsAppのカメラ権限を許可してください。',
        showRequest: false,
        note: '権限を変更した後、この画面を開き直してください。',
      };
    case 'unavailable':
      return {
        title: 'カメラを利用できません',
        subtitle: 'この端末またはブラウザではカメラが利用できない状態です。',
        showRequest: false,
        note: null,
      };
    case 'error':
      return {
        title: 'カメラ状態を確認できませんでした',
        subtitle: '少し待ってからもう一度お試しください。',
        showRequest: false,
        note: null,
      };
    case 'loading':
    default:
      return {
        title: 'カメラ状態を確認中',
        subtitle: '端末とブラウザのカメラ利用可否を確認しています。',
        showRequest: false,
        note: null,
      };
  }
}
