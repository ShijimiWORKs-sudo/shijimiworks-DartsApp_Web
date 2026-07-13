# Phase 4 Report: Account and Rating Source Foundation

## 実装範囲

Phase 4では、Phase 1〜3のSQLiteゲーム基盤、COUNT-UP、単独01を維持したまま、AccountとRating評価基盤を追加する。

対象:

- ローカルAccount登録
- AccountとOWNER Playerの紐付け
- AppState v10 `activeAccountId`
- SQLite migration 002
- Account単位のRating Profile
- MATCH / 単独01 / 単独CRICKETを扱えるRating Evaluation v2
- 単独Rating候補判定
- 既存単独01の `rating_candidate` 判定とpending Evaluation生成
- Home / Game Hub / Account画面の状態表示

対象外:

- STANDARD CRICKET本体
- MATCH本体
- Rating計算本体、Snapshot更新エンジン
- Rating履歴画面の完全実装
- クラウド認証、パスワード認証、本人確認
- Account切替
- 効果音・アワード動画

## 並列作業

Phase 4指示書では、Stage 0で共通型とpublic APIを先に確定し、Agent A〜Eの所有範囲を分けて並列実装する方針とする。

Agent分担:

- Agent A: DB migration 002、Account SQLite Repository、migrationテスト
- Agent B: Account domain / service、Account unit tests
- Agent C: Account UI、Account画面コンポーネント
- Agent D: Rating適格判定、単独01接続、Rating candidate tests
- Agent E: 受入テスト、README、ROUTES、ARCHITECTURE、Phase 4レポート
- 統合担当: AppState / Context / Home / Game Hub統合、全検証、commit、push、Draft PR

Agent Eはコード本体、migration、service、UIを編集しない。統合担当が競合解消と最終検証を行う。

## migration 002

Phase 4のDB targetは `PRAGMA user_version = 2`。

追加・変更:

- `accounts`
- `players.account_id`
- `rating_profiles`
- Account対応 `rating_evaluations`
- Account対応 `rating_snapshots`
- `rating_migration_orphans`
- Account / Rating用index
- `db_migrations.version = 2`

要件:

- migration 001を書き換えない
- 既存GAME / DART / RESULT / Outboxを削除しない
- 既存active OWNERへ `profile_incomplete` Accountを作成して紐付ける
- GUESTへAccountを自動作成しない
- 旧Ratingデータを黙って捨てず、移行不能分はorphan JSONへ保存する
- 冪等に再実行できる
- `PRAGMA foreign_key_check` が0件

## Account仕様

Phase 4のAccountはクラウド認証ではなく、端末内でRating所有者を識別するためのローカルAccount。

登録項目:

- `userName`: 3〜20文字、英小文字・数字・アンダースコア
- `displayName`: 1〜30文字
- `email`: 任意、trimしてlowercase保存

保存:

- `auth_provider = local`
- `status = local_registered`
- パスワードは保存しない
- 「ログイン済み」「本人確認済み」と表示しない

画面説明:

```text
現在はこの端末内でRating所有者を識別するための登録です。
クラウド同期・本人確認は今後対応予定です。
```

## Rating Profile

Account登録またはOWNER紐付け時に `rating_profiles` を作成または取得する。

初期値:

- `measurement_status = unmeasured`
- `rating_tenths = NULL`
- `confidence_bp = 0`
- `eligible_match_count = 0`
- `established_at = NULL`

GUESTにはRating Profileを作成しない。

## Eligibility

単独Rating候補判定:

- COUNT-UP: 常に対象外
- zero_one: Account登録済み、OWNER紐付け済み、Rating確定済み、GAME開始が `established_at` 以降なら候補
- cricket: Phase 4では将来接続用の判定のみ
- dojo / cricket_count_up: 対象外
- GUEST: 対象外

除外理由:

- `ACCOUNT_NOT_REGISTERED`
- `ACCOUNT_NOT_ACTIVE`
- `OWNER_NOT_LINKED`
- `INITIAL_RATING_NOT_ESTABLISHED`
- `GAME_BEFORE_RATING_ESTABLISHED`
- `UNSUPPORTED_STANDALONE_MODE`

Rating確定前の単独ゲームは、Rating確定後に遡及して有効化しない。

## 単独01接続

開始時:

- 適格なら `game_sessions.rating_candidate = 1`
- 不適格でもGAME開始は拒否しない
- 不適格理由はGAME側のJSONへ保存する

完了時:

- `rating_candidate = 1` かつ再検証成功ならpending `rating_evaluations` を1件作成
- `source_type = standalone_zero_one`
- `source_game_id = gameId`
- `source_weight_milli = 500`
- `rating_evaluation_games` を1件作成
- `rating_recalculate` Outboxを1件作成
- Rating計算とSnapshot作成は行わない

冪等:

- 同一GAME完了処理の再実行でEvaluation、`rating_recalculate` Outbox、PracticeRecord Outboxを重複させない

## AppState v10

追加:

```ts
activeAccountId: string | null;
```

要件:

- v9以前からのmigrationでは `null`
- 既存プロフィール、記録、写真スコア、相談履歴、表示設定を維持
- DBに存在しないAccount IDは `null` へ修復
- Account未登録でもアプリとゲームを利用できる

## テスト

Agent E追加:

- `tests/game/accountRatingAcceptance.test.ts`

受入観点:

- migration 002がuser_version 2へ上がる
- Account / Rating v2テーブルと `players.account_id` が存在する
- OWNERはAccountへ紐づき、GUESTはAccountなし
- Rating確定済みAccountの単独01完了でpending Evaluationと `rating_recalculate` Outboxが作られる
- SnapshotはPhase 4では作られない
- COUNT-UPはRating対象外のまま

統合担当が追加・確認する検証:

- `npm run typecheck`
- `npm run lint`
- `npm run format:check`
- `npm test`
- `npm run validate:data`
- 可能なら `npx expo export --platform web`

最終検証結果:

- `npm run typecheck`: 成功
- `npm run lint`: 成功
- `npm run format:check`: 成功
- `npm test`: 成功、138件
- `npm run validate:data`: 成功
- `npx expo export --platform web`: `expo-sqlite` の `wa-sqlite.wasm` 解決不可により失敗

## 実機確認

Codexによる実機確認は未実施。人間側で以下を確認する。

- HomeからAccount登録できる
- userName / displayName / 任意emailを登録できる
- ProfileへOWNER紐付けとRating状態が表示される
- アプリ再起動後もactive Account状態が維持される
- 01設定にRating対象外または対象表示が出る
- Account未登録でも01を開始・完了できる
- 既存COUNT-UPと01再開が壊れていない

## 未実装

Phase 4対象外として残すもの:

- STANDARD CRICKET本体
- MATCH本体
- Rating計算本体
- Snapshot更新エンジン
- Rating履歴画面の完全実装
- クラウド認証
- パスワード認証
- Account切替
- 効果音・アワード動画

## 次フェーズ候補

- Phase 5: 単独STANDARD CRICKET
- MATCH導線
- Rating計算とSnapshot適用
- Rating履歴画面
- PracticeRecord Outbox consumer
