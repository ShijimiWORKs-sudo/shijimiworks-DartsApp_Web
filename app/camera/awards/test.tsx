import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '../../../components/AppButton';
import { AwardOverlay } from '../../../components/awards/AwardOverlay';
import { Card } from '../../../components/Card';
import { ScreenShell } from '../../../components/ScreenShell';
import { SectionTitle } from '../../../components/SectionTitle';
import { AwardEvaluator } from '../../../features/awards/application/AwardEvaluator';
import { AwardQueue } from '../../../features/awards/application/AwardQueue';
import { AwardRegistry } from '../../../features/awards/application/AwardRegistry';
import type { AwardDart } from '../../../features/awards/domain/types';

const registry = new AwardRegistry();
const evaluator = new AwardEvaluator();

export default function CameraAwardTestScreen() {
  const [queue] = useState(() => new AwardQueue());
  const [version, setVersion] = useState(0);
  const current = queue.getCurrent();
  const asset = current ? registry.get(current.code) : null;
  const samples = useMemo(
    () => [
      { label: 'LOW TON', darts: makeScoreTurn([60, 40, 20]) },
      { label: 'HIGH TON', darts: makeScoreTurn([60, 60, 30]) },
      { label: 'HAT TRICK', darts: makeBullTurn(false) },
      { label: 'THREE IN THE BLACK', darts: makeBullTurn(true) },
      { label: 'WHITE HORSE', darts: makeWhiteHorseTurn() },
    ],
    [],
  );

  return (
    <ScreenShell>
      <SectionTitle
        title="Award Test"
        subtitle="ブラウザ開始後の音声・演出有効化操作を想定したテスト画面です。"
      />
      <Card>
        <SectionTitle
          title="音声・演出を有効化"
          subtitle="実アセット接続まではfallback animationを再生します。"
          tone="card"
        />
        <View style={styles.actionGrid}>
          {samples.map((sample) => (
            <AppButton
              key={sample.label}
              label={sample.label}
              onPress={() => {
                queue.enqueue(
                  evaluator.evaluateTurn({
                    darts: sample.darts,
                    context: {
                      mode: sample.label === 'WHITE HORSE' ? 'cricket' : 'count_up',
                      playbackOwner: 'camera_pc',
                    },
                  }),
                );
                setVersion((currentVersion) => currentVersion + 1);
              }}
              variant="secondary"
            />
          ))}
        </View>
      </Card>
      <Card>
        <SectionTitle title="再生キュー" subtitle={`queue version ${version}`} tone="card" />
        <AwardOverlay
          event={current}
          asset={asset}
          onSkip={() => {
            queue.skip();
            setVersion((currentVersion) => currentVersion + 1);
          }}
        />
      </Card>
    </ScreenShell>
  );
}

function makeScoreTurn(scores: number[]): AwardDart[] {
  return scores.map((score) => ({
    area: score === 60 ? 'triple' : 'single',
    segmentNumber: score === 60 ? 20 : score,
    multiplier: score === 60 ? 3 : 1,
    score,
  }));
}

function makeBullTurn(innerOnly: boolean): AwardDart[] {
  return [0, 1, 2].map((index) => ({
    area: innerOnly || index > 0 ? 'inner_bull' : 'outer_bull',
    segmentNumber: null,
    multiplier: innerOnly || index > 0 ? 2 : 1,
    score: innerOnly || index > 0 ? 50 : 25,
  }));
}

function makeWhiteHorseTurn(): AwardDart[] {
  return [20, 19, 18].map((segmentNumber) => ({
    area: 'triple',
    segmentNumber,
    multiplier: 3,
    score: segmentNumber * 3,
    cricketMarks: 3,
    isCricketTarget: true,
  }));
}

const styles = StyleSheet.create({
  actionGrid: {
    gap: 10,
    marginTop: 12,
  },
});
