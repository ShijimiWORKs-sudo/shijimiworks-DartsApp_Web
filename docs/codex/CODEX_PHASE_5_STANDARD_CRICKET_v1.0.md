# DartsApp Codex Phase 5 実装指示書

- フェーズ: Phase 5 単独STANDARD CRICKET縦断実装
- 文書バージョン: 1.0
- ローカル作業先: `C:\制作データ\10_App\DartsApp`
- リポジトリ: `ShijimiWORKs-sudo/shijimiworks-DartsApp_Web`
- 作業ブランチ: `codex/phase-5-standard-cricket`
- ベース: Phase 4マージ済み`main`
- 並列実装: 条件付きで必須

---

## 1. 目的

Phase 1～4で完成したSQLiteゲーム基盤、COUNT-UP、単独01、Account・Rating評価基盤を維持したまま、単独STANDARD CRICKETについて次の縦断機能を完成させてください。

```text
ゲームハブ
→ CRICKET設定
→ CRICKETプレイ
→ 全7ターゲットCLOSEかつ1点以上で自然終了
   または15ラウンド上限
→ CRICKET結果
→ 一時停止・再開・途中終了
```

対象ターゲット:

```text
20 / 19 / 18 / 17 / 16 / 15 / BULL
```

最重要仕様:

```text
全ターゲットをCLOSEしても、CRICKET得点が0点なら上がりではない。
得点が1点以上になるまで、15ラウンド以内はゲームを継続する。
```

今回は単独CRICKETだけを実装します。

### 対象外

- MATCH内CRICKET
- MATCH / CHOICE
- Rating計算本体・Snapshot適用エンジン
- クラウド認証
- 写真・カメラ入力
- 音声ファイルの再生
- アワード動画の再生
- 過去の確定TURN訂正
- PracticeRecord Outbox consumer

---

## 2. 仕様の正本

次を必ず最初から最後まで確認してください。

1. `docs/specs/DartsApp_詳細設計書_v1.1.md`
2. `docs/specs/DartsApp_DB設計書_v1.1.md`
3. `docs/specs/DartsApp_画面遷移設計書_v1.1.md`
4. `docs/specs/DartsApp_Rating計算モジュール仕様書_v1.1.md`
5. 本指示書
6. 既存のCOUNT-UP・01・Account実装

優先順位:

- ゲームルール: 詳細設計書v1.1
- DB列・制約: DB設計書v1.1、migration 001/002、現行schema
- ルート・戻る動作: 画面遷移設計書v1.1
- Rating候補: Rating仕様書v1.1とPhase 4実装
- 並列作業・Git運用・実装範囲: 本指示書

v1.0とv1.1が矛盾する場合はv1.1を優先してください。

---

## 3. 最優先ルール

1. 既存COUNT-UP、単独01、Account復旧を壊さない。
2. `Database is locked`修正を後退させない。
3. ゲーム画面へSQLやマーク計算を直書きしない。
4. SQLiteをゲームデータの正本とする。
5. CRICKETの0点自然終了を絶対に認めない。
6. 15ラウンド0点終了は正常クリアではなく`round_limit`・`clearFlag=false`とする。
7. Account未登録でもCRICKETはプレイ可能とする。
8. Rating未確定でも記録・分析は保存する。
9. Rating確定後のAccount OWNERだけを単独CRICKET評価候補にできる。
10. GUESTへRating Evaluationを作らない。
11. migration 001/002を書き換えない。
12. 新migrationは原則作らない。
13. `git reset --hard`、force push、履歴改変は禁止。
14. 未追跡資料・音源・動画・ライセンス資料を削除、stash、commitしない。
15. `git add .`、`git add -A`は禁止。
16. mainへ直接commit・mergeしない。

---

## 4. 作業開始

```powershell
cd "C:\制作データ\10_App\DartsApp"
git status --short
git remote -v
git fetch origin
```

未commitの追跡変更がある場合は、削除・stashせず内容を報告して停止してください。

次の未追跡資料は、そのまま維持します。

```text
Context/
DartsApp_DB_v1_schema.sql
docs/codex/DartsApp_Codex_Phase2_COUNT_UP_v1.0.md
assets/audio/
assets/video/
docs/licenses/
```

未追跡資料が増減していても、Phase 5対象でなければ触らないでください。

作業ブランチ:

```powershell
git switch main
git pull --ff-only origin main
git switch codex/phase-5-standard-cricket
```

ローカルにない場合:

```powershell
git switch --track origin/codex/phase-5-standard-cricket
```

baseline:

```powershell
npm run typecheck
npm test
npm run validate:data
```

既存149テストを基準にし、baselineが失敗する場合は実装へ進まず報告してください。

---

# 5. 並列作業方針

## 5.1 Stage 0：統合担当が直列で契約を確定

並列作業前に、統合担当が次を確定してください。

- CRICKETのpublic domain型
- CRICKET Application Service Port
- 0点自然終了禁止の状態遷移
- Rating候補との接続境界
- Agentごとのファイル所有権

共有契約候補:

```text
features/game/domain/cricket/types.ts
features/game/application/services/CricketGameServicePort.ts
```

最低限のpublic API:

```ts
type CricketTarget = '20' | '19' | '18' | '17' | '16' | '15' | 'BULL';

type CricketStartInput = {
  bullRule: 'fat_bull' | 'separate_bull';
  ownerName?: string;
};

type CricketGameServicePort = {
  getLastSettings(): Promise<{ bullRule: 'fat_bull' | 'separate_bull' }>;
  getActiveGame(): Promise<CricketGameState | null>;
  listRecentResults(limit?: number): Promise<CricketGameState[]>;
  startGame(input: CricketStartInput): Promise<CricketGameState>;
  loadGame(gameId: string): Promise<CricketGameState>;
  recordDart(gameId: string, input: CricketDartInput): Promise<CricketGameState>;
  undoDart(gameId: string): Promise<CricketGameState>;
  redoDart(gameId: string, dartId: string): Promise<CricketGameState>;
  confirmTurn(
    gameId: string,
    input?: { machineType?: string | null },
  ): Promise<CricketGameState>;
  pauseGame(gameId: string): Promise<CricketGameState>;
  resumeGame(gameId: string): Promise<CricketGameState>;
  abortGame(gameId: string): Promise<void>;
};
```

Stage 0で確定した共有型を各Agentが独自変更してはいけません。

## 5.2 Stage 1：並列作業

### Agent A：CRICKETドメイン

所有ファイル:

```text
features/game/domain/cricket/**
tests/game/cricketDomain.test.ts
```

担当:

- ターゲット判定
- 基本マーク換算
- CLOSE・Over Mark計算
- 単独CRICKET得点
- 全CLOSE判定
- 0点自然終了禁止
- 15ラウンド判定
- MPR・結果統計
- 効果音IDの純粋判定境界
- 純粋関数テスト

禁止:

- React
- SQLite
- Context
- app routes
- service index

### Agent B：SQLite / Application Service

所有ファイル:

```text
features/game/application/services/CricketGameService.ts
features/game/application/services/CricketGameServicePort.ts
features/game/application/services/CricketRedoSession.ts
features/game/application/services/cricketLeaveActions.ts
tests/game/cricketGameService.test.ts
```

担当:

- start / load
- recordDart
- undo / redo
- confirmTurn
- 自然終了
- round limit
- pause / resume / abort
- `cricket_number_states`
- `game_player_results`
- PracticeRecord Outbox
- Rating候補Evaluation
- 冪等性
- Serviceテスト

禁止:

- app routes
- game hub
- Context
- `services/index.ts`
- docs

### Agent C：CRICKET画面

所有ファイル:

```text
app/game/cricket/settings.tsx
app/game/cricket/[gameId]/index.tsx
app/game/cricket/[gameId]/result.tsx
components/game/cricket/**
```

担当:

- 設定画面
- プレイ画面
- 7ターゲット表示
- CLOSE・マーク・得点表示
- 0点全CLOSE時の継続表示
- 結果画面
- Undo / Redo
- pause / resume / abort
- iOS / Android戻る制御
- 画面セッション内Redo

禁止:

- SQL
- migration
- game hub
- Context
- COUNT-UP / 01画面
- 音源・動画import

### Agent D：受入・回帰テスト

所有ファイル:

```text
tests/game/cricketAcceptance.test.ts
tests/game/cricketRouteGuard.test.ts
tests/game/cricketRatingCandidate.test.ts
```

担当:

- 0点自然終了禁止
- 1点以上で自然終了
- 15R round limit
- MPR
- Rating候補
- Accountなし・未確定・確定済み
- Route Guard
- COUNT-UP・01・Account回帰

本体コードを変更せず、不足は統合担当へ報告してください。

### Agent E：ドキュメント

所有ファイル:

```text
README.md
docs/ROUTES.md
docs/ARCHITECTURE.md
docs/implementation/PHASE_5_REPORT.md
```

未実装内容を実装済みと記載しないでください。

## 5.3 Stage 2：統合担当だけが変更する共有ファイル

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

統合担当は次を行います。

- `services.cricket`登録
- active gameを3モード共通化
- CRICKETカード有効化
- 最近のCRICKET結果追加
- Account・Rating状態の表示
- Agent成果の型統合
- 全体テスト
- commit / push / Draft PR

## 5.4 並列化できない場合

subagent、worktree、並列threadが利用できない場合は、同じ作業パッケージをA→B→C→D→E→統合の順に直列実行してください。

同じファイルを複数Agentが同時編集することは禁止します。

---

# 6. CRICKETルール

## 6.1 ゲーム設定

```text
プレイヤー数: 1人
対象: 20 / 19 / 18 / 17 / 16 / 15 / BULL
最大ラウンド: 15
ブル方式: FAT BULL / SEPARATE BULL
アウト方式: なし
```

ブル方式は通常得点表示・音響境界に利用しますが、CRICKETマークは次で固定します。

```text
OUTER BULL = 1マーク
INNER BULL = 2マーク
```

## 6.2 基本マーク

| 命中 | CRICKETマーク |
|---|---:|
| 対象SINGLE | 1 |
| 対象DOUBLE | 2 |
| 対象TRIPLE | 3 |
| OUTER BULL | 1 |
| INNER BULL | 2 |
| 20～15以外 | 0 |
| MISS | 0 |

対象外ナンバーへの命中もDART記録として保存します。

## 6.3 CLOSE・Over Mark・得点

各ターゲットは累積3マークでCLOSEします。

例:

```text
現在20が2マーク
→ T20（3マーク）
→ 1マークでCLOSE
→ 残り2 Over Mark
→ 40点加算
```

単独CRICKETでは、CLOSE済みターゲットへの追加マークを得点化します。

```text
20～15: Over Mark × ターゲット番号
BULL: Over Mark × 25
```

`cricket_number_states.marks_total`は3を超えて保持して構いません。
`is_closed`は3以上で1です。

## 6.4 自然終了

次の両方を満たした投擲時点で自然終了します。

```text
全7ターゲットがCLOSE
AND
current_cricket_score > 0
```

自然終了は3投目まで待たず、条件を成立させたDARTで即時確定します。

```text
completion_reason = all_closed_with_score
clearFlag = true
```

追加入力は禁止します。

## 6.5 0点上がり禁止

次は終了条件ではありません。

```text
全7ターゲットCLOSE
AND
current_cricket_score = 0
```

この状態では、画面に次を明確に表示してください。

```text
全ナンバーCLOSE
得点が1点以上になるまでゲーム継続
```

同じTURNに投数が残っていれば入力を継続できます。
CLOSE済みターゲットへOver Markを入れ、得点が1点以上になった投擲で自然終了します。

## 6.6 15ラウンド上限

15ラウンド目のTURN確定時に自然終了していなければ完了します。

```text
completion_reason = round_limit
clearFlag = false
```

次のどちらもround limitです。

- 全CLOSE・0点
- 未CLOSEあり（得点の有無は問わない）

0点round limitはMPR評価候補として利用できます。
自然クリアとして扱ってはいけません。

## 6.7 TURN

- 1～3投
- 3投後はTURN確定候補
- 1～2投でも手動終了可能
- 空TURNは確定不可
- 自然終了条件成立時だけ3投未満で自動完了
- 通常TURN確定後に次ROUND / TURNを作成

---

# 7. 状態再計算

Undo・Redo・保存失敗で状態が壊れないよう、CRICKET状態はDART履歴から決定論的に再構築できるようにしてください。

推奨:

```text
active/confirmed DART
→ TURN順・dart_no順に再生
→ cricket_number_states再構築
→ current_cricket_score再構築
→ closed count再構築
```

増分更新を採用する場合も、検証・訂正用の純粋な再構築関数を必ず用意してください。

必須整合性:

- voided DARTはマーク・得点へ含めない
- client_action_id重複は二重加算しない
- Undo後にCLOSE・得点が戻る
- Redo後に同じ結果へ戻る
- アプリ再起動後も同じ状態を復元する

---

# 8. 統計・MPR

## 8.1 MPR

```text
MPR = 有効CRICKETマーク合計 ÷ 確定TURN数
```

有効マーク:

- 対象ターゲットへの1 / 2 / 3マーク
- CLOSE後のOver Markも含む
- 対象外・MISSは0
- voided / invalidatedは0

自然終了で短縮されたTURNも1TURNです。
1～2投で手動終了したTURNも1TURNです。

内部保存:

```text
mpr_milli = round(MPR × 1000)
```

## 8.2 必須統計

- 総CRICKET得点
- 総有効マーク
- MPR
- CLOSE数
- clearFlag
- completion reason
- ラウンド数
- TURN数
- 実投数
- 20～15/BULL別マーク総数
- 20～15/BULL別CLOSEラウンド
- 20～15/BULL別得点
- BULLマーク
- SINGLE / DOUBLE / TRIPLE数
- MISS数
- 5マーク以上TURN
- 7マーク以上TURN
- 9マークTURN
- 入力方法別投数
- 手動修正数

既存列にない詳細は`extra_stats_json`へversion付きで保存します。

推奨構造:

```json
{
  "schemaVersion": 2,
  "completionReason": "all_closed_with_score",
  "clearFlag": true,
  "finalCricketScore": 20,
  "targets": {
    "20": {
      "marksTotal": 4,
      "closedAtRoundNo": 3,
      "pointsScored": 20
    }
  }
}
```

---

# 9. SQLite保存

## 9.1 migration

現行`user_version = 2`のschemaで実装可能です。

原則:

- migration 001を変更しない
- migration 002を変更しない
- user_versionを上げない
- migration 003を作らない

不足が判明した場合は、実装を止めて`OPEN_QUESTIONS.md`へ理由を記載し報告してください。

## 9.2 GAME開始

1つの排他トランザクションで作成します。

### game_sessions

```text
mode = cricket
status = in_progress
max_rounds = 15
bull_rule = 選択値
out_rule = NULL
zero_one_start_score = NULL
player_count = 1
current_round_no = 1
current_turn_sequence_no = 1
current_player_id = OWNER
rating_candidate = Phase 4判定結果
config_json.version = 2
```

### game_players

```text
starting_score = NULL
current_remaining_score = NULL
current_total_score = 0
current_cricket_score = 0
result = pending
```

### cricket_number_states

7行を作成します。

```text
20 / 19 / 18 / 17 / 16 / 15 / BULL
marks_total = 0
is_closed = 0
points_scored = 0
```

### ROUND 1 / TURN 1

通常のin_progress状態で作成します。

OWNERが存在する場合は必ず再利用してください。
Account未登録でもOWNER Playerは利用できます。

## 9.3 1投保存

1投ごとに排他トランザクションで保存します。

- 得点はarea・segment・bullRuleから再計算
- cricket_marksはCRICKETルールから再計算
- client_action_idで冪等
- turn内最大3投
- completed / aborted / invalidへ入力拒否
- 別gameのTURN混入禁止
- `is_rating_eligible`はGAMEのrating_candidateに合わせる
- 入力後に自然終了条件を評価する

## 9.4 TURN確定

保存項目:

```text
turns.cricket_marks_total
turns.cricket_points_scored
turns.dart_count
turns.status = confirmed または game_end
rounds.status
game_players.current_cricket_score
game_players.darts_thrown
game_players.turns_confirmed
cricket_number_states
```

自然終了では`game_end`等、既存CHECK制約内の適切なstatusを使ってください。

## 9.5 GAME完了

排他的トランザクションで冪等に:

- game_sessions completed
- completion_reason
- game_players completed
- game_player_results upsert
- PracticeRecord Outbox 1件
- practice_record_links pending
- Rating Evaluation候補
- domain event
- 二重完了・二重Outbox・二重Evaluation防止

---

# 10. Rating候補

## 10.1 開始時判定

既存`StandaloneRatingCandidateService`を利用します。

```ts
buildGameStartDecision({
  mode: 'cricket',
  ownerPlayerId: owner.id,
  gameStartedAt: now,
});
```

表示・保存:

- Account未登録: candidate 0
- 初回3MATCH未完了: candidate 0
- Rating確定済みOWNER: candidate 1
- COUNT-UPは変更しない

## 10.2 完了時再検証

完了時にも次を確認してください。

- Accountが有効
- OWNER紐付け維持
- `established_at`あり
- GAME開始がestablished_at以降
- GAME completed
- データ整合
- source revision最新

一時的なDBロックではAccount状態を削除しないでください。

## 10.3 pending Evaluation

candidate 1かつ完了時も適格な場合だけ、冪等に作成します。

```text
source_type = standalone_cricket
source_game_id = gameId
source_match_id = NULL
source_weight_milli = 500
cricket_game_count = 1
cricket_mpr_milli = result.mprMilli
zero_one_game_count = 0
match_result = NULL
status = pending
candidate_flag = 1
```

0点round limitでもMPRデータが整合していれば候補にできます。

次は不正です。

```text
completion_reason = all_closed_with_score
AND
final_cricket_score = 0
```

この場合はEvaluationをeligibleにせず、除外理由として
`INVALID_CRICKET_ZERO_POINT_CLEAR`を記録可能な構造にしてください。

Rating計算・Snapshot更新は今回行いません。

---

# 11. PracticeRecord Outbox

完了GAMEごとに`practice_record_upsert`を1件だけpendingで作成します。

payload最低項目:

```json
{
  "version": 2,
  "gameId": "...",
  "mode": "cricket",
  "completedAt": "...",
  "completionReason": "all_closed_with_score",
  "clearFlag": true,
  "finalCricketScore": 20,
  "marksTotal": 25,
  "mprMilli": 2500,
  "closedNumberCount": 7,
  "bullRule": "fat_bull",
  "machineType": "DARTSLIVE",
  "ratingExcluded": false
}
```

- GAME単位の固定idempotency key
- practice_record_links pending
- consumerは今回実装しない

---

# 12. 画面・ルート

## 12.1 必須ルート

```text
/game
/game/cricket/settings
/game/cricket/[gameId]
/game/cricket/[gameId]/result
```

## 12.2 ゲームハブ

CRICKETカードを有効化します。

```text
STANDARD CRICKET
20～15 / BULL
最大15ラウンド
```

active game型を次の3モードへ拡張します。

```text
count_up
zero_one
cricket
```

復元ルート:

```text
count_up → /game/count-up/[gameId]
zero_one → /game/01/[gameId]
cricket → /game/cricket/[gameId]
```

最近のCRICKET結果も追加してください。

## 12.3 設定画面

表示:

- プレイヤー
- ブル方式
- 20～15 / BULL
- 最大15ラウンド
- Rating対象状態
- 開始ボタン

Rating表示例:

```text
Rating対象: 確定済みAccount
Rating対象外: 初回3MATCH未完了
Rating対象外: Account未登録
Account確認中
```

Account未登録でも開始ボタンは利用可能です。

## 12.4 プレイ画面

最優先表示:

- 現在ラウンド / 15
- CRICKET得点
- 暫定MPR
- 20～15 / BULLのマーク状態
- CLOSE状態
- 現在TURNのDART
- 現在TURNのマーク・得点
- Rating対象状態

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

マーク表示は色だけに依存せず、数値・記号・アクセシビリティラベルを併用してください。

全CLOSE0点時:

```text
全ナンバーCLOSE
得点が1点以上になるまでゲーム継続
```

を表示します。

プレイ中BottomNavは非表示です。

## 12.5 戻る操作

COUNT-UP・01と同じ方式を踏襲します。

- iOS `gestureEnabled: false`
- navigation `beforeRemove`
- Android `BackHandler`
- 明示的なゲーム一覧ボタン

3択:

1. 一時停止してゲームハブへ戻る
2. ゲームを続ける
3. 途中終了する

離脱時にRedo stackをclearします。

## 12.6 結果画面

表示:

- completion reason
- clear / not clear
- 最終CRICKET得点
- 総有効マーク
- MPR
- CLOSE数
- ラウンド数
- 投数
- ターゲット別マーク・CLOSEラウンド・得点
- BULL / DOUBLE / TRIPLE / MISS
- 5 / 7 / 9マークTURN
- Rating対象・候補状態
- PracticeRecord連携状態

操作:

- 同じ条件でもう一度
- 設定を変えてもう一度
- ゲーム一覧へ

過去GAMEを再利用しません。

---

# 13. Route Guard

`/game/cricket/[gameId]`:

- 存在しない → `/game`
- modeがcricket以外 → 正しいrouteまたは`/game`
- completed → resultへreplace
- aborted / invalid → 入力禁止、`/game`
- paused → 再開処理
- DB状態をURLより優先

`/game/cricket/[gameId]/result`:

- completed → 表示
- in_progress / paused → playへreplace
- 存在しない → `/game`
- 別mode → 正しいrouteまたは`/game`

---

# 14. 効果音・アワード境界

今回は音源・動画を再生しません。
`assets/audio`、`assets/video`は未追跡のまま触らないでください。

ただし、将来接続用の純粋なイベント判定境界は作成可能です。

命中音ID:

```ts
type DartHitSoundId =
  | 'inner_bull'
  | 'outer_bull'
  | 'normal_hit'
  | 'cricket_double'
  | 'cricket_triple'
  | null;
```

CRICKET対象20～15のDOUBLE / TRIPLEだけ、

```text
cricket_double
cricket_triple
```

を返します。

BULLはinner / outerを優先し、対象外ナンバーのD/Tはnormal_hitです。

MP3 import、Audio API、動画再生は行わないでください。

---

# 15. エラー処理・ロック対策

Phase 4で導入したAccount・SQLiteロック対策を維持してください。

- 非同期effectの未処理Promise禁止
- SQLITE_BUSY / SQLITE_LOCKEDでAccountを削除しない
- DB書込みは排他トランザクション
- 画面入力は保存中に直列化
- 二重タップ防止
- 保存失敗時に入力表示を消さない
- 技術例外を一般画面へそのまま表示しない
- finalize漏れを起こさない
- Account bootstrapとゲーム開始transactionを競合させない

---

# 16. 必須テスト

既存149テストを壊さないでください。

## 16.1 Domain

- 対象S/D/T = 1/2/3マーク
- OUTER / INNER BULL = 1/2
- 対象外・MISS = 0
- 2マーク状態へT20 → CLOSE + 2 Over Mark + 40点
- 0マーク状態へT20 → CLOSE・0点
- CLOSE済み20へS20 → 20点
- CLOSE済みBULLへINNER → 50点
- 全CLOSE・0点 → 継続
- 全CLOSE・既存得点あり → 自然終了
- 全CLOSE0点からOver Mark得点 → 自然終了
- 最終ターゲット2マークへD → CLOSE + 1 Over Markで自然終了
- round15全CLOSE0点 → round_limit・clear false
- round15未CLOSE → round_limit・clear false
- MPR
- 5 / 7 / 9マークTURN
- 効果音ID境界

## 16.2 Service / DB

- GAME graph作成
- 7 target state作成
- OWNER重複なし
- active game多重開始拒否
- client_action_id冪等
- DART最大3本
- 状態再構築
- Undoで物理削除なし
- Redo
- pause / resume / abort
- 自然終了即時完了
- 0点全CLOSEで追加入力可能
- round15完了
- result upsert
- Outbox1件
- practice_record_links pending
- completed / abortedへの入力拒否
- 完了処理再実行で重複なし

## 16.3 Rating

- Accountなし candidate 0
- 3MATCH未確定 candidate 0
- established Account OWNER candidate 1
- GUEST candidate 0
- established_at以前のGAME除外
- candidate 1の完了でpending standalone_cricket Evaluation
- source_weight_milli 500
- 0点round limitのMPR評価候補
- 0点自然clearを不正扱い
- Rating Snapshotを今回作成しない

## 16.4 回帰

- COUNT-UP開始・再開・結果
- 単独01開始・BUST・CHECKOUT
- Account再起動復旧
- テーマ変更でDatabase is lockedが出ない
- active gameルート3モード
- migration 002再実行
- foreign_key_check

---

# 17. 実機確認

Codexが実機確認できない場合は未実施と明記してください。

人間側で最低限確認するシナリオ:

## A. CLOSE・得点

```text
T20 → 20 CLOSE・得点0
S20 → 得点20
```

## B. 0点上がり禁止

全7ターゲットをちょうど3マークでCLOSEし、得点0にします。

確認:

```text
結果画面へ進まない
全CLOSE0点の継続案内
追加入力可能
CLOSE済みターゲットへの得点で自然終了
```

## C. round limit

MISSを1投→TURN終了を15ラウンド繰り返します。

確認:

```text
round limit
clear false
MPR 0.000
```

## D. Undo / Redo・再開

```text
投擲
→ Undo
→ Redo
→ pause
→ ハブ
→ 再開
→ Redo無効
→ 状態復元
```

## E. Account / Rating表示

- Account未登録
- Rating未確定Account
- Rating確定済みテスト状態

の3状態で設定画面の案内が正しいこと。

---

# 18. 検証コマンド

Agent個別では関連テストを実行します。

統合後:

```powershell
npm run typecheck
npm run lint
npm run format:check
npm test
npm run validate:data
```

すべて成功させてください。

Web exportの既知の`expo-sqlite` WASM問題は、今回のCRICKET実装とは分けて正確に報告してください。

---

# 19. ドキュメント

更新:

```text
README.md
docs/ROUTES.md
docs/ARCHITECTURE.md
docs/implementation/PHASE_5_REPORT.md
```

Phase 5レポート:

1. 実装範囲
2. 並列化の有無
3. Agent担当
4. 0点上がり禁止
5. CLOSE / Over Mark / 得点
6. MPR
7. DB変更の有無
8. migration version
9. Rating候補
10. Outbox
11. テスト結果
12. 実機確認
13. 未実装
14. 次フェーズ候補

仕様不整合だけを`OPEN_QUESTIONS.md`へ追加してください。

---

# 20. Git・PR

作業ブランチ:

```text
codex/phase-5-standard-cricket
```

推奨commit:

```text
feat(game): implement standalone standard cricket
```

Phase 5対象ファイルだけを明示的にstageしてください。

```text
git add . 禁止
git add -A 禁止
```

push:

```powershell
git push origin codex/phase-5-standard-cricket
```

Draft PR:

```text
Title:
Phase 5: standalone standard cricket
```

PR本文:

- Summary
- Parallel work plan
- Routes
- Marks / CLOSE / Over Mark
- No zero-point natural finish
- Round limit
- MPR
- Persistence
- Rating candidate
- Outbox
- Tests
- Manual QA
- Deferred items

mainへ自動マージしないでください。

---

# 21. 完了報告

以下を報告してください。

1. 実装概要
2. 並列作業を実行したか
3. Agentごとの担当と成果
4. 直列にした作業と理由
5. 主要変更ファイル
6. マーク換算結果
7. CLOSE / Over Mark / 得点結果
8. 0点自然終了禁止の結果
9. round limit結果
10. MPR結果
11. Undo / Redo / pause / resume結果
12. DB変更とuser_version
13. Rating候補・Evaluation結果
14. Outbox結果
15. 全検証結果
16. テスト総数
17. 実機確認結果
18. 未実装事項
19. ブランチ名
20. 最終commit SHA
21. push結果
22. Draft PR番号とURL

今回はPhase 5で停止し、MATCH、Rating計算本体、音声・動画再生へ進まないでください。
