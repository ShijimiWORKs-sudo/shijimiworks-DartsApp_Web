# DartsApp Rating計算モジュール仕様書 v1.1

- 文書バージョン: 1.1
- calculation_version: 2
- 旧版: `DartsApp_Rating計算モジュール仕様書_v1.0.md`
- 対象: MATCH初回測定、単独01・単独CRICKET更新、Account所有

---

## 1. 改訂概要

v1.1では次を変更する。

1. Rating所有単位をPlayer単独からAccount + OWNER Playerへ変更
2. 初回Rating確定は従来どおりEligible MATCH 3件だけ
3. 初回確定後は単独01・単独CRICKETもRating更新対象
4. 単独ゲームはMATCHより低い重み
5. 単独ゲーム1件の総合Rating変動上限を±0.2
6. 単独ゲーム完了が他の能力指数を直接変更しない
7. Rating Evaluationへ`source_type`を追加
8. 初回確定前の単独ゲームは遡及利用しない

---

## 2. Rating所有者

正式Ratingを持てるのは次を満たすPlayerだけ。

- `player_type='owner'`
- `players.account_id IS NOT NULL`
- Account状態が`local_registered`または`cloud_verified`

GUESTは正式Ratingを持たない。

Rating Profile・Snapshotの主キーはAccountを正本とし、OWNER Player IDも保存する。

---

## 3. Rating範囲と構成

| 項目 | 仕様 |
|---|---|
| 最小 | 1.0 |
| 最大 | 18.0 |
| 表示 | 小数第1位 |
| 保存 | `rating_tenths` |
| 精密値 | `precise_rating_milli` |

```text
Base Rating
= 01 Index × 0.45
+ Cricket Index × 0.45
+ Match Index × 0.10
```

---

## 4. 初回測定

### 4.1 対象

初回3MATCHはEligible MATCHだけを使う。

```text
0 MATCH: unmeasured
1 MATCH: provisional_1_of_3
2 MATCH: provisional_2_of_3
3 MATCH: provisional、初回Rating確定
```

単独ゲームは初回測定件数に加算しない。

### 4.2 初回確定時刻

3件目のEligible MATCH完了・適用時刻を`rating_profiles.established_at`へ保存する。

### 4.3 遡及禁止

`established_at`より前に開始または完了した単独GAMEは、後からRating評価へ入れない。

除外理由:

- `INITIAL_RATING_NOT_ESTABLISHED`
- `GAME_BEFORE_RATING_ESTABLISHED`

---

## 5. 評価元

```ts
export type RatingSourceType =
  | 'match'
  | 'standalone_zero_one'
  | 'standalone_cricket';
```

### 5.1 MATCH

- 01観測値
- CRICKET観測値
- MATCH勝敗観測値
- source weight 1.0

### 5.2 単独01

- 01観測値だけ
- source weight 0.5
- Match Index・Cricket Indexを直接変更しない

### 5.3 単独CRICKET

- Cricket観測値だけ
- source weight 0.5
- Match Index・01 Indexを直接変更しない

---

## 6. 適格条件

### 6.1 共通

- Account登録済み
- OWNER紐付け済み
- GAME / MATCH completed
- deleted_at IS NULL
- 未確定DARTなし
- 投順整合
- 最新source revision
- importedではない

### 6.2 単独ゲーム追加条件

- `rating_profiles.established_at IS NOT NULL`
- `game_sessions.started_at >= established_at`
- `rating_candidate = 1`
- `player_count = 1`
- OWNER本人

### 6.3 単独01

対象完了理由:

- checkout
- round_limit

除外:

- aborted
- invalid
- unsupported out rule

### 6.4 単独CRICKET

対象完了理由:

- all_closed_with_score
- round_limit

0点round limitもMPR評価は可能。ただし自然クリアではない。

除外:

- aborted
- invalid
- 0本TURN

---

## 7. 01指標

v1.0を維持する。

### 7.1 有効得点

- 通常TURN: applied score
- CHECKOUT: checkoutまでのapplied score
- BUST: 0
- voided / invalid DART: 0

### 7.2 Rating用投数

```text
通常3投TURN = 3
通常1～2投で手動終了 = 3
CHECKOUT = 実投数
BUST = BUST成立までの実投数
MISS = 1
```

### 7.3 PPD

```text
PPD = 有効得点合計 ÷ Rating用投数合計
3DA = PPD × 3
```

### 7.4 PPDアンカー

| Index | PPD |
|---:|---:|
| 1 | 10.000 |
| 2 | 13.333 |
| 3 | 15.000 |
| 4 | 16.667 |
| 5 | 18.333 |
| 6 | 20.000 |
| 7 | 21.667 |
| 8 | 23.333 |
| 9 | 25.000 |
| 10 | 26.667 |
| 11 | 28.333 |
| 12 | 30.000 |
| 13 | 32.000 |
| 14 | 34.000 |
| 15 | 36.000 |
| 16 | 38.000 |
| 17 | 40.000 |
| 18 | 42.000 |

アンカー間は線形補間する。

---

## 8. CRICKET指標

### 8.1 有効マーク

- 20～15 SINGLE / DOUBLE / TRIPLE: 1 / 2 / 3
- OUTER / INNER BULL: 1 / 2
- 対象外・MISS: 0
- voided / invalid: 0

単独CRICKETでは、CLOSE後のOver Markも有効マークに含める。

### 8.2 MPR

```text
MPR = 有効マーク合計 ÷ 確定TURN数
```

### 8.3 MPRアンカー

| Index | MPR |
|---:|---:|
| 1 | 0.800 |
| 2 | 1.000 |
| 3 | 1.200 |
| 4 | 1.400 |
| 5 | 1.600 |
| 6 | 1.800 |
| 7 | 2.000 |
| 8 | 2.200 |
| 9 | 2.400 |
| 10 | 2.600 |
| 11 | 2.800 |
| 12 | 3.000 |
| 13 | 3.200 |
| 14 | 3.400 |
| 15 | 3.600 |
| 16 | 3.800 |
| 17 | 4.000 |
| 18 | 4.200 |

アンカー間は線形補間する。

---

## 9. 観測Window

### 9.1 MATCH Window

- 直近最大10 Eligible MATCH
- Match Index
- 安定性補正
- 継続ボーナス
- 初回外れ値抑制

新しい順の重み:

```text
1.00, 0.95, 0.90, 0.85, 0.80,
0.75, 0.70, 0.65, 0.60, 0.55
```

### 9.2 01 Component Window

直近最大10観測。

対象:

- MATCHの01集約観測
- Rating確定後の単独01

実効重み:

```text
effectiveWeight
= recencyWeight × sourceWeight
```

- MATCH: sourceWeight 1.0
- 単独01: sourceWeight 0.5

PPDは得点・投数で加重する。

```text
Window PPD
= Σ(effectiveWeight × effectiveScore)
÷ Σ(effectiveWeight × ratingDarts)
```

### 9.3 Cricket Component Window

直近最大10観測。

対象:

- MATCHのCRICKET集約観測
- Rating確定後の単独CRICKET

```text
Window MPR
= Σ(effectiveWeight × effectiveMarks)
÷ Σ(effectiveWeight × ratingRounds)
```

### 9.4 Match Index

MATCH観測だけで更新する。単独ゲームでは前回値を維持する。

---

## 10. 初回3MATCH外れ値抑制

v1.0を維持する。

```text
Adjusted Match PPD
= clamp(Match PPD, medianPPD - 6.0, medianPPD + 6.0)

Adjusted Match MPR
= clamp(Match MPR, medianMPR - 0.6, medianMPR + 0.6)
```

単独ゲームには適用しない。

---

## 11. MATCH結果指数

v1.0を維持する。

```text
Performance Mid Index
= (01 Index + Cricket Index) / 2
```

| 結果 | Delta |
|---|---:|
| 2-0勝利 | +8.5 |
| 2-1勝利 | +5.0 |
| 1-2敗北 | -5.0 |
| 0-2敗北 | -8.5 |
| 手動決定含む | 0.0 |

```text
Match Index
= clamp(Performance Mid Index + Weighted Outcome Delta, 1, 18)
```

単独ゲームではMatch Indexを変更しない。

---

## 12. 安定性・継続

### 12.1 Stability Adjustment

Eligible MATCHのMatch Skill Indexだけから計算する。

```text
Stability Adjustment
= -min(0.60, max(0, weightedStdDev - 0.75) × 0.25)
```

単独ゲームは標準偏差計算へ直接追加しない。

### 12.2 Continuity Bonus

Eligible MATCH件数で計算する。

```text
Volume Continuity Bonus
= min(0.15, (windowMatchCount - 4) × 0.025)
```

直近3MATCH再現性ボーナスと合計し最大+0.25。

単独ゲーム回数だけで継続ボーナスを増やさない。

---

## 13. Raw Target Rating

```text
Raw Target Rating
= clamp(
    01 Index × 0.45
    + Cricket Index × 0.45
    + Match Index × 0.10
    + Stability Adjustment
    + Continuity Bonus,
    1.0,
    18.0
  )
```

単独01完了時:

- 01 Index再計算
- Cricket Index前回値
- Match Index前回値

単独CRICKET完了時:

- Cricket Index再計算
- 01 Index前回値
- Match Index前回値

---

## 14. 更新平滑化

### 14.1 3MATCH初回

平滑化なし。

### 14.2 MATCH更新

v1.0を維持する。

4～9MATCH:

```text
candidate = previous + 0.50 × (rawTarget - previous)
delta cap = ±0.60
```

10MATCH以上:

```text
candidate = previous + 0.40 × (rawTarget - previous)
delta cap = ±0.50
```

### 14.3 単独ゲーム更新

```text
candidate
= previousPreciseRating
+ 0.25 × (rawTargetRating - previousPreciseRating)

Final Precise Rating
= previousPreciseRating
+ clamp(candidate - previousPreciseRating, -0.20, +0.20)
```

1件で表示Ratingが最大0.2だけ上下する。

単独ゲームでRaw Targetとの差が小さい場合は、実際の変動が0.0～0.1になることがある。

### 14.4 丸め

```text
rating_tenths = round(finalPreciseRating × 10)
precise_rating_milli = round(finalPreciseRating × 1000)
```

---

## 15. Confidence

基本式はv1.0を維持する。

```text
Confidence %
= Volume Factor × 55
+ Recency Factor × 15
+ Data Quality Factor × 15
+ Stability Factor × 15
```

### 15.1 初回確定ゲート

Eligible MATCH 3件未満では45％を超えない。

### 15.2 単独ゲームの扱い

- 単独ゲームはEligible MATCH件数を増やさない
- 最新単独ゲームが新しい場合、01またはCRICKET componentのrecency補助に利用可
- 単独だけでConfidenceを大幅に上げない
- 単独由来のConfidence加点上限は合計5ポイント

### 15.3 データ品質

手動セグメント入力自体は減点しない。修正率・未解決データだけを減点する。

---

## 16. Rating candidate判定

### 16.1 MATCH

MATCH構造とデータが適格なら候補。

### 16.2 単独01・CRICKET

```text
Account登録済み
AND OWNER紐付け済み
AND Rating確定済み
AND GAME開始 >= established_at
AND GAME completed
AND データ整合
```

### 16.3 COUNT-UP

常に対象外。

---

## 17. 除外理由

v1.0へ次を追加する。

- ACCOUNT_NOT_REGISTERED
- ACCOUNT_NOT_ACTIVE
- OWNER_NOT_LINKED
- INITIAL_RATING_NOT_ESTABLISHED
- GAME_BEFORE_RATING_ESTABLISHED
- STANDALONE_GAME_ABORTED
- STANDALONE_GAME_INVALID
- UNSUPPORTED_STANDALONE_MODE
- INVALID_CRICKET_ZERO_POINT_CLEAR

`INVALID_CRICKET_ZERO_POINT_CLEAR`は、自然終了として保存されたCRICKETが0点だった場合に使用する。round limit 0点はこの理由で除外しない。

---

## 18. Evaluation生成

### MATCH

```text
source_type = match
source_weight_milli = 1000
```

### 単独01

```text
source_type = standalone_zero_one
source_weight_milli = 500
zero_one_game_count = 1
cricket_game_count = 0
```

### 単独CRICKET

```text
source_type = standalone_cricket
source_weight_milli = 500
zero_one_game_count = 0
cricket_game_count = 1
```

Evaluation、Snapshot、Profile更新は同一排他トランザクションで適用する。

---

## 19. 再計算

訂正時:

1. 対象Evaluation以降のSnapshotをinvalidate
2. source revisionを増やす
3. 時系列順に再適用
4. Rating Profileを最後の有効Snapshotへ更新

Account変更・OWNER付替えで過去Ratingを別Accountへ自動移動しない。

---

## 20. 純粋TypeScript API

```ts
export type RatingSourceType =
  | 'match'
  | 'standalone_zero_one'
  | 'standalone_cricket';

export type RatingUpdateInput = {
  accountId: string;
  playerId: string;
  sourceType: RatingSourceType;
  previousProfile: RatingProfileState;
  matchObservations: MatchObservation[];
  zeroOneObservations: ZeroOneObservation[];
  cricketObservations: CricketObservation[];
};

export type RatingUpdateOutput = {
  eligible: boolean;
  exclusionReasons: string[];
  zeroOneIndex: number | null;
  cricketIndex: number | null;
  matchIndex: number | null;
  rawTargetRating: number | null;
  finalPreciseRating: number | null;
  ratingTenths: number | null;
  confidenceBp: number;
  appliedDelta: number | null;
  calculationDetail: Record<string, unknown>;
};
```

React・SQLiteへ依存しない。

---

## 21. 必須テスト

### 初回測定

- 0 / 1 / 2 / 3 MATCH
- 3件目でestablished_at
- 初回外れ値抑制

### 単独01

- 3MATCH前は除外
- established_at前GAMEは除外
- 確定後は01 Index更新
- Cricket / Match Index不変
- delta cap ±0.2

### 単独CRICKET

- 確定後はCricket Index更新
- 01 / Match Index不変
- 0点round limitもMPR評価可能
- 0点自然clearは不正
- delta cap ±0.2

### Account

- Accountなし除外
- GUEST除外
- disabled Account除外

### 再計算

- source revision
- invalidate以降再構築
- 同一入力で同一結果

---

## 22. 受入条件

1. 初回RatingはMATCH 3件だけで確定する
2. 単独ゲームは初回確定件数へ入らない
3. 確定後の単独01がRatingを上下できる
4. 確定後の単独CRICKETがRatingを上下できる
5. 単独1件の総合変動が±0.2以内
6. 単独ゲームでMATCH Indexを変更しない
7. AccountとOWNERへRatingが紐づく
8. GUESTへ正式Ratingを作らない
9. 既存アンカーとMATCHロジックを維持する
10. 計算が純粋関数で再現可能
