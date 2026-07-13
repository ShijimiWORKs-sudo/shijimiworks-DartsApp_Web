# DartsApp Codex Phase 4 実装指示書

- フェーズ: Phase 4 Account・Rating評価基盤
- 文書バージョン: 1.0
- ローカル作業先: `C:\制作データ\10_App\DartsApp`
- リポジトリ: `ShijimiWORKs-sudo/shijimiworks-DartsApp_Web`
- 作業ブランチ: `codex/phase-4-account-rating-foundation`
- ベース: Phase 3マージ済み`main`
- 並列実装: 条件付きで必須

---

## 1. 目的

Phase 1～3で完成したSQLiteゲーム基盤、COUNT-UP、単独01を維持したまま、次を実装してください。

1. ローカルAccount登録
2. AccountとOWNER Playerの紐付け
3. AppState v10の`activeAccountId`
4. SQLite migration 002
5. Account単位のRating Profile
6. MATCH・単独01・単独CRICKETを扱えるRating Evaluation v2
7. Rating確定前／確定後の単独ゲーム適格判定
8. 既存単独01の`rating_candidate`判定とpending Evaluation生成
9. Home・ゲームハブ・Account画面の状態表示

今回はAccount・Rating評価基盤だけを実装します。

### 今回対象外

- STANDARD CRICKETのゲーム画面・得点処理
- MATCHのゲーム実装
- Rating数式の最終適用・Snapshot更新エンジン
- Rating履歴画面の完全実装
- クラウド認証
- パスワード認証
- メール確認
- 複数端末同期
- Account切替
- 音声・アワード動画組込み

---

## 2. 必読資料

優先順位:

1. `docs/specs/DartsApp_詳細設計書_v1.1.md`
2. `docs/specs/DartsApp_DB設計書_v1.1.md`
3. `docs/specs/DartsApp_画面遷移設計書_v1.1.md`
4. `docs/specs/DartsApp_Rating計算モジュール仕様書_v1.1.md`
5. 本指示書
6. v1.0仕様書

v1.0とv1.1が矛盾する場合はv1.1を優先してください。

---

## 3. 最優先ルール

- 既存COUNT-UP・単独01を壊さない
- 既存ゲーム履歴・投擲・結果を消さない
- migration 001を書き換えない
- migration 002は前進・冪等にする
- パスワードを保存しない
- ローカルAccountをクラウド認証済みと表示しない
- Account未登録でもゲームを遊べる
- GUESTへ正式Ratingを作らない
- Rating計算本体へ先行しない
- CRICKET / MATCH本体へ着手しない
- `git reset --hard`、force push、履歴改変禁止
- 未追跡資料を削除・stash・commitしない
- `git add .`と`git add -A`を使用しない
- mainへ直接commitしない
- 完了後はDraft PRで停止する

---

## 4. 作業開始

```powershell
cd "C:\制作データ\10_App\DartsApp"
git status --short
git fetch origin
git switch main
git pull --ff-only origin main
git switch codex/phase-4-account-rating-foundation
```

ローカルにない場合:

```powershell
git switch --track origin/codex/phase-4-account-rating-foundation
```

未追跡資料がある場合:

- 削除しない
- stashしない
- 内容を変更しない
- commitしない
- Phase 4対象ファイルだけ明示的にaddする

baseline:

```powershell
npm run typecheck
npm test
npm run validate:data
```

失敗時は実装へ進まず報告してください。

---

# 5. 並列作業計画

## 5.1 Stage 0：統合担当が直列で契約確定

先に次を確認・確定してください。

- migration 002のテーブル名・列名
- Account public型
- AccountRepository / AccountService API
- RatingEligibility API
- AppState v10型
- Agentごとの所有ファイル

共有契約候補:

```text
features/account/domain/types.ts
features/account/application/AccountServicePort.ts
features/game/domain/rating/eligibilityTypes.ts
```

共有契約確定後は、各Agentが独自変更しないでください。

## 5.2 Agent A：DB・migration

所有範囲:

```text
features/game/infrastructure/sqlite/migrations/002_account_rating_foundation.ts
features/game/infrastructure/sqlite/migrations/index.ts
features/account/infrastructure/sqlite/**
tests/game/accountRatingMigration.test.ts
```

担当:

- migration 002
- accounts
- players.account_id
- rating_profiles
- rating_evaluations v2
- rating_snapshots v2
- migration orphan保存
- index
- foreign key check
- migration再実行テスト

禁止:

- React画面
- AppState
- 既存GAMEサービス
- docs

## 5.3 Agent B：Account domain・service

所有範囲:

```text
features/account/domain/**
features/account/application/**
features/account/index.ts
tests/account/**
```

担当:

- user_name検証
- email normalize
- Account登録
- 既存OWNER紐付け
- profile更新
- active Account取得
- Rating Profile初期化
- Account未完了・登録済み状態

禁止:

- migration
- React画面
- AppStateContext
- game services

## 5.4 Agent C：Account UI

所有範囲:

```text
app/account/register.tsx
app/account/profile.tsx
app/account/rating-status.tsx
components/account/**
```

担当:

- ローカルAccount登録画面
- Accountプロフィール
- Rating測定状態
- クラウド未対応説明
- 入力エラー
- 戻る動作

禁止:

- SQL
- migration
- Home
- Game Hub
- Context

## 5.5 Agent D：Rating適格判定・単独01接続

所有範囲:

```text
features/game/domain/rating/eligibility/**
features/game/application/services/StandaloneRatingCandidateService.ts
features/game/application/services/ZeroOneGameService.ts
tests/game/standaloneRatingEligibility.test.ts
tests/game/zeroOneRatingCandidate.test.ts
```

担当:

- Account登録状態判定
- 3MATCH確定判定
- established_at判定
- 単独01開始時rating_candidate
- 単独01完了時pending Evaluation
- `rating_recalculate` Outbox
- Rating未確定時の除外理由保存
- COUNT-UPが常に除外である回帰確認

禁止:

- Rating数式適用
- Snapshot生成
- CRICKET実装
- MATCH実装
- React画面

## 5.6 Agent E：テスト監査・文書

所有範囲:

```text
tests/game/accountRatingAcceptance.test.ts
README.md
docs/ROUTES.md
docs/ARCHITECTURE.md
docs/implementation/PHASE_4_REPORT.md
```

担当:

- 受入テスト
- migration・Account・01接続の仕様照合
- 文書更新
- 未実装の明示

本体コードを変更しないでください。

## 5.7 Stage 2：統合担当だけが編集

```text
contexts/AppStateContext.tsx
contexts/GameDatabaseContext.tsx
features/game/application/services/index.ts
app/home.tsx
app/game/index.tsx
app/_layout.tsx
README.md（競合時）
```

統合担当:

- AppState schemaVersion 10
- activeAccountId
- Account serviceをContextへ接続
- Home Accountカード
- Game Hub Rating対象状態
- route登録
- Agent成果統合
- 全検証
- commit / push / Draft PR

## 5.8 並列制約

- 同じファイルを複数Agentが同時編集しない
- temporary branchはremoteへpushしない
- 各AgentがPRを作らない
- 統合担当のみ最終pushする
- worktree利用時も未追跡資料をコピーしない

---

# 6. Account仕様

## 6.1 登録項目

- `userName`: 必須、3～20文字
- 使用可能: `a-z`, `0-9`, `_`
- `displayName`: 必須、1～30文字
- `email`: 任意、trim・lowercaseして保存

Phase 4では:

```text
auth_provider = local
status = local_registered
```

パスワード入力欄を作らないでください。

## 6.2 画面説明

必ず表示:

```text
現在はこの端末内でRating所有者を識別するための登録です。
クラウド同期・本人確認は今後対応予定です。
```

「ログイン済み」「本人確認済み」と誤表示しないでください。

## 6.3 既存OWNER

migration 002で既存OWNERへ`profile_incomplete` Accountを作成・紐付けます。

Account登録画面で同じOWNERを再利用し、OWNERを重複作成しないでください。

## 6.4 GUEST

- account_idはNULL
- Rating Profile作成禁止
- Rating Evaluation作成禁止

---

# 7. AppState v10

追加:

```ts
activeAccountId: string | null;
```

migration:

```text
schemaVersion 9 → 10
activeAccountId = null
```

SQLite初期化後、active OWNERに紐づくAccountが1件なら設定してよい。

DBに存在しないIDはnullへ修復します。

既存プロフィール・記録を失わないでください。

---

# 8. SQLite migration 002

仕様書どおり実装してください。

必須:

- `accounts`
- `players.account_id`
- `rating_profiles`
- Account対応`rating_evaluations`
- Account対応`rating_snapshots`
- `rating_migration_orphans`
- index
- `db_migrations.version=2`
- `PRAGMA user_version=2`

## 8.1 既存Ratingデータ

黙って削除しない。

- OWNERに紐付け可能: 移行
- GUEST・Account不明: orphan JSON保存

## 8.2 冪等性

- 初回実行成功
- 2回目実行で重複Accountを作らない
- テーブル・index重複エラーなし
- 既存19テーブルのゲームデータ維持

## 8.3 DB検証

- foreign key check 0件
- active OWNER 1件
- OWNER accountリンク1件
- GUEST accountなし
- user_version 2

---

# 9. Rating Profile基盤

Account登録・OWNER紐付け時に`rating_profiles`を作成または取得します。

初期値:

```text
measurement_status = unmeasured
rating_tenths = NULL
confidence_bp = 0
eligible_match_count = 0
established_at = NULL
```

Phase 4ではRating数式適用を行わないでください。

テスト用に、Repository経由で確定済みProfileをseed可能にします。

---

# 10. 単独Rating適格判定

純粋関数または独立Serviceで実装してください。

入力:

- Account
- OWNER Player
- Rating Profile
- GAME mode
- GAME startedAt

出力:

```ts
type StandaloneRatingEligibility = {
  eligible: boolean;
  ratingCandidate: 0 | 1;
  reasonCode:
    | null
    | 'ACCOUNT_NOT_REGISTERED'
    | 'ACCOUNT_NOT_ACTIVE'
    | 'OWNER_NOT_LINKED'
    | 'INITIAL_RATING_NOT_ESTABLISHED'
    | 'GAME_BEFORE_RATING_ESTABLISHED'
    | 'UNSUPPORTED_STANDALONE_MODE';
};
```

ルール:

- count_up: 常に0
- zero_one: Rating確定後のみ1
- cricket: Rating確定後のみ1（将来接続用）
- dojo / cricket_count_up: 0
- GUEST: 0

Rating確定前の単独履歴を後で遡及しない。

---

# 11. 単独01接続

## 11.1 開始時

`ZeroOneGameService.startGame`でAccount・Rating Profileを確認します。

- 適格: `rating_candidate=1`
- 不適格: `rating_candidate=0`

不適格でもGAME開始を拒否しない。

除外理由を`config_json`へ保存:

```json
{
  "rating": {
    "candidate": false,
    "reasonCode": "INITIAL_RATING_NOT_ESTABLISHED"
  }
}
```

## 11.2 完了時

`rating_candidate=1`かつ再検証成功なら:

- `rating_evaluations`へpending 1件
- `source_type=standalone_zero_one`
- `source_game_id=gameId`
- `source_weight_milli=500`
- PPD / darts / qualityを保存
- `rating_evaluation_games`へ1件
- `rating_recalculate` Outboxを1件

Rating計算・Snapshot作成はまだしない。

不適格:

- Evaluationを作らない
- 既存PracticeRecord Outboxは維持

## 11.3 冪等

同一GAME完了処理を再実行しても:

- Evaluation 1件
- rating_recalculate Outbox 1件
- PracticeRecord Outbox 1件

---

# 12. Account画面

## 12.1 `/account/register`

- userName
- displayName
- email任意
- 入力検証
- 重複userNameエラー
- 登録完了後activeAccountId設定
- OWNER紐付け

## 12.2 `/account/profile`

- userName
- displayName
- email
- local_registered表示
- OWNER名
- Rating状態
- クラウド連携は「準備中」

## 12.3 `/account/rating-status`

- 未測定
- Eligible MATCH 0/3
- 単独Rating対象外
- 確定済みseed時は単独対象可

---

# 13. Home・Game Hub

## 13.1 Home

Account未登録:

```text
アカウント登録でRatingの所有者を保存できます
```

登録済み:

- displayName
- Rating測定状態
- Profileへの導線

## 13.2 Game Hub

各モード:

- COUNT-UP: Rating対象外
- 01: Account / Profile状態を表示
- CRICKET: 準備中だが将来のRating状態説明は不要

01表示:

- Accountなし: `Rating対象外: Account未登録`
- 3MATCH未完了: `Rating対象外: 初回測定前`
- 確定済み: `Rating対象`

既存再開・結果表示を壊さない。

---

# 14. テスト

既存116テストを壊さないでください。

## 14.1 migration

- v1 → v2
- user_version 2
- 既存OWNERへAccount
- OWNER重複なし
- GUESTへAccountなし
- GAME / DART件数維持
- Rating旧データ移行
- orphan保存
- migration再実行
- foreign key check

## 14.2 Account

- userName正常
- 大文字拒否またはnormalize方針統一
- 不正文字拒否
- 3文字未満・20文字超拒否
- displayName
- email normalize
- userName重複
- Account登録とOWNER紐付け同一transaction
- Profile初期作成

## 14.3 AppState

- v9 → v10
- activeAccountId null
- 既存データ維持
- 不正Account ID修復

## 14.4 Eligibility

- Accountなし
- profile_incomplete
- local_registered + 未確定
- eligible_match_count 2
- eligible_match_count 3 + established_at
- startedAtがestablished_at前
- count_up除外
- zero_one適格
- cricket適格判定関数
- GUEST除外

## 14.5 01接続

- 未確定でrating_candidate 0
- 確定済みseedでrating_candidate 1
- candidate 0でもGAME可能
- candidate 1完了でEvaluation pending
- rating_recalculate Outbox
- 二重完了で重複なし
- PPD保存
- Snapshotは作られない
- COUNT-UP回帰

---

# 15. 検証コマンド

```powershell
npm run typecheck
npm run lint
npm run format:check
npm test
npm run validate:data
```

可能なら:

```powershell
npx expo export --platform web
```

すべての結果を正確に報告してください。

---

# 16. 実機確認

Codexが実機確認できない場合は未実施と明記してください。

人間確認項目:

1. HomeからAccount登録
2. userName・表示名登録
3. Profile表示
4. アプリ再起動後もactive Account維持
5. 01設定に「初回測定前」表示
6. 01を開始・完了できる
7. Account未登録相当でもゲームはブロックされない
8. 既存COUNT-UP・01再開が正常

Rating確定済み状態はテストseedまたは開発用fixtureで確認し、本番UIへ不正なデバッグ操作を残さない。

---

# 17. 文書

更新:

```text
README.md
docs/ROUTES.md
docs/ARCHITECTURE.md
docs/implementation/PHASE_4_REPORT.md
```

Report:

- 実装範囲
- 並列作業
- migration 002
- Account仕様
- Rating Profile
- 01接続
- テスト
- 実機確認
- 未実装
- 次フェーズ

次フェーズ候補:

```text
Phase 5: 単独STANDARD CRICKET
```

---

# 18. Git・PR

作業ブランチ:

```text
codex/phase-4-account-rating-foundation
```

推奨commit:

```text
feat(account): add local account and rating source foundation
```

Phase 4対象ファイルだけ明示的にaddしてください。

push後、Draft PR:

```text
Phase 4: account and rating source foundation
```

PR本文:

- Summary
- Parallel work
- Migration v2
- Account
- Rating Profile
- Eligibility
- Standalone 01 integration
- Tests
- Manual QA
- Deferred

mainへマージしないでください。

---

# 19. 完了報告

1. 実装概要
2. 並列実行の有無
3. Agent分担
4. migration結果
5. テーブル・index
6. Account登録
7. OWNER紐付け
8. AppState v10
9. Rating Profile
10. Eligibility結果
11. 01 candidate / Evaluation / Outbox
12. COUNT-UP回帰
13. テスト総数
14. 全検証結果
15. 実機確認結果
16. 未実装
17. ブランチ
18. 最終commit SHA
19. push結果
20. Draft PR

今回はPhase 4で停止し、CRICKET / MATCH / Rating計算本体へ進まないでください。
