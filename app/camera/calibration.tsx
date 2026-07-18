import { CameraView } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../components/AppButton';
import { CalibrationControlPanel } from '../../components/camera/CalibrationControlPanel';
import { CameraPreviewSurface } from '../../components/camera/CameraPreviewSurface';
import { Card } from '../../components/Card';
import { ScreenShell } from '../../components/ScreenShell';
import { SectionTitle } from '../../components/SectionTitle';
import { colors } from '../../constants/theme';
import {
  scoreCanonicalPoint,
  scoreToApproximateBoardPoint,
} from '../../features/camera/calibration/domain/coordinateTransform';
import type {
  BoardCalibrationProfile,
  BoardScoreResult,
} from '../../features/camera/calibration/domain/types';
import { useBoardCalibrationEditor } from '../../features/camera/calibration/ui/useBoardCalibrationEditor';
import { useCameraSession } from '../../features/camera/ui/useCameraSession';

export default function CameraCalibrationScreen() {
  const router = useRouter();
  const cameraRef = useRef<CameraView>(null);
  const cameraSession = useCameraSession();
  const editor = useBoardCalibrationEditor();
  const [testResult, setTestResult] = useState('テスト座標を選択してください。');
  const [scoreTestEnabled, setScoreTestEnabled] = useState(false);

  const testScore = (
    label: string,
    area: 'single' | 'double' | 'triple' | 'outer_bull' | 'inner_bull',
    segmentNumber: number | null,
  ) => {
    const point = scoreToApproximateBoardPoint({ area, segmentNumber, profile: editor.profile });
    setTestResult(formatScoreResult(label, scoreCanonicalPoint(point, editor.profile)));
  };

  const testBoundary = (label: string, angleDeg: number) => {
    setTestResult(
      formatScoreResult(
        label,
        scoreCanonicalPoint(pointAtBoardAngle(editor.profile, angleDeg), editor.profile),
      ),
    );
  };

  return (
    <ScreenShell>
      <SectionTitle
        title="Camera Calibration"
        subtitle="映像の左右反転、中心、外周、回転、Double / Triple / Bullリングを調整します。"
      />

      <View style={styles.layout}>
        <View style={styles.previewColumn}>
          <CameraPreviewSurface
            cameraRef={cameraRef}
            cameraSession={cameraSession}
            profile={editor.profile}
            editable
            selectedRing={editor.selectedRing}
            onSelectRing={editor.setSelectedRing}
            onMoveCenter={editor.moveCenter}
            onSetCenter={editor.setCenter}
            onScaleOuter={editor.scaleOuter}
            onSetOuterRadius={editor.setOuterRadius}
            onRotate={editor.rotate}
            onSetRotationDeg={editor.setRotationDeg}
            onAdjustRing={editor.updateRing}
            scoreTestEnabled={scoreTestEnabled}
            showSegmentGuides
            onScorePoint={(score) => setTestResult(formatScoreResult('クリック判定', score))}
          />
          {cameraSession.errorMessage ? (
            <Text style={styles.error}>{cameraSession.errorMessage}</Text>
          ) : null}
          <Card>
            <SectionTitle
              title="判定テスト"
              subtitle="保存済みProfileと同じ座標変換を使います。"
              tone="card"
            />
            <Text style={styles.meta}>{testResult}</Text>
            <View style={styles.actionGrid}>
              <AppButton
                label={scoreTestEnabled ? 'クリック判定ON' : 'クリック判定OFF'}
                onPress={() => setScoreTestEnabled((enabled) => !enabled)}
                variant={scoreTestEnabled ? 'primary' : 'secondary'}
              />
              <AppButton
                label="S19"
                onPress={() => testScore('S19', 'single', 19)}
                variant="secondary"
              />
              <AppButton
                label="S20"
                onPress={() => testScore('S20', 'single', 20)}
                variant="secondary"
              />
              <AppButton
                label="S1"
                onPress={() => testScore('S1', 'single', 1)}
                variant="secondary"
              />
              <AppButton
                label="S5"
                onPress={() => testScore('S5', 'single', 5)}
                variant="secondary"
              />
              <AppButton
                label="D16"
                onPress={() => testScore('D16', 'double', 16)}
                variant="secondary"
              />
              <AppButton
                label="T20"
                onPress={() => testScore('T20', 'triple', 20)}
                variant="secondary"
              />
              <AppButton
                label="Bull"
                onPress={() => testScore('Bull', 'inner_bull', null)}
                variant="secondary"
              />
              <AppButton
                label="Outer Bull"
                onPress={() => testScore('Outer Bull', 'outer_bull', null)}
                variant="secondary"
              />
              <AppButton
                label="20/1境界"
                onPress={() => testBoundary('20/1境界', 9)}
                variant="secondary"
              />
              <AppButton
                label="20/5境界"
                onPress={() => testBoundary('20/5境界', -9)}
                variant="secondary"
              />
            </View>
          </Card>
        </View>

        <View style={styles.controlColumn}>
          <Card>
            <SectionTitle
              title="Calibration操作"
              subtitle="中心ドラッグ相当、scale、rotation、ring個別調整をnormalized値で保存します。"
              tone="card"
            />
            <CalibrationControlPanel editor={editor} />
          </Card>
          <View style={styles.actionGrid}>
            <AppButton
              label="COUNT-UP設定へ"
              onPress={() => router.replace('/camera/local-count-up/settings')}
            />
            <AppButton
              label="Camera Homeへ"
              onPress={() => router.replace('/camera/home')}
              variant="secondary"
            />
          </View>
        </View>
      </View>
    </ScreenShell>
  );
}

function formatScoreResult(label: string, score: BoardScoreResult) {
  const segment = score.segmentNumber == null ? '' : ` ${score.segmentNumber}`;
  const boundary =
    score.distanceToSegmentBoundaryDeg == null
      ? '-'
      : `${score.distanceToSegmentBoundaryDeg.toFixed(1)}°`;
  return `${label}: ${score.area}${segment} / ${score.score}点 / radius ${score.boardRadius.toFixed(
    3,
  )} / angle ${score.boardAngleDeg.toFixed(1)}° / boundary ${boundary}`;
}

function pointAtBoardAngle(profile: BoardCalibrationProfile, angleDeg: number) {
  const radius = (profile.outerBullRatio + profile.tripleInnerRatio) / 2;
  const angle = (((angleDeg + profile.rotationDeg) % 360) * Math.PI) / 180;
  return {
    x: profile.centerX + Math.sin(angle) * radius * profile.outerRadius,
    y: profile.centerY - Math.cos(angle) * radius * profile.outerRadius,
  };
}

const styles = StyleSheet.create({
  layout: {
    gap: 14,
  },
  previewColumn: {
    gap: 14,
  },
  controlColumn: {
    gap: 14,
  },
  actionGrid: {
    gap: 10,
    marginTop: 12,
  },
  meta: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 19,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 19,
  },
});
