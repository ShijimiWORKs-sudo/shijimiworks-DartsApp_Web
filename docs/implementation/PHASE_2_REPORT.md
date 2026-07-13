# Phase 2 Report: COUNT-UP Vertical Slice

## Scope

Phase 2ではCOUNT-UPのみを実装しました。01、CRICKET、MATCH、Rating計算/表示には着手していません。

## 変更概要

- ホームに「ゲームを始める」と進行中COUNT-UPの再開カードを追加
- `/game`、`/game/count-up/settings`、`/game/count-up/[gameId]`、`/game/count-up/[gameId]/result` を追加
- COUNT-UPドメイン計算と `CountUpGameService` を追加
- SQLite v1 schemaをそのまま利用し、migration versionの追加やDBスキーマ変更は行っていません
- 完了済みCOUNT-UPは `game_player_results` に保存し、PracticeRecord連携は `integration_outbox` / `practice_record_links` のpendingとして保持

## COUNT-UP仕様

- 8ラウンド、1プレイヤー、手入力のみ
- Bull設定は `fat_bull` と `separate_bull`
- `fat_bull`: Outer Bull / Inner Bull ともに50点
- `separate_bull`: Outer Bull 25点、Inner Bull 50点
- undo/redoは `darts.status` の更新で実現し、物理削除しない
- `client_action_id` で投擲入力の冪等性を担保
- COUNT-UPは `rating_candidate = 0`、各dartも `is_rating_eligible = 0`

## DB / Outbox

- migration version: 1 のまま
- テーブル数: 19件を維持
- アクティブGAME一意制約 `uq_game_sessions_single_active` により、進行中/一時停止中ゲームは1件まで
- 完了時に `integration_outbox.event_type = 'practice_record_upsert'` をpendingで作成
- 完了時に `practice_record_links.sync_status = 'pending'` を作成

## テスト

追加:

- `tests/game/countUpDomain.test.ts`
- `tests/game/countUpGameService.test.ts`

確認内容:

- COUNT-UPスコア計算とBull設定
- 開始時の初期レコード作成
- in_progress / paused のアクティブGAME多重起動防止
- completed / aborted 後に新しいCOUNT-UPを開始可能
- `client_action_id` の冪等性
- undo/redoでdart行を物理削除しないこと
- 8ラウンド完了時のresult、Outbox pending、PracticeRecord link pending
- completed / aborted 後の追加入力拒否
- migration再実行と19テーブル維持は既存migrationテストで継続確認

## 検証結果

- `npm run typecheck`: pass
- `npm run lint`: pass
- `npm run format:check`: pass
- `npm test`: pass, 100 tests
- `npm run validate:data`: pass

## 実機確認

実機確認は未実施です。Expo Goで確認する場合は、ホームからゲームハブ、COUNT-UP設定、プレイ、結果画面までを確認してください。

## Deferred

- 01 GAME
- CRICKET
- MATCH
- Rating計算/表示
- Outbox pendingからAsyncStorage PracticeRecordへの実同期処理
