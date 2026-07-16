import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import { AwardEvaluator } from '../../features/awards/application/AwardEvaluator';
import { AwardQueue } from '../../features/awards/application/AwardQueue';
import { AwardRegistry } from '../../features/awards/application/AwardRegistry';
import type { AwardDart } from '../../features/awards/domain/types';

const evaluator = new AwardEvaluator();

test('Award Engine evaluates LOW TON and HIGH TON ranges', () => {
  assert.equal(evaluate(makeScoreTurn([60, 40, 20]), 'count_up'), 'LOW_TON');
  assert.equal(evaluate(makeScoreTurn([60, 60, 30]), 'count_up'), 'HIGH_TON');
});

test('Award Engine prioritizes THREE IN THE BLACK over HAT TRICK', () => {
  assert.equal(evaluate(makeBullTurn(true), 'count_up'), 'THREE_IN_THE_BLACK');
  assert.equal(evaluate(makeBullTurn(false), 'count_up'), 'HAT_TRICK');
});

test('Award Engine evaluates WHITE HORSE only for three different valid cricket targets', () => {
  assert.equal(evaluate(makeWhiteHorseTurn(), 'cricket'), 'WHITE_HORSE');
  assert.equal(
    evaluate(
      [
        {
          area: 'triple',
          segmentNumber: 20,
          multiplier: 3,
          score: 60,
          cricketMarks: 3,
          isCricketTarget: true,
        },
        {
          area: 'triple',
          segmentNumber: 20,
          multiplier: 3,
          score: 60,
          cricketMarks: 3,
          isCricketTarget: true,
        },
        {
          area: 'triple',
          segmentNumber: 18,
          multiplier: 3,
          score: 54,
          cricketMarks: 3,
          isCricketTarget: true,
        },
      ],
      'cricket',
    ),
    'HIGH_TON',
  );
});

test('Award Registry completes all awards with fallback animation and no committed assets', () => {
  const registry = new AwardRegistry();
  const assets = registry.list();

  assert.equal(assets.length, 13);
  assert.ok(assets.every((asset) => asset.fallbackAnimation.length > 0));
  assert.ok(assets.every((asset) => asset.videoUri === null));
  assert.ok(assets.every((asset) => asset.audioUri === null));
});

test('Award Queue deduplicates by awardId and plays one current award at a time', () => {
  const queue = new AwardQueue();
  const event = evaluator.evaluateTurn({
    darts: makeScoreTurn([60, 40, 20]),
    context: { mode: 'count_up', playbackOwner: 'camera_pc' },
    now: new Date('2026-07-16T00:00:00.000Z'),
  });

  assert.equal(queue.enqueue(event), true);
  assert.equal(queue.enqueue(event), false);
  assert.equal(queue.size(), 1);
  assert.equal(queue.getCurrent()?.code, 'LOW_TON');
  assert.equal(queue.skip(), null);
});

test('Award routes and component expose enable, skip, and fallback playback', () => {
  const root = process.cwd();
  const index = readFileSync(path.join(root, 'app/camera/awards/index.tsx'), 'utf8');
  const testRoute = readFileSync(path.join(root, 'app/camera/awards/test.tsx'), 'utf8');
  const overlay = readFileSync(path.join(root, 'components/awards/AwardOverlay.tsx'), 'utf8');

  assert.match(index, /Award Registry/);
  assert.match(testRoute, /音声・演出を有効化/);
  assert.match(overlay, /fallback/);
  assert.match(overlay, /スキップ/);
});

function evaluate(darts: AwardDart[], mode: 'count_up' | 'cricket') {
  return evaluator.evaluateTurn({
    darts,
    context: { mode, playbackOwner: 'camera_pc' },
    now: new Date('2026-07-16T00:00:00.000Z'),
  }).code;
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
