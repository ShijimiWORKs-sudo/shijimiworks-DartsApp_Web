# DartsApp Rating計算モジュール仕様書

- 文書名: DartsApp Rating計算モジュール仕様書
- 文書バージョン: 1.0
- 計算バージョン: `calculation_version = 1`
- 作成日: 2026-07-12
- 対象リポジトリ: `ShijimiWORKs-sudo/shijimiworks-dartssuportapp`
- 対象アプリ: DartsApp（現行技術名: DartsSupportApp）
- 前提資料:
  - `DartsApp_詳細設計書_v1.0.md`
  - `DartsApp_DB設計書_v1.0.md`
  - `DartsApp_画面遷移設計書_v1.0.md`

---

## 1. 文書の目的

本書は、DartsApp独自の実力指標である **DartsApp Rating** を計算するモジュールの完全な仕様を定義する。

本書で確定する内容は次のとおり。

1. Rating評価対象MATCHの条件
2. 01のPPD・3DA計算
3. STANDARD CRICKETのMPR計算
4. PPD・MPRからRating指数への換算
5. 01指数45％、CRICKET指数45％、MATCH指数10％の統合
6. 初回3MATCHまでの仮測定と初回確定
7. 直近10MATCHの移動評価
8. 外れ値抑制、安定性補正、継続ボーナス
9. Rating変動の平滑化
10. 測定信頼度の計算
11. 訂正・無効化・再計算
12. TypeScriptモジュール構成、入出力、テスト条件

DartsApp Ratingは、DARTSLIVEまたはPHOENIXの公式レーティングを再現するものではない。一般的なソフトダーツ指標であるPPD、3DA、MPR、MATCH結果を利用したDartsApp独自方式とする。

表示時は次を明記する。

```text
DartsApp Rating
独自方式による参考値
```

---

## 2. 設計目標

### 2.1 基本目標

DartsApp Ratingは、次の性質を持たせる。

- 01だけ、またはCRICKETだけの成績に極端に偏らない
- 勝敗だけで高いRatingにならない
- 1回の好調・不調で大幅に変動しない
- 最近の上達は過去の成績より強く反映する
- 測定件数が少ないRatingと、十分な件数があるRatingを区別する
- 投擲訂正後に同じ入力から必ず同じ結果を再現できる
- UI、React、SQLiteへ依存しない純粋TypeScriptとして実装できる

### 2.2 Rating範囲

| 項目     | 仕様                                 |
| -------- | ------------------------------------ |
| 最小値   | 1.0                                  |
| 最大値   | 18.0                                 |
| 表示桁   | 小数第1位                            |
| DB保存   | `rating_tenths`、10倍整数            |
| 内部計算 | IEEE 754倍精度、小数を途中で丸めない |

### 2.3 構成比

```text
Base Rating
= 01 Index × 0.45
+ Cricket Index × 0.45
+ Match Index × 0.10
```

最終値はBase Ratingに安定性補正と継続ボーナスを加え、必要に応じて前回Ratingからの変動を平滑化する。

```text
Raw Target Rating
= Base Rating
+ Stability Adjustment
+ Continuity Bonus
```

---

## 3. 用語定義

| 用語            | 定義                                                      |
| --------------- | --------------------------------------------------------- |
| Eligible MATCH  | Rating計算への利用条件を満たすMATCH                       |
| Evaluation      | 1人・1MATCH・1リビジョン単位の評価候補                    |
| Snapshot        | Rating計算後の履歴1件                                     |
| PPD             | 01の有効得点をRating用投数で割った1投平均                 |
| 3DA             | PPDの3倍                                                  |
| MPR             | CRICKETの有効マーク数をプレイヤーの確定ターン数で割った値 |
| 01 Index        | PPDを1.0～18.0へ換算した指数                              |
| Cricket Index   | MPRを1.0～18.0へ換算した指数                              |
| Match Index     | 01・CRICKETの中間能力にMATCH結果補正を加えた指数          |
| Window          | 計算対象とする直近最大10MATCH                             |
| Source Revision | MATCH訂正ごとに増える評価元データの版                     |
| Provisional     | 3MATCH未満、または確定直後でデータ量が少ない状態          |
| Confidence      | Rating値とは別に表示する測定信頼度                        |

---

## 4. 評価対象の基本方針

### 4.1 正式Ratingの対象

正式Ratingに利用するのは、DartsApp内の **MATCHモード** で完了したデータだけとする。

MATCH構成は次のいずれかでなければならない。

```text
2-0の場合
GAME 1: 501または701
GAME 2: STANDARD CRICKET

2-1の場合
GAME 1: 501または701
GAME 2: STANDARD CRICKET
GAME 3: GAME 1と同じ01 または STANDARD CRICKET
```

### 4.2 正式Ratingへ含めないデータ

以下は正式Ratingへ含めない。

- COUNT-UP
- 単独01
- 単独CRICKET
- 道場
- CRICKET COUNT-UP
- 既存の手入力PracticeRecord
- 既存の写真スコア練習記録
- 途中終了したMATCH
- `invalid`または論理削除されたMATCH / GAME
- インポートされた外部履歴
- 構成が不正なMATCH
- 未解決の保存エラーまたは投擲不整合があるMATCH

### 4.3 手動入力の扱い

DartsAppのMATCH画面で、プレイヤーが1投ずつ確定した`manualSegment`入力は正式Rating対象とする。

「手動入力を除外する」とは、投数・ルール・対戦構造が存在しない旧来のPracticeRecordへ数値だけ入力した記録を指す。ゲームエンジンを通して保存されたMATCH内の手動セグメント入力は除外しない。

以下も、ユーザーが最終確定した場合はRating対象にできる。

- `manualBoardPoint`
- `photoDetected`
- `photoAdjusted`

入力方法はRating値そのものを減点しない。修正率や画像候補の信頼性は、測定信頼度へだけ反映する。

---

## 5. Evaluation適格条件

### 5.1 MATCH単位の必須条件

次をすべて満たす場合、各参加プレイヤーの`rating_evaluations`を`eligible`にできる。

1. `matches.status = 'completed'`
2. `deleted_at IS NULL`
3. 参加プレイヤーが異なる2人
4. 勝者と敗者が確定済み
5. GAME 1が501または701の01
6. GAME 2がSTANDARD CRICKET
7. GAME 3が存在する場合は正しいCHOICE
8. 全構成GAMEが`completed`
9. MATCH勝数が2-0または2-1で整合
10. 各GAMEの投擲シーケンスが再構築可能
11. 各確定TURNに1～3本の投擲がある
12. Rating計算に必要な01とCRICKETの両方のデータがある
13. 最新の`source_revision`である

### 5.2 プレイヤー単位の必須条件

- MATCH参加者として登録されている
- 01でRating用投数が1以上
- CRICKETでRating用ラウンド数が1以上
- PPDが0.000～60.000の範囲
- MPRが0.000～9.000の範囲
- 未確定DARTが残っていない
- 同一TURN内に同じ`dart_no`が重複していない

### 5.3 早期ターン終了

通常TURNを1本または2本でユーザーが手動終了した場合、01のRating用投数は3本として扱う。

例:

```text
S20、S20の2本だけ入力して通常ターン終了
実DARTレコード数 = 2
Rating用投数 = 3
Rating用有効得点 = 40
PPD = 40 / 3
```

次の場合は実際に投げた本数だけを分母へ含める。

- CHECKOUT成立
- BUST成立
- ゲーム終了条件成立

0本で確定されたTURNは不正データとし、Evaluationを除外する。投げなかったことを記録する場合はMISSを入力する。

### 5.4 手動勝者決定

最大ラウンド到達後に、CORK等で勝者を手動選択したGAMEを含むMATCHは、PPD・MPRの能力値計算には利用できる。

ただし、恣意的な勝敗がRatingへ影響しないよう、そのMATCHの勝敗補正値は0とする。

---

## 6. 除外理由コード

`rating_evaluation_exclusions.reason_code`は次を基準とする。

| コード                    | 意味                        |
| ------------------------- | --------------------------- |
| `MATCH_NOT_COMPLETED`     | MATCHが完了していない       |
| `MATCH_ABORTED`           | 途中終了                    |
| `MATCH_DELETED`           | 論理削除済み                |
| `INVALID_MATCH_STRUCTURE` | GAME構成が不正              |
| `INVALID_PLAYER_COUNT`    | 2人でない、または重複       |
| `WINNER_INCONSISTENT`     | GAME勝数とMATCH勝者が不一致 |
| `GAME_NOT_COMPLETED`      | 構成GAMEが未完了            |
| `UNSUPPORTED_GAME_MODE`   | 対象外モードを含む          |
| `MISSING_ZERO_ONE_DATA`   | 01評価値がない              |
| `MISSING_CRICKET_DATA`    | CRICKET評価値がない         |
| `ZERO_DART_TURN`          | 0本確定TURNがある           |
| `DART_SEQUENCE_BROKEN`    | 投順重複・欠損等            |
| `UNRESOLVED_DART`         | 未確定投擲が残る            |
| `INVALID_PPD_RANGE`       | PPDが0～60外                |
| `INVALID_MPR_RANGE`       | MPRが0～9外                 |
| `IMPORTED_SOURCE`         | v1非対応の外部インポート    |
| `STALE_SOURCE_REVISION`   | 古い評価元リビジョン        |
| `DATA_INTEGRITY_ERROR`    | その他の整合性エラー        |

1つのEvaluationへ複数理由を保存できる。

---

## 7. 01 Rating指標

### 7.1 Rating用有効得点

01の各TURNについて、残り点へ正式に反映された得点だけを有効得点とする。

| TURN結果     |         Rating用有効得点 |
| ------------ | -----------------------: |
| 通常TURN     |           TURN内得点合計 |
| CHECKOUT     |   CHECKOUTまでの得点合計 |
| BUST         |                        0 |
| 訂正済みTURN | 最新確定リビジョンの結果 |
| 取消済みDART |      0、投数にも含めない |

BUST TURN内のDARTレコードは監査目的で保持するが、そのTURNの有効得点は0とする。

### 7.2 Rating用投数

```text
通常3投TURN                  = 3
通常1～2投で手動終了         = 3
CHECKOUT                     = 実際に投げた本数
BUST                         = BUST成立までの実投数
MISS                         = 1投
取消・無効DART               = 0投
相手の勝利で回ってこなかったTURN = 0投
```

### 7.3 GAME単位PPD

```text
Game PPD
= GAME内Rating用有効得点合計
÷ GAME内Rating用投数合計
```

### 7.4 MATCH単位PPD

MATCH内に01が2GAMEある場合は、投数で加重する。

```text
Match 01 PPD
= MATCH内全01有効得点合計
÷ MATCH内全01 Rating用投数合計
```

GAME PPDの単純平均は禁止する。

### 7.5 Window PPD

各MATCHの新しさの重みと投数を利用する。

```text
Window PPD
= Σ(matchWeight × matchEffectiveScore)
÷ Σ(matchWeight × matchRatingDarts)
```

### 7.6 3DA

```text
3DA = PPD × 3
```

3DAは表示用指標であり、Rating換算はPPDを正本とする。

---

## 8. CRICKET Rating指標

### 8.1 有効マーク

CRICKET対象は20、19、18、17、16、15、BULLとする。

| 命中                 | 基本マーク |
| -------------------- | ---------: |
| SINGLE               |          1 |
| DOUBLE               |          2 |
| TRIPLE               |          3 |
| OUTER BULL           |          1 |
| INNER BULL           |          2 |
| MISS、対象外ナンバー |          0 |

Rating用有効マークは、ゲーム状態へ正式に適用されたマーク数とする。

- 自分が未CLOSEのナンバーへのマークを含む
- 自分がCLOSE済みで相手が未CLOSEの場合の得点マークを含む
- 両者がCLOSE済みのナンバーへの命中は0マーク
- 取消・無効DARTは0マーク

FAT BULL / SEPARATE BULLの得点差はMPRへ影響させず、OUTER 1マーク、INNER 2マークで統一する。

### 8.2 Rating用ラウンド数

プレイヤーが実際に確定したTURN数をラウンド数とする。

```text
Rating Cricket Rounds
= そのプレイヤーの確定CRICKET TURN件数
```

- 1本または2本で終了したTURNも1ラウンド
- ゲーム終了で短縮されたTURNも1ラウンド
- 相手の勝利により回ってこなかったTURNは0ラウンド
- 0本TURNは不正データ

### 8.3 GAME単位MPR

```text
Game MPR
= GAME内Rating用有効マーク合計
÷ GAME内Rating用ラウンド数
```

### 8.4 MATCH単位MPR

MATCH内にCRICKETが2GAMEある場合は、ラウンド数で加重する。

```text
Match MPR
= MATCH内全CRICKET有効マーク合計
÷ MATCH内全CRICKET Rating用ラウンド数
```

### 8.5 Window MPR

```text
Window MPR
= Σ(matchWeight × matchEffectiveMarks)
÷ Σ(matchWeight × matchRatingRounds)
```

---

## 9. Rating指数換算

### 9.1 換算方式

PPDとMPRを、それぞれ1.0～18.0の連続指数へ変換する。

アンカー間は線形補間する。

```text
xがanchor[r]以上、anchor[r+1]以下の場合

Index
= r + (x - anchor[r])
    / (anchor[r+1] - anchor[r])
```

- 最低アンカー以下は1.0
- 最高アンカー以上は18.0
- 中間値は小数を保持

### 9.2 01 PPDアンカー

| Index |    PPD | 参考3DA |
| ----: | -----: | ------: |
|     1 | 10.000 |  30.000 |
|     2 | 13.333 |  40.000 |
|     3 | 15.000 |  45.000 |
|     4 | 16.667 |  50.000 |
|     5 | 18.333 |  55.000 |
|     6 | 20.000 |  60.000 |
|     7 | 21.667 |  65.000 |
|     8 | 23.333 |  70.000 |
|     9 | 25.000 |  75.000 |
|    10 | 26.667 |  80.000 |
|    11 | 28.333 |  85.000 |
|    12 | 30.000 |  90.000 |
|    13 | 32.000 |  96.000 |
|    14 | 34.000 | 102.000 |
|    15 | 36.000 | 108.000 |
|    16 | 38.000 | 114.000 |
|    17 | 40.000 | 120.000 |
|    18 | 42.000 | 126.000 |

42.000を超えるPPDも統計値として保持するが、01 Indexは18.0を上限とする。

### 9.3 CRICKET MPRアンカー

| Index |   MPR |
| ----: | ----: |
|     1 | 0.800 |
|     2 | 1.000 |
|     3 | 1.200 |
|     4 | 1.400 |
|     5 | 1.600 |
|     6 | 1.800 |
|     7 | 2.000 |
|     8 | 2.200 |
|     9 | 2.400 |
|    10 | 2.600 |
|    11 | 2.800 |
|    12 | 3.000 |
|    13 | 3.200 |
|    14 | 3.400 |
|    15 | 3.600 |
|    16 | 3.800 |
|    17 | 4.000 |
|    18 | 4.200 |

4.200を超えるMPRも統計値として保持するが、Cricket Indexは18.0を上限とする。

### 9.4 アンカーの位置付け

本アンカーはDartsApp calculation version 1の独自基準である。

将来、十分な匿名統計データを取得し、実力分布に合わせてアンカーを再調整する場合は、既存Snapshotを書き換えず`calculation_version = 2`として追加する。

---

## 10. 評価Window

### 10.1 最大件数

Rating確定後は、対象プレイヤーの直近最大10件のEligible MATCHを利用する。

```text
Window Size = min(Eligible MATCH総数, 10)
```

11件目以降の古いMATCHは現在Ratingから外れるが、履歴・過去Snapshotは保持する。

### 10.2 並び順

1. `matches.completed_at DESC`
2. 同時刻の場合は`matches.id DESC`

### 10.3 新しさの重み

| 新しい順 | Weight |
| -------: | -----: |
|        1 |   1.00 |
|        2 |   0.95 |
|        3 |   0.90 |
|        4 |   0.85 |
|        5 |   0.80 |
|        6 |   0.75 |
|        7 |   0.70 |
|        8 |   0.65 |
|        9 |   0.60 |
|       10 |   0.55 |

件数が10未満の場合は先頭から必要件数だけを使う。

---

## 11. 初回3MATCHの外れ値抑制

### 11.1 目的

初回Ratingが、たまたま1MATCHだけ極端に良い、または悪い結果に引っ張られることを防ぐ。

### 11.2 適用条件

Eligible MATCH総数が正確に3件になり、初回確定Ratingを作るときだけ適用する。

1件目・2件目の参考Rating、および4件目以降には適用しない。

### 11.3 PPDのWinsorize

3MATCHのMatch 01 PPDの中央値を求める。

```text
Adjusted Match PPD
= clamp(Match PPD, medianPPD - 6.0, medianPPD + 6.0)
```

### 11.4 MPRのWinsorize

```text
Adjusted Match MPR
= clamp(Match MPR, medianMPR - 0.6, medianMPR + 0.6)
```

調整後のPPD・MPRをWindow集計へ使用する。元の実績値は変更せず、`calculation_detail_json`へ元値と調整値の両方を保存する。

---

## 12. MATCH結果指数

### 12.1 基本方針

MATCH結果を単独の1～18固定値として混ぜると、低Ratingを不自然に押し上げ、高Ratingを不自然に押し下げる可能性がある。

そこでMatch Indexは、01 IndexとCricket Indexの中間値を基準とし、勝敗による相対補正を加える。

```text
Performance Mid Index
= (01 Index + Cricket Index) / 2
```

### 12.2 MATCHごとの結果補正

プレイヤー視点で次を使用する。

| MATCH結果          | Outcome Delta |
| ------------------ | ------------: |
| 2-0で勝利          |          +8.5 |
| 2-1で勝利          |          +5.0 |
| 1-2で敗北          |          -5.0 |
| 0-2で敗北          |          -8.5 |
| 手動勝者決定を含む |           0.0 |

Window内の補正値はMATCH Weightで加重平均する。

```text
Weighted Outcome Delta
= Σ(matchWeight × outcomeDelta)
÷ Σ(matchWeight)
```

### 12.3 Match Index

```text
Match Index
= clamp(
    Performance Mid Index + Weighted Outcome Delta,
    1.0,
    18.0
  )
```

Base RatingへはMatch Indexの10％だけが入るため、勝敗による最終Ratingへの影響は小さく抑えられる。

### 12.4 相手Rating補正

calculation version 1では相手Ratingによる補正を行わない。

理由:

- 未測定ゲストとの対戦が多い初期版でも計算を成立させる
- 相互依存による再計算の複雑化を避ける
- Ratingの90％を投擲実績で決める

将来、オンライン対戦・十分な対戦母数・不正対策を実装した段階で、version 2以降の検討対象とする。

---

## 13. Base Rating

```text
Base Rating
= 01 Index × 0.45
+ Cricket Index × 0.45
+ Match Index × 0.10
```

結果補正が0の場合、Match IndexはPerformance Mid Indexとなるため、実質的には01とCRICKETを50％ずつ評価する。

ただし保存上は、確定仕様どおり次の3要素を別々に保持する。

- `zero_one_index_milli`
- `cricket_index_milli`
- `match_index_milli`

---

## 14. 安定性補正

### 14.1 MATCH能力指数

Window内の各MATCHについて、Match 01 PPDとMatch MPRから個別指数を作る。

```text
Match Skill Index
= (Match 01 Index + Match Cricket Index) / 2
```

初回3MATCHの確定時は、外れ値抑制後のPPD・MPRを使う。

### 14.2 重み付き標準偏差

```text
weightedMean
= Σ(weight × matchSkillIndex) / Σ(weight)

weightedVariance
= Σ(weight × (matchSkillIndex - weightedMean)^2)
  / Σ(weight)

weightedStdDev
= sqrt(weightedVariance)
```

### 14.3 Stability Adjustment

Eligible MATCHが3件未満の場合は0とする。

```text
Stability Adjustment
= -min(
    0.60,
    max(0, weightedStdDev - 0.75) × 0.25
  )
```

- 標準偏差0.75以下: 減点なし
- 最大減点: -0.60
- 安定性による加点は行わない

安定していることへの小さな加点は、別のContinuity Bonusで扱う。

---

## 15. 継続ボーナス

### 15.1 適用条件

Window件数が5件以上の場合だけ適用する。

### 15.2 件数ボーナス

```text
Volume Continuity Bonus
= min(0.15, (windowMatchCount - 4) × 0.025)
```

| Window件数 | 件数ボーナス |
| ---------: | -----------: |
|          5 |       +0.025 |
|          6 |       +0.050 |
|          7 |       +0.075 |
|          8 |       +0.100 |
|          9 |       +0.125 |
|         10 |       +0.150 |

### 15.3 直近3MATCHの再現性

直近3MATCHのMatch Skill IndexとWindowの重み付き平均との差を確認する。

| 直近3MATCHの最大絶対差 | 再現性ボーナス |
| ---------------------: | -------------: |
|               1.00以下 |          +0.10 |
|               1.50以下 |          +0.05 |
|                 1.50超 |              0 |

### 15.4 Continuity Bonus

```text
Continuity Bonus
= min(
    0.25,
    Volume Continuity Bonus + Reproducibility Bonus
  )
```

単にプレイ回数が多いだけでRatingが大きく上がらないよう、最大+0.25に制限する。

---

## 16. Raw Target Rating

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

この値は平滑化前の現在能力推定値であり、`calculation_detail_json.rawTargetRating`へ保存する。

---

## 17. 初回測定と更新

### 17.1 0MATCH

- `rating_tenths = NULL`
- `measurement_status = 'unmeasured'`
- `confidence_bp = 0`

### 17.2 1MATCH

- 参考Ratingを計算して保存可能
- 画面表示: `参考Rating x.x`、`測定中 1/3`
- `measurement_status = 'provisional_1_of_3'`
- Confidence上限25％

### 17.3 2MATCH

- 参考Ratingを計算
- 画面表示: `参考Rating x.x`、`測定中 2/3`
- `measurement_status = 'provisional_2_of_3'`
- Confidence上限45％

### 17.4 3MATCH

- 初回DartsApp Ratingを確定
- 外れ値抑制を適用
- 前回値による平滑化は行わない
- `measurement_status = 'provisional'`

### 17.5 4MATCH以降の平滑化

1回のMATCHでRatingが急変しないよう、Raw Target Ratingを前回Snapshotへ段階的に近づける。

#### 4～9MATCH

```text
smoothedCandidate
= previousPreciseRating
+ 0.50 × (rawTargetRating - previousPreciseRating)

Final Precise Rating
= previousPreciseRating
+ clamp(
    smoothedCandidate - previousPreciseRating,
    -0.60,
    +0.60
  )
```

#### 10MATCH以上

```text
smoothedCandidate
= previousPreciseRating
+ 0.40 × (rawTargetRating - previousPreciseRating)

Final Precise Rating
= previousPreciseRating
+ clamp(
    smoothedCandidate - previousPreciseRating,
    -0.50,
    +0.50
  )
```

### 17.6 前回精密値

`previousPreciseRating`は、前回Snapshotの`calculation_detail_json.finalPreciseRating`を利用する。

古いSnapshotに精密値が存在しない場合だけ、`rating_tenths / 10`を使用する。

### 17.7 表示値への丸め

```text
rating_tenths
= round(clamp(finalPreciseRating, 1, 18) × 10)
```

Ratingは正の値だけなので、JavaScriptの`Math.round`で小数第1位への四捨五入として扱える。

途中のPPD、MPR、Index、補正値は永続化直前まで丸めない。

---

## 18. 測定信頼度

### 18.1 基本方針

Confidenceは実力の高低ではなく、現在のRatingをどの程度信頼できるかを示す。

```text
Confidence %
= Volume Factor × 55
+ Recency Factor × 15
+ Data Quality Factor × 15
+ Stability Factor × 15
```

最終保存:

```text
confidence_bp = round(Confidence % × 100)
```

例: 67.88％ → `6788`

### 18.2 Volume Factor

| Eligible MATCH総数 | Factor |
| -----------------: | -----: |
|                  0 |   0.00 |
|                  1 |   0.10 |
|                  2 |   0.25 |
|                  3 |   0.45 |
|                  4 |   0.55 |
|                  5 |   0.65 |
|                  6 |   0.72 |
|                  7 |   0.79 |
|                  8 |   0.86 |
|                  9 |   0.93 |
|             10以上 |   1.00 |

総数は過去の有効MATCH総数を使う。現在Windowが10件であることとは別に保持する。

### 18.3 Recency Factor

最新Eligible MATCHの完了日時から計算日時までの日数を使う。

|  経過日数 | Factor |
| --------: | -----: |
|    0～7日 |   1.00 |
|   8～30日 |   0.90 |
|  31～60日 |   0.75 |
|  61～90日 |   0.60 |
| 91～180日 |   0.40 |
| 181日以上 |   0.20 |

未来日時が入力された場合は0日として計算し、別途データ警告を記録する。

### 18.4 Data Quality Factor

手動セグメント入力自体は減点しない。

```text
correctionRate
= correctionCount / max(totalRatingDarts, 1)

adjustedShare
= adjustedDarts / max(totalRatingDarts, 1)

correctionPenalty
= min(0.25, correctionRate × 5)

adjustedPenalty
= min(0.10, adjustedShare × 0.20)
```

画像自動検出を含む場合、ユーザー確定前の平均候補信頼度を0～1で受け取る。

```text
photoConfidencePenalty
= min(
    0.15,
    max(0, 0.80 - averagePhotoConfidence) × 0.75
  )
```

自動検出がない場合は0とする。

```text
Data Quality Factor
= clamp(
    1.0
    - correctionPenalty
    - adjustedPenalty
    - photoConfidencePenalty,
    0.50,
    1.00
  )
```

### 18.5 Stability Factor

Eligible MATCHが1件の場合は0.50とする。

2件以上の場合:

```text
Stability Factor
= clamp(
    1.0 - weightedStdDev / 4.0,
    0.25,
    1.00
  )
```

### 18.6 仮測定時の上限

| MATCH数 | Confidence上限 |
| ------: | -------------: |
|       1 |        25.00％ |
|       2 |        45.00％ |
|   3以上 |       上限なし |

### 18.7 測定状態

| Eligible MATCH総数 | measurement_status   | UI表示     |
| -----------------: | -------------------- | ---------- |
|                  0 | `unmeasured`         | 未測定     |
|                  1 | `provisional_1_of_3` | 測定中 1/3 |
|                  2 | `provisional_2_of_3` | 測定中 2/3 |
|               3～4 | `provisional`        | 暫定       |
|               5～9 | `standard`           | 標準       |
|             10以上 | `stable`             | 安定       |

10件以上でも長期間プレイしていない場合、状態は`stable`のままとし、Confidence低下と「最終測定から○日」の表示で古さを示す。

---

## 19. DB保存マッピング

### 19.1 `rating_evaluations`

| 列                   | 保存内容                                               |
| -------------------- | ------------------------------------------------------ |
| `zero_one_ppd_milli` | Window計算前の当該MATCH PPD ×1000                      |
| `cricket_mpr_milli`  | 当該MATCH MPR ×1000                                    |
| `match_result`       | プレイヤー視点の`win` / `loss`                         |
| `correction_count`   | 当該MATCH内の確定後訂正数                              |
| `input_payload_json` | MATCHスコア、Outcome Delta、手動勝者有無、入力品質情報 |
| `source_revision`    | MATCH評価元リビジョン                                  |

`input_payload_json`例:

```json
{
  "matchScoreForPlayer": "2-1",
  "outcomeDelta": 5,
  "containsManualWinnerDecision": false,
  "effectiveZeroOneScore": 501,
  "ratingZeroOneDarts": 24,
  "effectiveCricketMarks": 24,
  "ratingCricketRounds": 10,
  "averagePhotoConfidence": null
}
```

### 19.2 `rating_evaluation_games`

- 01: `ppd_milli`、`three_dart_average_milli`、`darts_thrown`、`bust_count`
- CRICKET: `mpr_milli`、`marks_total`、`rounds_count`
- `darts_thrown`はRating用投数を保存する
- 画面上の実DART数が異なる場合は詳細JSONまたはGAME統計で両方保持する

### 19.3 `rating_snapshots`

| 列                           | 保存値                   |
| ---------------------------- | ------------------------ |
| `rating_tenths`              | 表示Rating ×10           |
| `confidence_bp`              | Confidence％ ×100        |
| `evaluated_match_count`      | 過去のEligible MATCH総数 |
| `window_match_count`         | 今回使用した1～10件      |
| `zero_one_index_milli`       | 01 Index ×1000           |
| `cricket_index_milli`        | Cricket Index ×1000      |
| `match_index_milli`          | Match Index ×1000        |
| `stability_adjustment_milli` | 補正値 ×1000、負値可     |
| `continuity_bonus_milli`     | ボーナス ×1000           |
| `calculation_version`        | 1                        |
| `calculation_detail_json`    | 全計算内訳               |

`calculation_detail_json`例:

```json
{
  "windowWeights": [1, 0.95, 0.9],
  "windowPpd": 23.333333,
  "windowMpr": 2.2,
  "zeroOneIndex": 8,
  "cricketIndex": 8,
  "performanceMidIndex": 8,
  "weightedOutcomeDelta": 0,
  "matchIndex": 8,
  "baseRating": 8,
  "weightedStdDev": 0,
  "stabilityAdjustment": 0,
  "continuityBonus": 0,
  "rawTargetRating": 8,
  "previousPreciseRating": null,
  "smoothingAlpha": null,
  "changeCap": null,
  "finalPreciseRating": 8,
  "displayRating": 8,
  "confidence": {
    "volumeFactor": 0.45,
    "recencyFactor": 1,
    "dataQualityFactor": 1,
    "stabilityFactor": 1,
    "percent": 69.75
  },
  "initialOutlierControl": {
    "applied": true,
    "medianPpd": 23.333333,
    "medianMpr": 2.2
  }
}
```

---

## 20. 計算モジュール構成

推奨ディレクトリ:

```text
src/
└─ domain/
   └─ rating/
      ├─ ratingTypes.ts
      ├─ ratingConstants.ts
      ├─ ratingEligibility.ts
      ├─ calculateZeroOneMetrics.ts
      ├─ calculateCricketMetrics.ts
      ├─ ratingIndexMapper.ts
      ├─ ratingWindow.ts
      ├─ ratingConfidence.ts
      ├─ calculateDartsAppRating.ts
      └─ index.ts

tests/
└─ rating/
   ├─ ratingEligibility.test.ts
   ├─ zeroOneMetrics.test.ts
   ├─ cricketMetrics.test.ts
   ├─ ratingIndexMapper.test.ts
   ├─ ratingConfidence.test.ts
   └─ calculateDartsAppRating.test.ts
```

現行リポジトリが`src/`を使わない構成の場合は、既存規約に合わせて`utils/rating/`等へ配置してよい。ただし画面ファイルへ計算式を直接置かない。

---

## 21. TypeScript論理型

```ts
export type MeasurementStatus =
  | 'unmeasured'
  | 'provisional_1_of_3'
  | 'provisional_2_of_3'
  | 'provisional'
  | 'standard'
  | 'stable';

export type MatchScoreForPlayer = '2-0' | '2-1' | '1-2' | '0-2';

export type RatingMatchInput = {
  evaluationId: string;
  matchId: string;
  completedAt: string;
  sourceRevision: number;
  matchScoreForPlayer: MatchScoreForPlayer;
  containsManualWinnerDecision: boolean;

  zeroOneEffectiveScore: number;
  zeroOneRatingDarts: number;
  zeroOnePpd: number;

  cricketEffectiveMarks: number;
  cricketRatingRounds: number;
  cricketMpr: number;

  totalRatingDarts: number;
  correctionCount: number;
  adjustedDarts: number;
  autoDetectedDarts: number;
  averagePhotoConfidence: number | null;
};

export type PreviousRatingSnapshotInput = {
  snapshotId: string;
  ratingTenths: number;
  finalPreciseRating: number | null;
};

export type RatingCalculationInput = {
  playerId: string;
  calculatedAt: string;
  eligibleMatchTotalCount: number;
  matchesNewestFirst: RatingMatchInput[];
  previousSnapshot: PreviousRatingSnapshotInput | null;
  calculationVersion: 1;
};

export type RatingCalculationResult = {
  calculationVersion: 1;
  measurementStatus: MeasurementStatus;
  ratingTenths: number | null;
  finalPreciseRating: number | null;
  rawTargetRating: number | null;
  confidenceBp: number;
  evaluatedMatchCount: number;
  windowMatchCount: number;
  zeroOneIndexMilli: number | null;
  cricketIndexMilli: number | null;
  matchIndexMilli: number | null;
  stabilityAdjustmentMilli: number;
  continuityBonusMilli: number;
  detail: RatingCalculationDetail;
};
```

### 21.1 公開関数

```ts
export function validateRatingMatch(input: RatingMatchInput): RatingEligibilityResult;

export function mapPpdToRatingIndex(ppd: number): number;

export function mapMprToRatingIndex(mpr: number): number;

export function calculateRatingConfidence(input: RatingConfidenceInput): RatingConfidenceResult;

export function calculateDartsAppRating(input: RatingCalculationInput): RatingCalculationResult;
```

全公開関数は入力オブジェクトを変更してはならない。

---

## 22. 計算処理順序

```text
1. 入力全体を検証する
2. MATCHをcompletedAt DESC、matchId DESCで安定ソートする
3. 最新10件をWindowとして取得する
4. 各MATCHのPPD、MPR、Outcome Deltaを検証する
5. 3件目の初回確定時だけ外れ値抑制を行う
6. Weightと投数からWindow PPDを計算する
7. Weightとラウンド数からWindow MPRを計算する
8. 01 Indexを計算する
9. Cricket Indexを計算する
10. Performance Mid Indexを計算する
11. Weighted Outcome Deltaを計算する
12. Match Indexを計算する
13. Base Ratingを計算する
14. Match Skill IndexとweightedStdDevを計算する
15. Stability Adjustmentを計算する
16. Continuity Bonusを計算する
17. Raw Target Ratingを計算する
18. 前回Snapshotが必要な場合は平滑化する
19. measurement_statusを決める
20. Confidenceを計算する
21. DB用整数へ変換する
22. 計算内訳を返す
```

### 22.1 擬似コード

```ts
function calculateDartsAppRating(input: RatingCalculationInput) {
  const matches = stableSortAndTakeLatest10(input.matchesNewestFirst);

  if (input.eligibleMatchTotalCount === 0 || matches.length === 0) {
    return createUnmeasuredResult();
  }

  const adjusted =
    input.eligibleMatchTotalCount === 3 ? applyInitialWinsorization(matches) : matches;

  const ppd = calculateWeightedPpd(adjusted);
  const mpr = calculateWeightedMpr(adjusted);

  const zeroOneIndex = mapPpdToRatingIndex(ppd);
  const cricketIndex = mapMprToRatingIndex(mpr);
  const performanceMid = (zeroOneIndex + cricketIndex) / 2;

  const outcomeDelta = calculateWeightedOutcomeDelta(adjusted);
  const matchIndex = clamp(performanceMid + outcomeDelta, 1, 18);

  const base = zeroOneIndex * 0.45 + cricketIndex * 0.45 + matchIndex * 0.1;

  const stdDev = calculateWeightedSkillStdDev(adjusted);
  const stabilityAdjustment = calculateStabilityAdjustment(stdDev, adjusted.length);
  const continuityBonus = calculateContinuityBonus(adjusted, stdDev);

  const rawTarget = clamp(base + stabilityAdjustment + continuityBonus, 1, 18);
  const finalPrecise = applySnapshotSmoothing(rawTarget, input);
  const confidence = calculateRatingConfidence(/* ... */);

  return createPersistableResult(/* ... */);
}
```

---

## 23. 訂正・無効化・再計算

### 23.1 MATCH完了後に投擲訂正した場合

1. 対象MATCHの`source_revision`を増やす
2. 旧`rating_evaluations`を`invalidated`
3. 旧評価に依存する当該Snapshot以降を`invalidated_at`付きで無効化
4. 新しい投擲正本からEvaluationを生成
5. 対象プレイヤーのEligible MATCHを古い順に再生
6. calculation version 1の同一ロジックでSnapshotを再構築
7. 現在Snapshotを更新

平滑化は前回Snapshotに依存するため、訂正MATCHだけを単発再計算してはならない。訂正時点以降を時系列で再構築する。

### 23.2 Evaluationが除外へ変わった場合

- 対象MATCHをWindowから除く
- それより古い次点MATCHがある場合はWindowへ繰り上げる
- 対象時点以降のSnapshotを再構築する

### 23.3 同一入力の再現性

以下が同じ場合、計算結果の全整数保存値が同じでなければならない。

- calculation version
- MATCH入力内容
- MATCH順序
- 計算日時の日付境界
- 前回Snapshot精密値

UUIDやSnapshot作成日時を除き、計算内訳も同じ値を返す。

---

## 24. エラー処理

### 24.1 計算を中止するエラー

- NaN / Infinity
- 負の投数・ラウンド数
- 必須MATCH ID欠損
- 日時形式不正
- MATCH件数と総数の矛盾
- 前回Ratingが1～18外
- calculation version不一致

これらは例外または型付き`Result`でApplication Layerへ返し、Snapshotを保存しない。

### 24.2 Evaluation除外として扱うエラー

特定MATCHだけの不整合は、全プレイヤーのRating計算を停止せず、そのEvaluationを除外して理由を保存する。

ただし、除外後にEligible MATCHが0件になった場合は未測定へ戻す。

### 24.3 DB保存失敗

計算成功後にDB保存が失敗した場合:

- 現在Ratingをメモリだけで確定表示しない
- `rating_recalculate` Outboxを再試行可能状態にする
- 既存Snapshotを維持する
- UIへ「Ratingの保存に失敗しました。再計算します」と表示する

---

## 25. UIへの出力契約

Rating概要画面へ最低限、次を渡す。

```ts
type RatingViewModel = {
  displayRating: string; // "8.0" または "--"
  label: '未測定' | '測定中' | '暫定' | '標準' | '安定';
  progressText?: '1/3' | '2/3';
  confidencePercent: number;
  eligibleMatchCount: number;
  windowMatchCount: number;
  zeroOnePpd: number | null;
  threeDartAverage: number | null;
  cricketMpr: number | null;
  zeroOneIndex: number | null;
  cricketIndex: number | null;
  lastEvaluatedAt: string | null;
  disclaimer: '独自方式による参考値';
};
```

### 25.1 Rating変動表示

```text
changeTenths
= current.rating_tenths - previousValid.rating_tenths
```

- `+3` → `+0.3`
- `-2` → `-0.2`
- 訂正再計算で履歴が変わった場合は「データ訂正により再計算」と表示する

### 25.2 除外MATCH表示

Rating履歴画面では、除外MATCHを削除せず次を表示する。

- Rating対象外
- 除外理由
- 訂正による無効化
- 現在Ratingは変化なし

---

## 26. 計算例

### 26.1 基準例: 初回3MATCH

3MATCHすべてが次の成績で、勝敗補正が0とする。

```text
PPD = 23.333
MPR = 2.200
```

換算:

```text
01 Index      = 8.000
Cricket Index = 8.000
Performance Mid Index = 8.000
Match Index   = 8.000
```

```text
Base Rating
= 8 × 0.45 + 8 × 0.45 + 8 × 0.10
= 8.000
```

ばらつきなし、継続ボーナス未適用:

```text
Raw Target Rating = 8.000
Final Rating = 8.0
```

データ品質・新しさが最大の場合のConfidence:

```text
0.45 × 55 + 1.00 × 15 + 1.00 × 15 + 1.00 × 15
= 69.75%
```

### 26.2 初級・3MATCHすべて0-2敗北

```text
PPD = 15.000  → 01 Index 3.000
MPR = 1.200   → Cricket Index 3.000
Outcome Delta = -8.5
Match Index = clamp(3.0 - 8.5, 1, 18) = 1.0
```

```text
Base Rating
= 3 × 0.45 + 3 × 0.45 + 1 × 0.10
= 2.8

Final Rating = 2.8
```

### 26.3 上級・3MATCHすべて2-0勝利

```text
PPD = 36.000 → 01 Index 15.000
MPR = 3.600  → Cricket Index 15.000
Outcome Delta = +8.5
Match Index = 18.0
```

```text
Base Rating
= 15 × 0.45 + 15 × 0.45 + 18 × 0.10
= 15.3

Final Rating = 15.3
```

### 26.4 初回外れ値抑制

3MATCHの値:

```text
PPD: 50.0, 20.0, 20.0
MPR: 7.0, 1.8, 1.8
```

中央値:

```text
medianPPD = 20.0
medianMPR = 1.8
```

調整:

```text
PPD: 26.0, 20.0, 20.0
MPR: 2.4, 1.8, 1.8
```

元の50.0 / 7.0を削除せず、初回計算への影響だけを抑える。

---

## 27. 必須テストケース

### 27.1 PPD

- 通常3投TURN
- 1～2投で手動終了し、分母を3とする
- 1投CHECKOUT
- 2投CHECKOUT
- 1投BUST
- 2投BUST
- BUST得点が分子へ入らない
- MISSが分母へ入る
- 取消DARTが分母へ入らない
- MATCH内01が2GAMEある場合の投数加重

### 27.2 MPR

- SINGLE / DOUBLE / TRIPLEのマーク
- OUTER / INNER BULL
- 両者CLOSE済み対象が0マーク
- 1投でゲーム終了したTURNも1ラウンド
- 相手勝利で未実施TURNを分母へ入れない
- MATCH内CRICKETが2GAMEある場合のラウンド加重

### 27.3 指数換算

- 各アンカーで整数Indexになる
- アンカー中間で線形補間される
- PPD 10未満は1.0
- PPD 42超は18.0
- MPR 0.8未満は1.0
- MPR 4.2超は18.0
- NaN / Infinityを拒否する

### 27.4 MATCH結果

- 2-0勝利 +8.5
- 2-1勝利 +5.0
- 1-2敗北 -5.0
- 0-2敗北 -8.5
- 手動勝者決定0
- 新しさWeightが正しい
- Match Indexが1～18にclampされる

### 27.5 初回測定

- 0件で未測定
- 1件で1/3、Confidence最大25％
- 2件で2/3、Confidence最大45％
- 3件で初回確定
- 3件時だけWinsorize
- 外れ値元データを変更しない

### 27.6 更新

- 4～9件でalpha 0.50、変動上限0.60
- 10件以上でalpha 0.40、変動上限0.50
- 11件目追加時に最古がWindowから外れる
- 前回精密値を使用する
- 表示値の丸めが正しい

### 27.7 安定性・継続

- 標準偏差0.75以下で減点0
- 最大減点-0.60
- 5件未満で継続ボーナス0
- 10件、直近3件安定で最大+0.25
- 最終値が1～18を超えない

### 27.8 Confidence

- Volume表全境界
- Recency表全境界
- 手動入力だけでは品質減点しない
- 訂正率で減点
- 画像調整比率で減点
- 低い画像信頼度で減点
- Data Quality Factorが0.50未満にならない
- Confidenceが0～10000bp内

### 27.9 訂正再計算

- source revision更新
- 旧Evaluation無効化
- 訂正時点以降のSnapshot再構築
- 次点MATCHのWindow繰上げ
- 同一入力で同一整数結果

---

## 28. 受入条件

以下をすべて満たした場合、Rating計算モジュールv1を受入可能とする。

1. 画面コンポーネントにRating数式がない
2. SQLiteへ依存しない純粋関数として単体テストできる
3. 01、CRICKET、MATCHの各指数内訳を返せる
4. 3MATCH未満を正式確定扱いしない
5. 3MATCH時に外れ値抑制が動く
6. 直近10MATCHと指定Weightを使用する
7. 勝敗は最終Ratingの一部にだけ影響する
8. 安定性減点が最大-0.60
9. 継続ボーナスが最大+0.25
10. 更新時の変動上限が守られる
11. ConfidenceをRatingと別に計算する
12. 訂正時に履歴を時系列再構築できる
13. 全中間値を`calculation_detail_json`から説明できる
14. 全必須テストが成功する
15. `npm run typecheck`、`npm test`、`npm run lint`が成功する

---

## 29. 実装上の禁止事項

- DARTSLIVE / PHOENIXの名称をRating段階名に使用する
- 公式レーティングと同一であるように表示する
- PPDとMPRの表示値だけから再計算し、投擲正本を無視する
- GAME PPDの単純平均を取る
- GAME MPRの単純平均を取る
- BUST TURNの得点を有効得点へ含める
- 1～2投の通常手動終了でPPDを不自然に上げる
- 途中計算を小数第1位へ丸める
- 過去Snapshotを上書きする
- 訂正後に依存Snapshotを残したまま現在値だけ変更する
- calculation versionを変更せずアンカーや数式を変更する

---

## 30. 将来拡張

calculation version 2以降の候補:

- 相手Ratingを考慮した勝敗補正
- オンライン対戦の本人確認・不正対策
- 直近期間と生涯実績を分けた二重Rating
- 01のCheckout能力を独立指標化
- CRICKETのクローズ速度・得点判断を独立指標化
- プレイヤー母集団に基づくアンカー再校正
- シーズンRating
- モード別Rating
- 信頼区間表示

これらはv1へ混在させず、計算バージョンを分けて導入する。

---

## 31. 確定仕様要約

```text
Rating範囲
・1.0～18.0
・小数第1位表示

正式対象
・DartsApp内で完了した2人MATCHのみ
・COUNT-UP、単独ゲーム、旧PracticeRecordは対象外

能力構成
・01 Index 45%
・Cricket Index 45%
・Match Index 10%

01
・PPD = 有効得点 / Rating用投数
・BUST TURN得点は0
・通常1～2投終了は分母3

CRICKET
・MPR = 有効マーク / 確定TURN数
・OUTER BULL 1、INNER BULL 2

初回測定
・1MATCH: 参考値 1/3
・2MATCH: 参考値 2/3
・3MATCH: 初回確定
・3MATCH時のみ外れ値抑制

更新
・直近最大10MATCH
・Weight 1.00～0.55
・4～9件: alpha 0.50、最大変動0.60
・10件以上: alpha 0.40、最大変動0.50

補正
・安定性: 0～-0.60
・継続: 0～+0.25

Confidence
・件数55%
・新しさ15%
・データ品質15%
・安定性15%

保存
・calculation_version = 1
・計算内訳をJSON保存
・訂正時は時系列で再構築
```
