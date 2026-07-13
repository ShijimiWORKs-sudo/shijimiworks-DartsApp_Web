# DartsApp Codex Phase 3 実装指示書

- フェーズ: Phase 3 単独01ゲーム縦断実装
- 文書バージョン: 1.0
- ローカル作業先: `C:\制作データ\10_App\DartsApp`
- リポジトリ: `ShijimiWORKs-sudo/shijimiworks-DartsApp_Web`
- 作業ブランチ: `codex/phase-3-zero-one`
- ベース: Phase 2 COUNT-UPマージ済みの`main`
- 実装対象: 単独01（1人用）
- 並列実装: 条件付きで必須

---

## 1. 目的

Phase 1のSQLiteゲーム基盤と、Phase 2のCOUNT-UP縦断実装を維持したまま、
単独01について次の導線を実機確認可能な状態まで完成させてください。

```text
ゲームハブ
→ 01設定
→ 01プレイ
→ BUST / CHECKOUT / 15ラウンド上限
→ 01結果
→ 一時停止・再開・途中終了
```

今回実装する01は1人用です。

今回は次へ着手しません。

- STANDARD CRICKET
- MATCH
- CHOICE
- DartsApp Rating計算
- 2人用01
- DOUBLE OUT
- 確定済み過去ターン訂正画面
- 写真採点のゲーム入力接続
- PracticeRecord Outbox consumer

---

## 2. 仕様書の優先順位

次を実装基準とします。

1. `docs/specs/DartsApp_詳細設計書_v1.0.md`
2. `docs/specs/DartsApp_DB設計書_v1.0.md`
3. `docs/specs/DartsApp_DB_v1_schema.sql`
4. `docs/specs/DartsApp_画面遷移設計書_v1.0.md`
5. `docs/specs/DartsApp_Rating計算モジュール仕様書_v1.0.md`
6. 本指示書

優先規則:

- DB列・制約・index: DB設計書とSQL
- ルート・戻る動作・復元先: 画面遷移設計書
- 01ルール・BUST・CHECKOUT: 詳細設計書
- 単独01のRating除外: 本指示書とRating仕様書
- 並列作業・Git運用・作業範囲: 本指示書

矛盾を見つけた場合は、独断で仕様を広げず
`docs/implementation/OPEN_QUESTIONS.md`へ記録してください。
影響のない範囲は継続して構いません。

---

## 3. 最優先ルール

1. 既存COUNT-UPを壊さない。
2. 既存MVPの練習、写真採点、分析、相談、資料、設定を壊さない。
3. ゲーム判定をReact画面へ直書きしない。
4. SQLiteをゲームデータの正本とする。
5. AsyncStorageの単一AppStateへ投擲データを追加しない。
6. `git reset --hard`、force push、履歴改変をしない。
7. 未追跡ファイルを削除しない。
8. 指定外の大規模リファクタリングをしない。
9. 新規依存パッケージは原則追加しない。
10. DARTSLIVE / PHOENIXの非公開ロジックや公式素材を複製しない。
11. 今回は単独01のみ。CRICKET / MATCH / Ratingへ進まない。
12. 最後に実機確認前のDraft PRを作成し、mainへ自動マージしない。

---

## 4. 作業開始

```powershell
cd "C:\制作データ\10_App\DartsApp"
git status
git remote -v
git fetch origin
```

未commit変更がある場合:

- 消さない
- stashしない
- 内容を報告して停止する
- 未追跡の仕様書やCodex指示書は削除しない

変更がなければ:

```powershell
git switch main
git pull --ff-only origin main
git switch codex/phase-3-zero-one
```

ローカルにブランチがない場合:

```powershell
git switch --track origin/codex/phase-3-zero-one
```

作業前baseline:

```powershell
npm run typecheck
npm test
npm run validate:data
```

baseline失敗時は実装へ進まず報告してください。

---

# 5. 並列作業方針

## 5.1 基本原則

作業開始前に、依存関係と変更対象ファイルを確認してください。

Codexのsubagent、並列thread、worktree機能が利用できる場合、
以下の分担で並列実行してください。

利用できない場合は、同じ作業パッケージを記載順に直列実行してください。
並列化のために品質や整合性を落としてはいけません。

### 禁止

- 同じファイルを複数Agentが同時編集する
- migrationとそれに依存する実装を未確定のまま同時変更する
- 共通型を各Agentが独自変更する
- 各Agentが個別にremote pushする
- 複数PRを作る
- 統合前にmainへmergeする

## 5.2 Stage 0：統合担当が直列で契約を確定

並列実装の前に、統合担当が次を実施してください。

1. 現行COUNT-UP実装とDB schemaを確認
2. 単独01のpublic型を確定
3. 01サービスのpublic APIを確定
4. Agentごとのファイル所有範囲を確定
5. 共有ファイルを凍結

Stage 0で作成・確定する共有ファイル候補:

```text
features/game/domain/zeroOne/types.ts
features/game/application/services/ZeroOneGameServicePort.ts
```

最低public API:

```ts
type ZeroOneStartScore = 301 | 501 | 701 | 901;

type ZeroOneStartInput = {
  startScore: ZeroOneStartScore;
  outRule: 'single_out' | 'master_out';
  bullRule: 'fat_bull' | 'separate_bull';
  ownerName?: string;
};

type ZeroOneGameServicePort = {
  getLastSettings(): Promise<{
    startScore: ZeroOneStartScore;
    outRule: 'single_out' | 'master_out';
    bullRule: 'fat_bull' | 'separate_bull';
  }>;
  getActiveGame(): Promise<ZeroOneGameState | null>;
  listRecentResults(limit?: number): Promise<ZeroOneGameState[]>;
  startGame(input: ZeroOneStartInput): Promise<ZeroOneGameState>;
  loadGame(gameId: string): Promise<ZeroOneGameState>;
  recordDart(gameId: string, input: ZeroOneDartInput): Promise<ZeroOneGameState>;
  undoDart(gameId: string): Promise<ZeroOneGameState>;
  redoDart(gameId: string, dartId: string): Promise<ZeroOneGameState>;
  confirmTurn(
    gameId: string,
    input?: { machineType?: string | null },
  ): Promise<ZeroOneGameState>;
  pauseGame(gameId: string): Promise<ZeroOneGameState>;
  resumeGame(gameId: string): Promise<ZeroOneGameState>;
  abortGame(gameId: string): Promise<void>;
};
```

public型確定後は、Agentが勝手に変更しないでください。
変更が必要な場合は統合担当だけが判断します。

## 5.3 Stage 1：並列作業

### Agent A：01ドメイン

所有ファイル:

```text
features/game/domain/zeroOne/**
tests/game/zeroOneDomain.test.ts
```

ただしStage 0で凍結した`types.ts`は原則変更しません。

担当:

- 基本得点
- SINGLE OUT判定
- MASTER OUT判定
- BUST判定
- CHECKOUT判定
- TURN評価
- 15ラウンド上限評価
- PPD / 3DA
- 結果統計
- 純粋関数テスト

禁止:

- React
- SQLite
- app routes
- Context
- service index
- game hub

### Agent B：SQLite / Application Service

所有ファイル:

```text
features/game/application/services/ZeroOneGameService.ts
features/game/application/services/ZeroOneRedoSession.ts
features/game/application/services/zeroOneLeaveActions.ts
tests/game/zeroOneGameService.test.ts
```

担当:

- start / load
- recordDart
- undo / redo
- confirmTurn
- BUST時の即時ターン終了
- CHECKOUT時の即時ゲーム完了
- 15ラウンド完了
- pause / resume / abort
- 結果保存
- Outbox
- DB冪等性
- serviceテスト

禁止:

- app routes
- game hub
- Context
- services/index.ts
- docs

### Agent C：01画面

所有ファイル:

```text
app/game/01/settings.tsx
app/game/01/[gameId]/index.tsx
app/game/01/[gameId]/result.tsx
components/game/zeroOne/**
```

担当:

- 設定画面
- プレイ画面
- 結果画面
- 入力UI
- BUST表示
- CHECKOUT表示
- 一時停止・再開・途中終了
- iOS swipe-back防止
- Android BackHandler
- screen-session内Redo

Agent CはStage 0の`ZeroOneGameServicePort`だけを参照し、
Contextやservice indexを変更しません。

禁止:

- SQL
- DB migration
- game hub
- Context
- COUNT-UP画面
- docs

### Agent D：受入テスト・監査

所有ファイル:

```text
tests/game/zeroOneAcceptance.test.ts
tests/game/zeroOneRouteGuard.test.ts
```

担当:

- Stage 0契約と仕様の照合
- Agent A/Bの成果を使う統合テスト
- BUST / CHECKOUT / round limit
- pause / resume / abort
- 冪等性
- Rating除外
- Outbox
- route guardを純粋関数化できる場合のテスト

Agent Dは本体コードを変更しません。
不足があれば統合担当へ報告します。

### Agent E：文書

所有ファイル:

```text
README.md
docs/ROUTES.md
docs/ARCHITECTURE.md
docs/implementation/PHASE_3_REPORT.md
```

担当:

- 実装内容の記録
- ルート更新
- アーキテクチャ更新
- Phase 3レポート
- 実機確認項目

文書は未実装機能を「実装済み」と書かないでください。

## 5.4 並列worktree運用

worktree / subagentが利用できる場合の例:

```text
codex/tmp-phase3-domain
codex/tmp-phase3-service
codex/tmp-phase3-ui
codex/tmp-phase3-tests
codex/tmp-phase3-docs
```

規則:

- temporary branchは原則remoteへpushしない
- 各Agentは自分の所有ファイルだけcommit
- 統合担当が`codex/phase-3-zero-one`へcherry-pick
- cherry-pick後に競合と型を解消
- 統合完了後にtemporary worktreeを整理
- remote pushは統合担当が最後に1回行う

## 5.5 Stage 2：統合担当だけが編集する共有ファイル

```text
features/game/application/services/index.ts
contexts/GameDatabaseContext.tsx
app/game/index.tsx
app/home.tsx
features/game/index.ts
```

必要な場合だけ:

```text
components/game/**
```

統合担当の責務:

- `zeroOne` serviceをContextへ接続
- active game判定をモード共通化
- COUNT-UP再開を壊さない
- 01カードを有効化
- 最近の01結果を表示
- 正しいrouteへ復元
- Agent成果のAPI差分解消
- 全テスト
- 実機確認用レポート
- commit / push / Draft PR

---

# 6. 単独01の確定ルール

## 6.1 設定

```text
プレイヤー数: 1
開始点: 301 / 501 / 701 / 901
最大ラウンド: 15
アウト方式: SINGLE OUT / MASTER OUT
ブル方式: FAT BULL / SEPARATE BULL
```

`DOUBLE OUT`は型として保持しますが、
設定画面に表示せず開始不可です。

## 6.2 基本得点

- SINGLE: number
- DOUBLE: number × 2
- TRIPLE: number × 3
- INNER BULL: 50
- FAT BULLのOUTER BULL: 50
- SEPARATE BULLのOUTER BULL: 25
- MISS: 0

入力されたscore値を信用せず、
`area`、`segmentNumber`、`bullRule`から再計算してください。

## 6.3 SINGLE OUT

次でCHECKOUT:

```text
投擲後の残り点 = 0
最後のダーツのarea制限なし
```

次でBUST:

```text
投擲後の残り点 < 0
```

## 6.4 MASTER OUT

次でCHECKOUT:

```text
投擲後の残り点 = 0
かつ最後のダーツが次のいずれか
- double
- triple
- inner_bull
- outer_bull
```

SEPARATE BULLでもOUTER BULLを有効なMASTER OUTとして扱います。

次でBUST:

```text
投擲後の残り点 < 0
または
投擲後の残り点 = 0 だが最後が通常single
```

MASTER OUTでは残り1を即時BUSTにしません。
DOUBLE OUTの残り1ルールを混ぜないでください。

## 6.5 BUST

BUST成立時:

1. その投擲を保存
2. そのTURNを即時終了
3. 残り点をTURN開始時へ戻す
4. TURNの`raw_score`は実投得点
5. TURNの`applied_score`は0
6. `is_bust=1`
7. `status='bust'`
8. DART行は削除しない
9. BUST回数を加算
10. ROUNDを終了
11. 次ROUND / TURNを作成
12. 15ラウンド目ならround limit完了

BUST後は通常Undo不可です。
確定済みターン訂正は別フェーズです。

## 6.6 CHECKOUT

CHECKOUT成立時:

1. 最終DARTを保存
2. TURNを`checkout`
3. `is_checkout=1`
4. 残り点を0
5. ROUNDを完了
6. GAMEをcompleted
7. completion reasonをcheckout
8. 結果を保存
9. Outboxを作成
10. result routeへreplace

CHECKOUT後は追加入力不可です。

## 6.7 通常TURN

- 1～3投
- 3投後はTURN確定候補
- 1～2投でも明示的にTURN終了可能
- TURN確定後にremainingを更新
- ROUNDをcompleted
- 次ROUND / TURNを作成
- ROUND 15確定後、checkoutしていなければround limit完了

空TURNは確定不可です。

## 6.8 15ラウンド上限

ROUND 15終了時にCHECKOUTしていない場合:

```text
status = completed
completion_reason = round_limit
winnerなし
残り点を結果へ保存
```

---

# 7. PPD / 3DAと統計

## 7.1 表示用PPD

```text
PPD = 有効得点 ÷ 実際に投げたダーツ数
3DA = PPD × 3
```

- BUSTターンのDART数は分母へ含める
- BUSTターンの得点は有効得点へ含めない
- milli整数で保持する
- 画面表示は小数第2位までを基本とする

## 7.2 必須統計

- 開始点
- 最終残り点
- completion reason
- CHECKOUT成否
- CHECKOUTラウンド
- CHECKOUTまでの使用ダーツ数
- 有効得点
- PPD
- 3DA
- BUST数
- BULL数
- INNER BULL数
- OUTER BULL数
- TRIPLE数
- DOUBLE数
- MISS数
- 100以上TURN数
- 140以上TURN数
- 180TURN数
- ROUND数
- TURN数
- 実投数
- 手動修正数
- 入力方法別投数
- ROUND別raw score
- ROUND別applied score
- ROUND別残り点

既存列にない詳細は`extra_stats_json`へversion付きで保存します。

推奨:

```json
{
  "schemaVersion": 1,
  "completionReason": "checkout",
  "startScore": 501,
  "finalRemainingScore": 0,
  "rounds": [
    {
      "roundNo": 1,
      "rawScore": 60,
      "appliedScore": 60,
      "startRemaining": 501,
      "endRemaining": 441,
      "result": "confirmed"
    }
  ]
}
```

---

# 8. SQLite保存

## 8.1 migration

現行schemaは単独01を保存可能です。

原則:

- migration 001を変更しない
- schema versionを上げない
- migration 002を追加しない

どうしても列追加が必要な場合は、
先に理由を`OPEN_QUESTIONS.md`へ記載し、
実装を停止して報告してください。

## 8.2 開始時

排他的トランザクションで作成:

### game_sessions

```text
mode = zero_one
status = in_progress
max_rounds = 15
bull_rule = 選択値
out_rule = single_out または master_out
zero_one_start_score = 301 / 501 / 701 / 901
player_count = 1
current_round_no = 1
current_turn_sequence_no = 1
rating_candidate = 0
completion_reason = NULL
```

### game_players

```text
starting_score = startScore
current_remaining_score = startScore
current_total_score = 0
current_cricket_score = 0
result = pending
```

### ROUND 1 / TURN 1

TURN:

```text
start_remaining_score = startScore
end_remaining_score = startScore
status = in_progress
```

OWNERは既存を再利用し、重複作成しません。
OWNERがなければ`PLAYER 1`で作成します。

## 8.3 1投保存

1投ごとに排他的トランザクションで保存します。

- `client_action_id`で冪等
- turn内最大3投
- completed / aborted / invalidへの入力拒否
- 別gameのturnへ混入禁止
- scoreをサーバー側相当のドメイン関数で再計算
- 単独01のDARTは`is_rating_eligible=0`
- `rating_candidate=0`

## 8.4 Undo / Redo

COUNT-UPで確立した方式を踏襲します。

- 現在の未確定TURNだけ
- UndoはDARTを`voided`
- 物理削除しない
- domain eventを保存
- Redo候補は画面メモリ内のdart ID stack
- 画面を離れるとRedo stackをclear
- 一時停止→ハブ→再開後はRedo不可
- 新しい投擲でRedo stackをclear
- TURN確定でRedo stackをclear

BUST / CHECKOUT成立後の確定TURNは通常Undo不可です。

## 8.5 TURN確定

通常TURN:

- active DARTをconfirmed
- raw_scoreを保存
- applied_scoreを保存
- start/end remainingを保存
- dart_countを保存
- status=confirmed
- ROUND completed
- game_playersを更新
- 次ROUND / TURNを作成

BUST:

- raw_scoreは実投合計
- applied_score=0
- end_remaining=start_remaining
- status=bust
- is_bust=1

CHECKOUT:

- end_remaining=0
- status=checkout
- is_checkout=1
- GAME完了へ進む

## 8.6 GAME完了

排他的トランザクションで冪等に:

- game_sessions completed
- game_players completed
- game_player_results upsert
- integration_outbox enqueue
- practice_record_links pending
- domain event
- 二重結果防止
- 二重Outbox防止

---

# 9. Outbox

完了した単独01は`practice_record_upsert`をpendingで作成します。

payload最低項目:

```json
{
  "gameId": "...",
  "mode": "zero_one",
  "completedAt": "...",
  "startScore": 501,
  "finalRemainingScore": 0,
  "completionReason": "checkout",
  "checkoutFlag": true,
  "effectiveScore": 501,
  "ppdMilli": 23857,
  "threeDartAverageMilli": 71571,
  "bustCount": 1,
  "bullCount": 2,
  "outRule": "master_out",
  "bullRule": "fat_bull",
  "machineType": "DARTSLIVE"
}
```

規則:

- GAME単位の固定idempotency key
- 同一GAMEで1件
- `practice_record_links`はpending
- consumerは今回実装しない
- 無理にcompleted / failedへしない

---

# 10. Rating

単独01は正式なDartsApp Rating対象外です。

必須:

```text
game_sessions.rating_candidate = 0
darts.is_rating_eligible = 0
rating_evaluationsを作成しない
rating_snapshotsを作成しない
rating_recalculate Outboxを作成しない
```

結果画面に次を表示します。

```text
単独01はDartsApp Ratingの正式計算対象外です。
```

PPD / 3DAは練習統計として表示します。

---

# 11. 画面・ルート

## 11.1 必須ルート

```text
/game
/game/01/settings
/game/01/[gameId]
/game/01/[gameId]/result
```

## 11.2 ゲームハブ

01カードを有効化:

```text
01 GAME
301 / 501 / 701 / 901
```

active game表示をCOUNT-UP専用型へ固定しないでください。

必要な一般化:

```text
active gameをGameRepositoryまたは共通queryで取得
modeで復元routeを決める
count_up → /game/count-up/[gameId]
zero_one → /game/01/[gameId]
```

COUNT-UPの再開・最近結果を壊さないでください。

最近の結果:

- 最近のCOUNT-UP
- 最近の01

同じカードへ統合しても、モード別sectionでも構いません。

## 11.3 01設定

表示:

- プレイヤー
- 開始点
- アウト方式
- ブル方式
- 最大15ラウンド
- 開始ボタン

初期値:

- PLAYER 1
- 501
- single_out
- fat_bull
- 過去01設定があれば直近値を利用

DOUBLE OUTは表示しないでください。

active gameがある場合は直接作成せず:

- 再開
- 途中終了して新規設定へ
- キャンセル

## 11.4 01プレイ

最優先表示:

- 残り点
- ROUND n / 15
- 現在TURN得点
- TURN開始時残り点
- 入力済みDART
- アウト方式
- ブル方式

操作:

- S1～S20
- D1～D20
- T1～T20
- OUTER BULL
- INNER BULL
- MISS
- 1投戻す
- やり直す
- TURN終了
- 一時停止
- 途中終了
- ゲーム一覧へ

BUST:

- 明確なBUSTバナー
- TURN開始残り点へ戻ったことを表示
- 次ROUNDへ進む
- 追加入力禁止

CHECKOUT:

- CHECKOUT表示
- 残り0
- 追加入力禁止
- 結果へreplace

15R:

- ラウンド上限終了
- 最終残り点
- 結果へreplace

プレイ中BottomNavは非表示です。

## 11.5 戻る操作

COUNT-UPで修正済みの方式を共通化または踏襲します。

- iOS `gestureEnabled: false`
- navigation `beforeRemove`
- Android `BackHandler`
- 明示的な「ゲーム一覧へ」

3択:

1. 一時停止してゲームハブへ戻る
2. ゲームを続ける
3. 途中終了する

Redoは離脱時にclearします。

## 11.6 結果

表示:

- 開始点
- 最終残り点
- CHECKOUT成否
- completion reason
- PPD
- 3DA
- 有効得点
- 実投数
- BUST数
- ROUND数
- BULL / INNER / OUTER
- TRIPLE / DOUBLE / MISS
- 100+ / 140+ / 180
- Outbox状態
- Rating対象外表示

操作:

- 同じ条件でもう一度
- 設定を変えてもう一度
- ゲーム一覧へ

過去GAMEを再利用しません。

---

# 12. Route Guard

`/game/01/[gameId]`:

- 存在しない → `/game`
- modeがzero_one以外 → 正しいmode routeまたは`/game`
- completed → resultへreplace
- aborted / invalid → 入力禁止、`/game`
- paused → 再開確認またはpaused表示
- DB状態をURLより優先

`/game/01/[gameId]/result`:

- completed → 表示
- in_progress / paused → playへreplace
- 存在しない → `/game`
- count_up等別mode → 正しいrouteまたは`/game`

route guard判定は可能なら純粋関数化し、テストしてください。

---

# 13. エラー処理

ユーザーへ技術例外名を表示しないでください。

例:

```text
保存できませんでした。入力内容は画面に残っています。
もう一度お試しください。
```

必要条件:

- 保存中は入力を直列化
- 二重タップ防止
- 保存失敗時に画面入力を消さない
- 完了済みゲームへの追加入力拒否
- 不明gameIdでクラッシュしない
- DB不整合はRating除外
- プレイヤー名、写真URIをログへ不要に出さない

---

# 14. テスト

既存104テストを壊さないでください。

## 14.1 ドメイン

- 301 / 501 / 701 / 901
- S / D / T
- FAT BULL
- SEPARATE BULL
- MISS
- 不正area / segment
- SINGLE OUT checkout
- SINGLE OUT overshoot bust
- MASTER OUT double checkout
- MASTER OUT triple checkout
- MASTER OUT inner bull checkout
- MASTER OUT outer bull checkout
- MASTER OUT single finish bust
- MASTER OUT残り1を即時bustにしない
- bust後remaining復元
- bust raw/applied score
- PPDでbust dartsを分母へ含める
- PPDでbust scoreを有効得点へ含めない
- 3DA
- 100+ / 140+ / 180
- round limit

## 14.2 Service / DB

- start graph
- OWNER重複なし
- active game多重開始拒否
- paused game中の新規開始拒否
- completed / aborted後の新規開始
- 1投保存
- client_action_id冪等
- 最大3投
- completed / abortedへの入力拒否
- Undo物理削除なし
- screen-session Redo
- BUST即時TURN終了
- BUST後次ROUND
- CHECKOUT即時完了
- round15完了
- game_player_results
- PPD / 3DA milli
- Outbox1件
- practice_record_links pending
- Rating評価行なし
- pause / resume
- abort
- 完了処理再実行で重複なし

## 14.3 統合

- settings値がstartへ渡る
- active count_upはCOUNT-UPへ復元
- active zero_oneは01へ復元
- 01 result guard
- COUNT-UP route回帰
- game hubで両modeが表示
- 01単独Rating除外

---

# 15. 実機確認

Codex自身が実機確認できない場合は未実施と明記してください。
虚偽の成功報告は禁止です。

人間側確認シナリオ:

## 15.1 SINGLE OUT

1. 301開始
2. 3投入力
3. TURN確定
4. 残り点更新
5. 一時停止
6. 再開
7. 最後を任意areaで0
8. CHECKOUT
9. 結果確認

## 15.2 MASTER OUT

1. 301 / master_out
2. 通常singleで0にする
3. BUSTになる
4. TURN開始残り点へ戻る
5. doubleまたはtripleで0
6. CHECKOUT

## 15.3 BULL

- FAT OUTER = 50
- FAT INNER = 50
- SEPARATE OUTER = 25
- SEPARATE INNER = 50
- MASTER OUTのOUTER BULLでcheckout可能

## 15.4 Undo / Redo

- 現在TURN内Undo / Redo
- 一時停止→ハブ→再開後Redo無効
- 新規投擲可能
- BUST / CHECKOUT後通常Undo不可

## 15.5 round limit

- テスト補助または短縮データで15R到達を確認
- 最終残り点
- completion reason
- PPD / 3DA

---

# 16. 検証コマンド

Agent個別:

- 自分の関連テスト
- typecheck可能な範囲
- format対象確認

統合担当の最終検証:

```powershell
npm run typecheck
npm run lint
npm run format:check
npm test
npm run validate:data
```

すべて成功させてください。

可能なら次も確認:

```powershell
npx expo export --platform web
```

Web固有問題で失敗した場合は、
iOS / Expo Go対象と分けて正確に報告してください。

---

# 17. ドキュメント

更新:

```text
README.md
docs/ROUTES.md
docs/ARCHITECTURE.md
docs/implementation/PHASE_3_REPORT.md
```

Phase 3レポート:

1. 実装範囲
2. 並列化した作業
3. Agent分担
4. 統合時の競合
5. 変更ファイル
6. 01ルール
7. DB変更の有無
8. migration version
9. Outbox
10. Rating除外
11. テスト結果
12. 実機確認結果
13. 未実装
14. 次フェーズ候補

未解決の仕様不整合だけを`OPEN_QUESTIONS.md`へ追加します。

---

# 18. Git・PR

最終作業ブランチ:

```text
codex/phase-3-zero-one
```

temporary Agent branchはremoteへpushしないでください。

統合後の推奨commit:

```text
feat(game): implement standalone zero-one vertical slice
```

複数commitでも構いませんが、意味のある単位にしてください。

push:

```powershell
git push origin codex/phase-3-zero-one
```

Draft PR:

```text
Title:
Phase 3: standalone 01 vertical slice
```

PR本文:

- Summary
- Parallel work plan
- Routes
- SINGLE OUT
- MASTER OUT
- BUST / CHECKOUT
- Persistence
- Outbox
- Rating exclusion
- Tests
- Manual QA
- Deferred items

mainへ自動マージしないでください。

---

# 19. 完了報告

以下を報告してください。

1. 実装概要
2. 並列作業を実行したか
3. Agentごとの担当と成果
4. 直列にした作業と理由
5. 作成・変更した主要ファイル
6. SINGLE OUT結果
7. MASTER OUT結果
8. BUST結果
9. CHECKOUT結果
10. round limit結果
11. PPD / 3DA結果
12. DB変更とmigration version
13. Outbox / practice_record_links
14. Rating除外
15. 全検証結果
16. テスト総数
17. 実機確認結果
18. 未実装事項
19. ブランチ名
20. 最終commit SHA
21. push結果
22. Draft PR番号とURL

今回はPhase 3で停止し、
CRICKET / MATCH / Ratingへ進まないでください。
