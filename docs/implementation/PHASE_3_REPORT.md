# Phase 3 Report: Standalone 01

## 実装範囲

Phase 3では、Phase 1のSQLiteゲーム基盤とPhase 2のCOUNT-UP実装を維持したまま、1人用の単独01を追加する。

対象導線:

- `/game`
- `/game/01/settings`
- `/game/01/[gameId]`
- `/game/01/[gameId]/result`

対象外:

- STANDARD CRICKET
- MATCH
- CHOICE
- DartsApp Rating計算
- 2人用01
- DOUBLE OUT
- 確定済み過去ターン訂正画面
- PracticeRecord Outbox consumer

## 並列作業

Phase 3指示書では、共通型とpublic APIを先に確定し、ファイル所有範囲を分けて並列実装する方針とする。

Agent分担:

- Agent A: 01ドメインロジック、純粋関数テスト
- Agent B: SQLite / Application Service、serviceテスト
- Agent C: 01画面、入力UI、戻る制御、画面セッション内Redo
- Agent D: 受入テスト、route guardテスト
- Agent E: README、ROUTES、ARCHITECTURE、Phase 3レポート
- 統合担当: Context接続、game hub、home、service index、全検証、commit、push、Draft PR

統合時の競合:

- Agent Aはドメイン実装途中で本線へ移管し、以後レビュー専用へ切り替えた。
- Agent C/DはUI、route guard、Redo、戻る制御の観点整理を実施した。
- Agent Eはドキュメント更新案を作成した。
- 統合担当が共通型/API、SQLite service、画面、共有導線、テスト、文書を最終統合した。
- 同一ファイルの同時編集競合はなし。

## 変更ファイル

ドキュメント:

- `README.md`
- `docs/ROUTES.md`
- `docs/ARCHITECTURE.md`
- `docs/implementation/PHASE_3_REPORT.md`

コード、テスト、統合ファイルの最終一覧は統合担当が追記する。

コード:

- `app/game/01/settings.tsx`
- `app/game/01/[gameId]/index.tsx`
- `app/game/01/[gameId]/result.tsx`
- `app/game/index.tsx`
- `app/home.tsx`
- `contexts/GameDatabaseContext.tsx`（Prettier整形のみ）
- `features/game/application/services/ZeroOneGameService.ts`
- `features/game/application/services/ZeroOneGameServicePort.ts`
- `features/game/application/services/ZeroOneRedoSession.ts`
- `features/game/application/services/zeroOneLeaveActions.ts`
- `features/game/application/services/index.ts`
- `features/game/domain/zeroOne/index.ts`
- `features/game/domain/zeroOne/scoring.ts`
- `features/game/domain/zeroOne/types.ts`
- `.prettierignore`
- `.prettierrc`

テスト:

- `tests/game/zeroOneDomain.test.ts`
- `tests/game/zeroOneGameService.test.ts`

## 01ルール

設定:

- プレイヤー数: 1
- 開始点: 301 / 501 / 701 / 901
- 最大ラウンド: 15
- アウト方式: SINGLE OUT / MASTER OUT
- Bull方式: FAT BULL / SEPARATE BULL

SINGLE OUT:

- 投擲後の残り点が0ならCHECKOUT
- 投擲後の残り点が0未満ならBUST

MASTER OUT:

- 投擲後の残り点が0、かつ最後のdartがdouble、triple、inner_bull、outer_bullのいずれかならCHECKOUT
- 投擲後の残り点が0未満、または通常singleで0にした場合はBUST
- 残り1を即時BUSTにしない

BUST:

- BUSTしたdart行は保存する
- TURNを即時終了する
- 残り点はTURN開始時へ戻す
- `raw_score` は実投得点、`applied_score` は0
- dart行、domain event、監査情報は物理削除しない

CHECKOUT:

- 最終dartを保存する
- TURNをcheckoutにする
- GAMEをcompletedにする
- 結果とOutboxを作成する

Round limit:

- 15ラウンド終了時にCHECKOUTしていない場合、`completion_reason = round_limit` で完了する
- 最終残り点を結果へ保存する

## DB変更

Phase 3では現行v1 schemaを利用する方針。

- migration追加: なし
- schema version更新: なし
- v1 migration: `features/game/infrastructure/sqlite/migrations/001_initial.ts`
- SQL正本: `docs/specs/DartsApp_DB_v1_schema.sql`

列追加は不要だったため、Phase 3のDB未解決事項は発生していない。

## Outbox

単独01の完了時は `practice_record_upsert` をpendingで作成する。

最低payload:

- `gameId`
- `mode = zero_one`
- `completedAt`
- `startScore`
- `finalRemainingScore`
- `completionReason`
- `checkoutFlag`
- `effectiveScore`
- `ppdMilli`
- `threeDartAverageMilli`
- `bustCount`
- `bullCount`
- `outRule`
- `bullRule`
- `machineType`

`practice_record_links` はpendingで作成する。consumerはPhase 3では実装しない。

## Rating除外

単独01はDartsApp Ratingの正式計算対象外。

- `game_sessions.rating_candidate = 0`
- `darts.is_rating_eligible = 0`
- `rating_evaluations` を作成しない
- `rating_snapshots` を作成しない
- `rating_recalculate` Outboxを作成しない

PPD / 3DAは練習統計として表示する。

## テスト結果

統合担当が最終検証後に記録する。

- `npm run typecheck`: 成功
- `npm run lint`: 成功
- `npm run format:check`: 成功
- `npm test`: 成功（116件）
- `npm run validate:data`: 成功

## 実機確認

Codexによる実機確認は未実施。人間側で以下を確認する。

- SINGLE OUT checkout
- MASTER OUT checkout
- MASTER OUT single finish bust
- FAT BULL / SEPARATE BULL
- BUST後のremaining復元
- Undo / Redo
- 一時停止、再開、途中終了
- 15ラウンド上限
- 結果画面のPPD / 3DA
- Rating対象外表示

## 未実装

Phase 3対象外として残すもの:

- STANDARD CRICKET
- MATCH
- CHOICE
- Rating計算
- 2人用01
- DOUBLE OUT
- 確定済み過去ターン訂正
- PracticeRecord Outbox consumer

## 次フェーズ候補

- STANDARD CRICKET縦断実装
- MATCH導線
- Rating計算と表示
- Outbox consumer
- 確定済みターン訂正
