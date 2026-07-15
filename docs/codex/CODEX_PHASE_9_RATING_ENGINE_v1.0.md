# DartsApp Codex Phase 9 実装指示書

- フェーズ: Phase 9 Rating計算本体・Snapshot更新
- 文書バージョン: 1.0
- Rating calculation version: `2`
- ローカル作業先: `C:\制作データ\10_App\DartsApp`
- リポジトリ: `ShijimiWORKs-sudo/shijimiworks-DartsApp_Web`
- 作業ブランチ: `codex/phase-9-rating-engine`
- ベース: Phase 8マージ済み`main`
- DB基準: migration 001→002→003、`PRAGMA user_version = 3`

---

## 1. 目的

既存の`rating_evaluations`候補をDartsApp独自Ratingへ適用し、次を完成させてください。

```text
Eligible MATCH完了
→ Evaluation適格判定
→ Rating計算
→ Snapshot作成
→ Rating Profile更新
→ 1・2件目は参考Rating
→ 3件目で初回Rating確定
→ 4件目以降は平滑化更新

初回確定後の単独01 / 単独CRICKET完了
→ 対象componentだけ更新
→ 総合Ratingを最大±0.2更新
→ Snapshot / Profile / 履歴更新
```

Rating計算はReact・SQLiteへ依存しない純粋TypeScriptを正本とし、同じ入力と計算日時から常に同じ結果を返してください。

---

## 2. 必ず読む文書

```text
docs/specs/DartsApp_Rating計算モジュール仕様書_v1.1.md
docs/specs/DartsApp_Rating計算モジュール仕様書_v1.0.md
docs/specs/DartsApp_DB設計書_v1.1.md
docs/specs/DartsApp_詳細設計書_v1.1.md
docs/specs/DartsApp_画面遷移設計書_v1.1.md
docs/implementation/PHASE_4_REPORT.md
docs/implementation/PHASE_5_REPORT.md
docs/implementation/PHASE_6_REPORT.md
docs/implementation/PHASE_8_REPORT.md
docs/ARCHITECTURE.md
docs/ROUTES.md
```

優先順位:

1. Rating仕様書v1.1
2. v1.1から参照されるv1.0
3. DB設計書・現行migration
4. 本指示書
5. 既存実装

未確定の数式を推測で追加しないでください。必要なら`docs/implementation/OPEN_QUESTIONS.md`へ記録します。

---

## 3. 実装対象

### 必須

- 純粋TypeScript Rating Engine v2
- PPD / 3DA / MPR
- PPD・MPRアンカー線形補間
- 直近Window
- 初回3MATCH外れ値抑制
- MATCH結果指数
- 安定性補正・継続ボーナス
- Raw Target Rating
- 初回1～3MATCH処理
- 4MATCH以降の平滑化
- 単独01 / CRICKETの最大±0.2更新
- Confidence
- Evaluation適格性・除外理由
- Snapshot・Profile更新
- pending Evaluation処理
- source revision・再計算
- Rating履歴UI
- 結果画面・Home・Game Hub・Account表示
- PC Web / Expo Go
- テスト・文書・Draft PR

### 対象外

- DARTSLIVE / PHOENIX公式Rating再現
- 相手Rating補正
- calculation version 3
- クラウド同期・ランキング
- DartsSupportApp通信
- 音源・動画・カメラ判定
- migration 004
- Expo SDK更新

---

## 4. 最優先ルール

1. `calculation_version = 2`。
2. Rating範囲は1.0～18.0。
3. 表示は小数第1位、保存は`rating_tenths`。
4. 精密値は`precise_rating_milli`。
5. 初回確定はEligible MATCH 3件だけ。
6. 単独ゲームは初回3件へ加算しない。
7. 初回確定前の単独ゲームを遡及利用しない。
8. 単独01は01 Indexだけを直接更新する。
9. 単独CRICKETはCricket Indexだけを直接更新する。
10. 単独ゲームでMatch Indexを変更しない。
11. 単独1件の総合Rating変動は±0.2以内。
12. GUESTへProfile / Snapshotを作らない。
13. Account + OWNER PlayerをRating所有者とする。
14. 画面へ数式を直書きしない。
15. 計算途中で丸めない。
16. Evaluation・Snapshot・Profile更新は同一transaction。
17. migration 001～003を変更しない。
18. migration 004を追加しない。
19. `PRAGMA user_version = 3`を維持する。
20. Web SQLite基盤・Phase 8 UIを壊さない。
21. `git add .`、`git add -A`、force push、`git reset --hard`は禁止。
22. 未追跡資料・audio・video・licensesをcommitしない。
23. mainへ自動マージしない。

---

## 5. 作業開始

```powershell
cd "C:\制作データ\10_App\DartsApp"
git status --short
git fetch origin
git switch main
git pull --ff-only origin main
git switch codex/phase-9-rating-engine
git pull --ff-only origin codex/phase-9-rating-engine
git branch --show-current
```

ローカルブランチがない場合のみ:

```powershell
git switch --track origin/codex/phase-9-rating-engine
```

baseline:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run format:check
npm.cmd test
npm.cmd run validate:data
npx.cmd expo export --platform web
```

---

## 6. 並列作業

### Stage 0: 統合担当が直列で契約確定

確定するもの:

- Rating Engine public types
- Observation型
- RatingUpdateInput / Output
- `calculatedAt`注入方式
- Repository Port
- Application Service Port
- Agentの所有ファイル

候補:

```text
features/game/domain/rating/engine/ratingTypes.ts
features/game/domain/rating/engine/ratingConstants.ts
features/game/domain/rating/engine/index.ts
features/game/application/services/RatingApplicationServicePort.ts
```

計算関数内部で`new Date()`を直接呼ばず、日時を引数で受け取ってください。

### Agent A: 純粋Rating Engine

```text
features/game/domain/rating/engine/**
tests/rating/**
```

担当: PPD、MPR、補間、Window、Winsorize、Match Index、Stability、Continuity、Confidence、平滑化。

### Agent B: Observation・Repository

```text
features/game/infrastructure/sqlite/rating/**
features/game/application/rating/RatingObservationLoader.ts
tests/game/ratingObservationLoader.test.ts
```

担当: latest revision、MATCH/standalone観測、previous snapshot、除外データ。

### Agent C: Application・再計算

```text
features/game/application/services/RatingApplicationService.ts
features/game/application/services/RatingRecalculationService.ts
tests/game/ratingApplicationService.test.ts
tests/game/ratingRecalculationService.test.ts
```

担当: pending処理、eligible/excluded、Snapshot、Profile、Outbox、invalidate/replay、冪等性。

### Agent D: Rating UI

```text
app/account/rating/**
components/account/rating/**
app/account/profile.tsx
app/home.tsx
app/game/index.tsx
各結果画面
tests/web/ratingUi.test.ts
```

担当: 参考/確定Rating、Confidence、履歴、before/after、除外理由。

### Agent E: 受入テスト・docs

```text
tests/rating/ratingAcceptance.test.ts
tests/game/ratingEndToEnd.test.ts
README.md
docs/ROUTES.md
docs/ARCHITECTURE.md
docs/implementation/PHASE_9_REPORT.md
```

共有ファイルは統合担当だけが変更してください。

---

## 7. 純粋TypeScript API

最低限:

```ts
export type RatingSourceType =
  | 'match'
  | 'standalone_zero_one'
  | 'standalone_cricket';

export type MeasurementStatus =
  | 'unmeasured'
  | 'provisional_1_of_3'
  | 'provisional_2_of_3'
  | 'provisional'
  | 'standard'
  | 'stable';

export type RatingUpdateInput = {
  accountId: string;
  playerId: string;
  sourceType: RatingSourceType;
  calculatedAt: string;
  previousProfile: RatingProfileState;
  matchObservations: MatchObservation[];
  zeroOneObservations: ZeroOneObservation[];
  cricketObservations: CricketObservation[];
};

export type RatingUpdateOutput = {
  eligible: boolean;
  exclusionReasons: string[];
  measurementStatus: MeasurementStatus;
  zeroOneIndex: number | null;
  cricketIndex: number | null;
  matchIndex: number | null;
  rawTargetRating: number | null;
  finalPreciseRating: number | null;
  ratingTenths: number | null;
  confidenceBp: number;
  appliedDelta: number | null;
  establishedAt: string | null;
  calculationDetail: Record<string, unknown>;
};
```

---

## 8. Rating構成

```text
Base Rating
= 01 Index × 0.45
+ Cricket Index × 0.45
+ Match Index × 0.10
```

```text
Raw Target Rating
= clamp(
    Base Rating
    + Stability Adjustment
    + Continuity Bonus,
    1.0,
    18.0
  )
```

永続化直前:

```text
rating_tenths = round(finalPreciseRating × 10)
precise_rating_milli = round(finalPreciseRating × 1000)
index_milli = round(index × 1000)
```

---

## 9. 01指標

有効得点:

- 通常TURN: applied score
- CHECKOUT: checkoutまで
- BUST: 0
- voided / invalid: 0

Rating用投数:

```text
通常3投TURN = 3
通常1～2投で手動終了 = 3
CHECKOUT = 実投数
BUST = BUST成立までの実投数
MISS = 1
voided / invalid = 0
```

```text
PPD = 有効得点合計 ÷ Rating用投数合計
3DA = PPD × 3
```

MATCH内に01が2GAMEある場合、GAME PPDの単純平均は禁止。

PPD anchors:

```ts
[10.000,13.333,15.000,16.667,18.333,20.000,
 21.667,23.333,25.000,26.667,28.333,30.000,
 32.000,34.000,36.000,38.000,40.000,42.000]
```

アンカー間は線形補間、1～18へclamp。

---

## 10. CRICKET指標

- 20～15 S/D/T = 1/2/3
- OUTER / INNER BULL = 1/2
- MISS / 対象外 / voided = 0
- MATCHでは両者CLOSE済みへの命中は0
- 単独CRICKETではCLOSE後Over Markも有効

```text
MPR = 有効マーク合計 ÷ 確定TURN数
```

0本TURNは不正。

MPR anchors:

```ts
[0.8,1.0,1.2,1.4,1.6,1.8,2.0,2.2,2.4,
 2.6,2.8,3.0,3.2,3.4,3.6,3.8,4.0,4.2]
```

---

## 11. Window

MATCH Windowは直近最大10件。新しい順の重み:

```text
1.00, 0.95, 0.90, 0.85, 0.80,
0.75, 0.70, 0.65, 0.60, 0.55
```

01 component:

- MATCH: sourceWeight 1.0
- 単独01: sourceWeight 0.5

```text
effectiveWeight = recencyWeight × sourceWeight
Window PPD
= Σ(effectiveWeight × effectiveScore)
÷ Σ(effectiveWeight × ratingDarts)
```

Cricket componentも同様にmarks / roundsで加重。

Match Index、Stability、ContinuityはMATCHだけを使用。

---

## 12. 初回3MATCH外れ値抑制

3件目適用時だけ:

```text
Adjusted Match PPD
= clamp(Match PPD, medianPPD - 6.0, medianPPD + 6.0)

Adjusted Match MPR
= clamp(Match MPR, medianMPR - 0.6, medianMPR + 0.6)
```

元値と調整値を`calculation_detail_json`へ保存。

---

## 13. MATCH結果指数

```text
Performance Mid Index
= (01 Index + Cricket Index) / 2
```

```text
2-0勝利 +8.5
2-1勝利 +5.0
1-2敗北 -5.0
0-2敗北 -8.5
手動勝者決定を含む 0
```

```text
Weighted Outcome Delta
= Σ(weight × outcomeDelta) ÷ Σ(weight)

Match Index
= clamp(Performance Mid Index + Weighted Outcome Delta, 1, 18)
```

相手Rating補正は行いません。

---

## 14. 安定性・継続

```text
Match Skill Index
= (Match 01 Index + Match Cricket Index) / 2
```

```text
weightedStdDev
= sqrt(Σ(weight × (x - weightedMean)^2) / Σ(weight))
```

```text
Stability Adjustment
= -min(0.60, max(0, weightedStdDev - 0.75) × 0.25)
```

MATCH 3件未満は0。

Window 5件以上:

```text
Volume Bonus
= min(0.15, (windowMatchCount - 4) × 0.025)
```

直近3MATCH最大差:

```text
<=1.00: +0.10
<=1.50: +0.05
>1.50: 0
```

合計最大+0.25。

---

## 15. 初回測定・更新

```text
0件: unmeasured / rating NULL
1件: provisional_1_of_3 / 参考Rating / Confidence上限25%
2件: provisional_2_of_3 / 参考Rating / Confidence上限45%
3件: provisional / 初回確定 / established_at設定 / 平滑化なし
3～4件: provisional
5～9件: standard
10件以上: stable
```

4～9 MATCH:

```text
candidate = previous + 0.50 × (rawTarget - previous)
final = previous + clamp(candidate - previous, -0.60, +0.60)
```

10 MATCH以上:

```text
candidate = previous + 0.40 × (rawTarget - previous)
final = previous + clamp(candidate - previous, -0.50, +0.50)
```

---

## 16. 単独01 / CRICKET更新

共通条件:

- Account active
- OWNER linked
- `established_at IS NOT NULL`
- GAME開始 >= established_at
- completed
- `rating_candidate = 1`
- player_count = 1
- importedではない

単独01:

- 01 Indexだけ再計算
- Cricket / Match Indexは前回値
- countだけ増加

単独CRICKET:

- Cricket Indexだけ再計算
- 01 / Match Indexは前回値
- 0点round_limitは対象
- 0点natural clearは`INVALID_CRICKET_ZERO_POINT_CLEAR`

```text
candidate
= previousPreciseRating
+ 0.25 × (rawTargetRating - previousPreciseRating)

final
= previousPreciseRating
+ clamp(candidate - previousPreciseRating, -0.20, +0.20)
```

---

## 17. Confidence

```text
Confidence %
= Volume Factor × 55
+ Recency Factor × 15
+ Data Quality Factor × 15
+ Stability Factor × 15
```

Volume FactorはEligible MATCH総数のみ。

```text
0:0.00 1:0.10 2:0.25 3:0.45 4:0.55
5:0.65 6:0.72 7:0.79 8:0.86 9:0.93 10+:1.00
```

Recency Factor:

```text
0～7日 1.00
8～30日 0.90
31～60日 0.75
61～90日 0.60
91～180日 0.40
181日以上 0.20
```

Data Qualityは仕様書v1.0のcorrection / adjusted / photo penalty式をそのまま使用。

Stability Factor:

- 0 MATCH: 0
- 1 MATCH: 0.50
- 2件以上: `clamp(1 - weightedStdDev / 4, 0.25, 1)`

v1.1のstandalone由来Confidence追加には具体式がないため、Phase 9では推測式を作らず0とし、`OPEN_QUESTIONS.md`へ記録してください。

---

## 18. Evaluation適格性

正式所有者:

```text
player_type = owner
account_id IS NOT NULL
account.status IN (local_registered, cloud_verified)
rating_profiles.owner_player_id = players.id
```

GUESTは除外。

MATCH最低条件:

- completed / deleted_at NULL
- 2人が異なる
- GAME構成・勝敗整合
- 全GAME completed
- 01 / CRICKET観測あり
- 0本TURNなし
- unresolved DARTなし
- PPD 0～60、MPR 0～9
- latest revision
- importedではない

単独01対象完了理由: checkout / round_limit。

単独CRICKET対象完了理由: all_closed_with_score / round_limit。

複数除外理由を`rating_evaluation_exclusions`へ保存可能にしてください。

---

## 19. Evaluation lifecycle

```text
pending → eligible または excluded
eligible → applied
訂正時 → invalidated
```

- candidate_flag=0は適用しない
- latest revisionだけ適用
- 同一EvaluationへSnapshot最大1件
- applied再実行で重複しない
- excluded理由を重複しない
- Snapshot成功後だけappliedへする

---

## 20. DB transaction

1 transactionで:

1. Evaluation再読込
2. owner / revision / status確認
3. Observation読込
4. pure engine実行
5. eligible / excluded更新
6. exclusions保存
7. Snapshot作成
8. Profile更新
9. Outbox更新
10. commit

既存`runGameDatabaseTransaction`を使用し、nested transactionは禁止。

---

## 21. Snapshot / Profile

Snapshotへ既存全列を保存し、`calculation_version=2`。

`calculation_detail_json`最低項目:

```json
{
  "sourceType": "match",
  "windowWeights": [],
  "windowPpd": 0,
  "windowMpr": 0,
  "zeroOneIndex": 0,
  "cricketIndex": 0,
  "weightedOutcomeDelta": 0,
  "matchIndex": 0,
  "baseRating": 0,
  "weightedStdDev": 0,
  "stabilityAdjustment": 0,
  "continuityBonus": 0,
  "rawTargetRating": 0,
  "previousPreciseRating": null,
  "smoothingAlpha": null,
  "changeCap": null,
  "finalPreciseRating": 0,
  "displayRating": 0,
  "confidence": {},
  "initialOutlierControl": {},
  "standaloneConfidenceBonus": 0
}
```

NaN、Infinity、undefinedは禁止。

Profileは最後の有効Snapshotと一致させます。

`established_at`は3件目で初回設定し、通常更新では変更しません。再計算で3件未満へ戻る場合のみNULLへ戻します。

---

## 22. pending処理・再計算

完了直後に適用できる場合は同じexecutorを利用し、nested transactionを作らないでください。

失敗時はpendingを残し、起動・Account bootstrap・Home/Account focus時に時系列順で再処理します。

Account ID単位のPromise mutexで直列化してください。

訂正時:

1. latest revisionを選択
2. 対象以降Snapshot invalidate
3. Profileを直前Snapshotへ戻す
4. 最新Evaluationを時系列順に再適用
5. Profileを最終Snapshotへ更新

古いrevisionはWindowへ含めません。

---

## 23. Rating UI

Account画面:

- DartsApp Rating
- `独自方式による参考値`
- measurement status
- 参考 / 確定Rating
- Confidence
- Eligible MATCH件数
- 単独01 / CRICKET対象件数
- 01 / Cricket / Match Index
- 最終評価日時
- 履歴導線

route候補:

```text
/account/rating
/account/rating/history
```

結果画面:

- 対象 / 対象外
- 処理中
- 参考Rating更新
- 初回確定
- before → after
- delta
- Confidence
- 一般向け除外理由

COUNT-UPは常に対象外。

Home / Game HubではSupport用Ratingを混ぜないでください。

---

## 24. 必須テスト

既存テストをすべて維持し、最低限追加:

### pure math

- anchor下限・上限・一致・中間補間
- PPD / 3DA / MPR
- weighted Window
- sourceWeight 1.0 / 0.5
- stddev / stability / continuity
- outcome delta
- smoothing / cap / rounding

### initial MATCH

- 0 / 1 / 2 / 3 MATCH
- 1・2件目参考Rating
- 3件目確定・established_at
- Winsorize
- 4件目 / 10件目平滑化

### standalone

- 初回前除外
- established前除外
- 01だけ更新
- CRICKETだけ更新
- ±0.2 cap
- 0点round_limit対象
- 0点natural clear除外

### ownership

- Accountなし
- disabled Account
- OWNER未紐付け
- GUEST除外

### application / recalc

- pending→applied / excluded
- transaction rollback
- Snapshot重複なし
- Profile一致
- source revision
- invalidate / replay
- same input same result
- startup retry

### UI

- 参考Rating
- 3件目確定
- 履歴
- before / after
- 除外理由
- PC Web / Expo Go

---

## 25. 受入シナリオ

### A. 初回3MATCH

1. MATCH1 → 参考Rating / 1 of 3
2. MATCH2 → 参考Rating / 2 of 3
3. MATCH3 → 初回Rating確定
4. Snapshot 3件
5. Profile一致

### B. 4件目MATCH

- 平滑化
- 変動±0.6以内

### C. 単独01

- 01 Indexのみ変動
- 総合±0.2以内

### D. 単独CRICKET

- Cricket Indexのみ変動
- 総合±0.2以内

### E. 初回前単独

- 除外・遡及なし

### F. GUEST

- Ratingなし

### G. 再計算

- source revision更新
- 対象以降invalidate
- 再適用
- Profile一致

---

## 26. 検証

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run format:check
npm.cmd test
npm.cmd run validate:data
npx.cmd expo export --platform web
npm.cmd run web -- --port 8104 --clear
npm.cmd run start:lan
```

確認:

- Chrome / Edge / Expo Go
- `PRAGMA user_version = 3`
- `PRAGMA foreign_key_check = 0`
- Database is lockedなし
- 未処理Promiseなし

---

## 27. 文書

更新:

```text
README.md
docs/ROUTES.md
docs/ARCHITECTURE.md
docs/implementation/PHASE_9_REPORT.md
docs/implementation/OPEN_QUESTIONS.md
```

---

## 28. Git / PR

```text
branch: codex/phase-9-rating-engine
commit: feat(rating): implement rating engine and snapshots
PR title: Phase 9: Rating engine and snapshot updates
```

同じブランチへpushし、Draft PRを作成してください。mainへマージしないでください。

---

## 29. 完了報告

1. 実装概要
2. 並列作業
3. Agent別成果
4. pure API
5. PPD / MPR / interpolation
6. Window / Winsorize
7. Match Index
8. Stability / Continuity
9. 初回1～3MATCH
10. 4件目以降MATCH
11. standalone 01 / CRICKET
12. Confidence
13. Eligibility / exclusions
14. Snapshot / Profile
15. pending processor
16. recalculation
17. UI / history
18. DB migration有無
19. user_version
20. Chrome / Edge / Expo Go
21. 全検証
22. テスト総数
23. 変更ファイル
24. commit SHA
25. push
26. Draft PR
27. mergeable
28. 未追跡資料維持
29. 次フェーズ候補

今回はPhase 9で停止してください。
