# DartsApp Codex Phase 6 実装指示書

- フェーズ: Phase 6 2人対戦MATCH縦断実装
- 文書バージョン: 1.0
- ローカル作業先: `C:\制作データ\10_App\DartsApp`
- リポジトリ: `ShijimiWORKs-sudo/shijimiworks-DartsApp_Web`
- 作業ブランチ: `codex/phase-6-match`
- ベース: Phase 5 STANDARD CRICKET・共通Account契約マージ済み`main`
- DB基準: migration 001 → 002 → 003、`PRAGMA user_version = 3`
- 並列実装: 条件付きで必須

---

## 1. 目的

Phase 1～5で完成したSQLiteゲーム基盤、COUNT-UP、単独01、単独STANDARD CRICKET、Account・Rating評価候補基盤、共通Account契約を維持したまま、次の2人対戦MATCHを完成させてください。

```text
ゲームハブ
→ MATCH設定
→ GAME 1: 501または701
→ GAME 2: STANDARD CRICKET
→ 1勝1敗ならCHOICE
→ GAME 3: GAME 1と同じ01またはSTANDARD CRICKET
→ 先に2勝したプレイヤーがMATCH勝者
→ MATCH結果
→ Rating Evaluation候補
→ CommonEvent / CommonOutbox(local_only)
```

今回対象外:

- Rating計算式の適用
- Rating Snapshot更新
- DartsSupportApp通信
- クラウド同期
- USBカメラ / OpenCV / AI判定
- 効果音・アワード動画再生
- オンライン対戦
- 3人以上の対戦
- DOUBLE OUT

---

## 2. 優先資料

1. `docs/specs/DartsApp_詳細設計書_v1.1.md`
2. `docs/specs/DartsApp_DB設計書_v1.1.md`
3. `docs/specs/DartsApp_画面遷移設計書_v1.1.md`
4. `docs/specs/DartsApp_Rating計算モジュール仕様書_v1.1.md`
5. `docs/specs/Darts_Common_Account_Data_Contract_v1.0.md`
6. 本指示書
7. 既存Phase 1～5実装

最優先ルール:

- COUNT-UP、単独01、単独CRICKETを壊さない
- Account復旧・SQLite lock対策を壊さない
- migration 001～003を変更しない
- migration 004を追加しない
- `PRAGMA user_version = 3`を維持
- MATCH判定をReact画面へ直書きしない
- SQLiteを正本にする
- `git reset --hard`、force push、`git add .`、`git add -A`禁止
- 未追跡資料を削除・変更・stash・commitしない
- mainへ自動マージしない

---

## 3. 作業開始

```powershell
cd "C:\制作データ\10_App\DartsApp"
git status --short
git fetch origin
git switch main
git pull --ff-only origin main
git switch codex/phase-6-match
git pull --ff-only origin codex/phase-6-match
git branch --show-current
```

既知の未追跡資料:

```text
Context/
DartsApp_DB_v1_schema.sql
docs/codex/DartsApp_Codex_Phase2_COUNT_UP_v1.0.md
assets/audio/
assets/video/
docs/licenses/
```

baseline:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run validate:data
```

---

# 4. 並列作業

## Stage 0: 統合担当が直列で契約確定

先に次を確定してください。

- `features/game/domain/match/types.ts`
- `features/game/application/services/MatchGameServicePort.ts`
- MATCH状態遷移
- Agentごとのファイル所有範囲

最低API:

```ts
export type MatchStartInput = {
  zeroOneStartScore: 501 | 701;
  outRule: 'single_out' | 'master_out';
  bullRule: 'fat_bull' | 'separate_bull';
  player1Id: string;
  player2Id: string;
  game1FirstThrowPlayerId: string;
};

export type MatchChoiceInput = {
  selectedByPlayerId: string;
  mode: 'zero_one' | 'cricket';
  firstThrowPlayerId: string;
};
```

## Agent A: MATCHドメイン

所有:

```text
features/game/domain/match/**
tests/game/matchDomain.test.ts
```

担当:

- GAME勝数
- 2-0 / 1-1 / 2-1
- 2人01
- 2人CRICKET
- 15R比較
- 手動勝者要否
- MATCH集計

## Agent B: SQLite / Application Service

所有:

```text
features/game/application/services/MatchGameService.ts
features/game/application/services/MatchGameServicePort.ts
features/game/application/services/MatchRedoSession.ts
features/game/application/services/matchLeaveActions.ts
tests/game/matchGameService.test.ts
```

担当:

- MATCH graph
- match_players
- GAME 1～3
- 1投保存
- TURN確定
- pause / resume / abort
- 結果保存
- 冪等性

## Agent C: MATCH UI

所有:

```text
app/game/match/settings.tsx
app/game/match/[matchId]/index.tsx
app/game/match/[matchId]/choice.tsx
app/game/match/[matchId]/result.tsx
components/game/match/**
```

担当:

- 設定
- GUEST選択・作成
- 01 / CRICKETプレイ
- GAME間画面
- CHOICE
- 手動勝者
- 結果
- 戻る制御

## Agent D: Rating候補・共通契約

所有:

```text
features/game/application/services/MatchRatingCandidateService.ts
features/common-contract/application/matchMapper.ts
features/common-contract/application/events.ts
features/common-contract/application/exportEnvelope.ts
features/common-contract/application/importValidator.ts
tests/game/matchRatingCandidate.test.ts
tests/common-contract/matchContract.test.ts
```

担当:

- MATCH Evaluation
- rating_evaluation_games
- rating_recalculate Outbox
- match_completed CommonEvent
- CommonOutbox local_only
- MATCH JSON

## Agent E: 受入テスト・文書

所有:

```text
tests/game/matchAcceptance.test.ts
tests/game/matchRouteGuard.test.ts
README.md
docs/ROUTES.md
docs/ARCHITECTURE.md
docs/implementation/PHASE_6_REPORT.md
```

統合担当だけが変更:

```text
features/game/application/services/index.ts
contexts/GameDatabaseContext.tsx
app/game/index.tsx
app/home.tsx
components/AppButton.tsx
components/appButtonVariants.ts
features/common-contract/index.ts
```

同じファイルを複数Agentで同時編集しないでください。

---

# 5. MATCH確定仕様

## プレイヤー

```text
Player 1: Account OWNERまたは端末OWNER
Player 2: GUEST
```

- 異なる`players.id`が必須
- GUESTは`account_id = NULL`
- GUESTへRating Profile / Snapshotを作らない
- 既存GUEST選択または新規作成
- 同名だけで自動統合しない
- MATCH開始時に表示名snapshot保存
- Account未登録でもMATCHは遊べるがRating候補外

## MATCH構成

```text
GAME 1: 501または701
GAME 2: STANDARD CRICKET
GAME 3: CHOICE（1勝1敗時のみ）
```

CHOICEの01はGAME 1と同じ開始点です。
GAME 1が701ならGAME 3の01も701です。

## 勝利

- 先に2GAME勝利したプレイヤーがMATCH勝者
- 2-0ならGAME 3なし
- 1-1ならCHOICE
- GAME 3後は2-1

## 先攻

- GAME 1: 設定画面で選択
- GAME 2: GAME 1で先攻でなかったプレイヤー
- GAME 3: CHOICE画面で選択
- GAME内はTURNごとに交互

## CHOICE

CHOICE画面で必須選択:

- CHOICE選択者
- GAME種別
- GAME 3先攻

保存:

```text
choice_selected_by_player_id
choice_game_mode
choice_reason = manual_choice
choice_selected_at
```

アプリ側でCHOICE権を勝手に決めないでください。

---

# 6. 2人01

- 501 / 701
- 最大15R
- SINGLE OUT / MASTER OUT
- FAT / SEPARATE BULL
- Phase 3の純粋01ルールを再利用
- BUSTはTURN開始残り点へ戻す
- CHECKOUTで即時GAME勝利
- DARTを物理削除しない

15R:

1. 残り点が少ない方
2. 同点なら手動勝者

手動勝者理由を1～100文字で保存してください。
手動勝者を含むMATCHはPPD / MPR観測を利用可能ですが、Rating勝敗補正は0です。

---

# 7. 2人STANDARD CRICKET

対象:

```text
20 / 19 / 18 / 17 / 16 / 15 / BULL
```

- SINGLE 1マーク
- DOUBLE 2マーク
- TRIPLE 3マーク
- OUTER BULL 1マーク
- INNER BULL 2マーク
- 3マークでCLOSE
- 自分CLOSE済み・相手未CLOSE時だけOver Mark得点
- 両者CLOSE後は得点なし
- BULL Over Markは1マーク25点

自然勝利:

```text
全7ターゲットCLOSE
AND 自分の得点 > 0
AND 自分の得点 >= 相手の得点
```

両者0点では自然勝利にしません。

15R比較:

1. 得点
2. CLOSE数
3. 有効マーク数
4. 完全同値なら手動勝者

0対0でもCLOSE数・マーク数で勝者が決まる場合はありますが、自然CLEARではありません。

---

# 8. 状態遷移

```text
MATCH in_progress / GAME 1
→ GAME 1 completed
→ GAME 2作成
→ GAME 2 completed
   ├─ 2-0 → MATCH completed
   └─ 1-1 → CHOICE
             → GAME 3
             → MATCH completed
```

`matches.status`へ新しい値を追加しません。
1-1でGAME 3未作成を画面側で`choice_required`として導出してください。

GAME完了後は自動で次GAMEを作らず、ユーザーの「次のゲームへ」で作成してください。
二重タップで重複GAMEを作らないでください。

---

# 9. SQLite保存

新規migrationなし。

```text
001_initial
002_account_rating_foundation
003_common_account_contract
PRAGMA user_version = 3
```

MATCH開始時:

- `matches`
- `match_players` 2件
- GAME 1 `game_sessions`
- GAME 1 `game_players` 2件
- ROUND / TURN

GAME 1:

```text
mode = zero_one
match_game_no = 1
player_count = 2
```

GAME 2:

```text
mode = cricket
match_game_no = 2
```

GAME 3:

```text
match_game_no = 3
mode = choice
```

MATCH完了は排他的トランザクションで冪等に:

- matches completed
- winner / loser
- match_players result
- match_player_results 2件
- rating_evaluations OWNER分
- rating_evaluation_games
- rating_recalculate Outbox
- match_completed domain event
- CommonEvent
- CommonOutbox local_only

---

# 10. Undo / Redo / Pause

- 現在プレイヤーの未確定TURNだけ
- UndoはDARTを`voided`
- Redoは画面メモリだけ
- 新規投擲 / TURN確定 / GAME遷移 / CHOICE遷移でclear
- pause→再開後はRedo不可
- MATCH再起動後はRedo不可
- BUST / CHECKOUT / GAME勝利後は通常Undo不可

戻る3択:

```text
一時停止してゲームハブへ戻る
ゲームを続ける
MATCHを途中終了する
```

pause:

- matches paused
- current game paused

abort:

- matches aborted
- active game aborted
- Rating Evaluationなし
- MATCH勝敗なし

---

# 11. Rating候補

MATCHは初回Rating確定前でも候補です。
MATCHが初回Ratingを確定するためです。

Account OWNER視点で1件:

```text
source_type = match
source_match_id = matchId
source_game_id = NULL
source_revision = 1
status = pending
candidate_flag = 1
match_result = win / loss
source_weight_milli = 1000
```

GUEST用Evaluationは作成しません。
Account未登録ならMATCHは保存し、Ratingだけ除外します。

MATCH PPD:

```text
MATCH内全01有効得点 ÷ MATCH内全01 Rating用投数
```

MATCH MPR:

```text
MATCH内全CRICKET有効マーク ÷ MATCH内全CRICKET確定TURN数
```

GAME単位PPD / MPRの単純平均は禁止です。

手動勝者がある場合:

```json
{
  "manualOutcomeAdjustment": true,
  "outcomeDelta": 0
}
```

Phase 6ではRating Profile更新、`established_at`、Rating計算、Snapshot作成を行いません。

---

# 12. Common Account契約

`features/common-contract/application/matchMapper.ts`を追加してください。

最低項目:

```text
match_id
account_id
status
zero_one_start_score
out_rule
bull_rule
winner_player_id
loser_player_id
games_won
game_ids
completed_at
rating_candidate
```

CommonEvent:

```text
event_type = match_completed
event_version = 1
source_app = darts_app
```

CommonOutbox:

- `sync_status = local_only`
- DartsSupportApp通信なし
- API通信なし
- 同一MATCHで重複なし

Export Envelopeは`darts_common_data v1`を維持し、`matches`をoptional配列として後方互換追加できます。
旧JSONに`matches`がなくてもvalidにしてください。
Importは検証・previewだけでDB書込みしません。

---

# 13. 画面

必須route:

```text
/game/match/settings
/game/match/[matchId]
/game/match/[matchId]/choice
/game/match/[matchId]/result
```

Game Hub:

- MATCHボタン背景`#7C3AED`
- 白文字
- COUNT-UP緑 / 01青 / CRICKET赤は変更しない
- active MATCH再開
- 最近のMATCH結果

MATCH設定:

- Player 1
- Player 2 GUEST
- 501 / 701
- SINGLE / MASTER OUT
- FAT / SEPARATE BULL
- GAME 1先攻
- 最大15R固定
- Rating状態

MATCHプレイ:

- MATCH score
- GAME番号
- mode
- current player
- ROUND
- 両者の01残り点またはCRICKET marks / score
- Undo / Redo
- TURN終了
- ゲーム一覧

CHOICE:

- CHOICE選択者
- GAME 1と同じ01またはCRICKET
- GAME 3先攻

結果:

- winner
- 2-0 / 2-1
- GAME別winner
- PPD / MPR
- total darts
- BULL / TRIPLE / DOUBLE / BUST
- manual winner有無
- Rating候補
- CommonOutbox local_only

---

# 14. Route Guard

`/game/match/[matchId]`:

- 不明 → `/game`
- completed → result
- aborted / invalid → game hub
- 1-1でGAME 3未作成 → choice
- DB状態をURLより優先

`/choice`:

- 1-1かつGAME 3未作成だけ
- completed → result
- GAME 3存在 → play

`/result`:

- completedだけ表示
- in_progress / paused → playまたはchoice

可能なら純粋関数化してテストしてください。

---

# 15. テスト

既存166テストを壊さないでください。

最低確認:

- 2人必須 / 同一Player拒否
- GAME1 zero_one
- GAME2 cricket
- 2-0 / 1-1 / CHOICE / 2-1
- CHOICEの01開始点固定
- 交互TURN
- 01 BUST / CHECKOUT / 15R
- CRICKET CLOSE / 得点 / 0点自然勝利禁止 / 15R比較
- manual winner
- GAME重複作成防止
- client_action_id冪等
- pause / resume / abort
- Undo物理削除なし
- Redo画面セッション限定
- match_player_results 2件
- OWNER Rating Evaluation 1件
- GUEST Evaluationなし
- rating_evaluation_games 2～3件
- rating_recalculate Outbox 1件
- CommonEvent / CommonOutbox 1件
- match mapper
- Export後方互換
- secrets非出力
- migration 001→002→003
- migration再実行
- foreign_key_check
- COUNT-UP / 単独01 / 単独CRICKET回帰
- Account復旧 / Database is locked再発なし

---

# 16. 検証

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run format:check
npm.cmd test
npm.cmd run validate:data
```

Metro smoke:

```powershell
npm.cmd run start:lan -- --port 8102
```

Webは`expo-sqlite` WASM制限と分けて報告してください。

---

# 17. Git / PR

作業ブランチ:

```text
codex/phase-6-match
```

推奨commit:

```text
feat(game): implement two-player match vertical slice
```

Draft PR:

```text
Phase 6: two-player match vertical slice
```

mainへマージしないでください。

完了報告:

1. 実装概要
2. 並列作業
3. Agent別成果
4. MATCH構成
5. 2-0 / 2-1
6. CHOICE
7. 01 round limit
8. CRICKET 0点自然勝利禁止
9. manual winner
10. pause / resume
11. Rating Evaluation
12. CommonEvent / CommonOutbox
13. migration / user_version
14. 全検証
15. テスト総数
16. 実機確認
17. commit SHA
18. push
19. Draft PR URL
20. mergeable

今回はPhase 6で停止し、Rating計算本体、Snapshot更新、音源・動画、DartsSupportApp通信へ進まないでください。
