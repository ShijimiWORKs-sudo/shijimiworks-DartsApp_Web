# DartsApp 詳細設計書 v1.1

- 文書名: DartsApp 詳細設計書
- 文書バージョン: 1.1
- 基準日: 2026-07-13
- 対象リポジトリ: `ShijimiWORKs-sudo/shijimiworks-DartsApp_Web`
- 旧版: `DartsApp_詳細設計書_v1.0.md`
- 関連資料:
  - `DartsApp_DB設計書_v1.1.md`
  - `DartsApp_画面遷移設計書_v1.1.md`
  - `DartsApp_Rating計算モジュール仕様書_v1.1.md`

---

## 1. 改訂目的

v1.1では、v1.0のCOUNT-UP、単独01、STANDARD CRICKET、MATCH、Rating基盤を維持しつつ、次を正式仕様として追加・変更する。

1. STANDARD CRICKETの自然終了では0点上がりを認めない
2. 初回3MATCHでRatingが確定した後は、単独01・単独CRICKETもRating変動対象にできる
3. Ratingの所有者を端末内PlayerだけでなくAccountで管理する
4. OWNERとGUESTの責務を明確化する
5. 既存端末データを破壊せずAccount・Rating基盤へ移行する
6. クラウド認証導入前でも、ローカルアカウントでRating所有者を識別できるようにする

v1.0と矛盾する場合はv1.1を優先する。

---

## 2. 対象範囲

### 2.1 初期ゲーム

- COUNT-UP: 8ラウンド固定
- 単独01: 301 / 501 / 701 / 901、最大15ラウンド
- 単独STANDARD CRICKET: 20 / 19 / 18 / 17 / 16 / 15 / BULL、最大15ラウンド
- MATCH: 2人対戦、01 → CRICKET → 必要時CHOICE

### 2.2 将来機能

- 道場 50ラウンド
- CRICKET COUNT-UP
- DOUBLE OUT
- クラウド認証
- 複数端末同期
- オンライン対戦
- 写真採点からのゲーム入力

---

## 3. システム構成

### 3.1 保存領域

| 領域 | 正本 | 主なデータ |
|---|---|---|
| UI・既存プロフィール | AsyncStorage AppState | テーマ、端末設定、activeAccountId |
| ゲーム | SQLite `dartsapp_games.db` | GAME、TURN、DART、結果、Outbox |
| Account | SQLite | ローカルアカウント、OWNER紐付け |
| Rating | SQLite | Evaluation、Profile、Snapshot、除外理由 |
| 将来認証トークン | SecureStore等 | 外部認証導入時のみ |

パスワードをAsyncStorageまたはSQLiteへ保存してはならない。

### 3.2 レイヤー

- Presentation: Expo Router、React Native
- Application: ゲームサービス、Accountサービス、Rating適格判定
- Domain: 得点、BUST、CLOSE、MPR、Rating純粋計算
- Persistence: SQLite Repository、migration、Outbox
- Integration: PracticeRecord、将来クラウド認証

画面からSQLを直接実行しない。

---

## 4. Account設計

### 4.1 Accountの目的

Accountは「誰のRatingか」を識別する単位とする。Playerはゲーム参加者、Accountは本人識別・Rating所有者であり、両者を分離する。

```text
Account
└─ OWNER Player（Rating所有者）

Guest Player
└─ Accountなし、正式Ratingなし
```

### 4.2 Account状態

```ts
export type AccountStatus =
  | 'profile_incomplete'
  | 'local_registered'
  | 'cloud_verified'
  | 'disabled'
  | 'deleted';
```

Phase 4では`profile_incomplete`と`local_registered`だけを実装する。

### 4.3 ローカルアカウント登録

入力項目:

- ユーザーID: 3～20文字、英小文字・数字・アンダースコア
- 表示名: 1～30文字
- メールアドレス: 任意。クラウド連携時に確認必須

ローカル登録は本人確認を伴わないため、画面に次を表示する。

```text
現在はこの端末内でRating所有者を識別するための登録です。
クラウド同期・本人確認は今後対応予定です。
```

### 4.4 OWNER紐付け

- Account 1件につきactive OWNER Playerは1件
- OWNER PlayerはAccount 1件だけに紐づく
- GUESTは`account_id = NULL`
- Account削除時もゲーム履歴を物理削除しない
- Account削除後はPlayer表示を匿名化できる

### 4.5 active Account

初期版では端末上のactive Accountは1件とし、`AppState.activeAccountId`で保持する。

- AppState schemaVersionを10へ更新
- 未登録時は`null`
- Account切替は将来機能
- DBに存在しないIDなら`null`へ修復

---

## 5. Ratingライフサイクル

### 5.1 初回確定

初回RatingはMATCHのみで確定する。

```text
0 MATCH: 未測定
1 MATCH: 参考値 1/3
2 MATCH: 参考値 2/3
3 MATCH: 初回Rating確定
```

単独01・単独CRICKETは3MATCH確定前でも保存・分析できるが、Ratingへ遡及反映しない。

### 5.2 Rating確定後

Rating確定後は次を評価元にできる。

- Eligible MATCH
- Account OWNERの単独01
- Account OWNERの単独STANDARD CRICKET

単独ゲームはMATCHより弱い重みで反映し、1ゲームでの総合Rating変動を最大±0.2に制限する。

### 5.3 Account必須条件

単独ゲームをRating対象にするには次をすべて満たす。

1. active Accountが存在
2. Accountが`local_registered`または`cloud_verified`
3. AccountとOWNER Playerが紐付いている
4. Ratingが3MATCHで確定済み
5. GAME開始日時が`rating_established_at`以降
6. GAMEが正常完了またはラウンド上限で完了
7. データ整合性エラーがない

未達の場合はゲーム自体は実行できるが、`rating_candidate = 0`とする。

---

## 6. プレイヤー管理

### 6.1 OWNER

- active Accountの本人Player
- 正式Ratingの所有者
- 単独ゲームのRating評価対象になり得る
- 端末内にactive OWNERは1件

### 6.2 GUEST

- アカウント不要
- ローカルMATCH参加可能
- 正式Ratingを持たない
- Rating Snapshotを作成しない
- 将来本人がアカウント登録しても、過去GUEST履歴を自動統合しない

---

## 7. ゲーム共通仕様

### 7.1 ライフサイクル

```text
draft → ready → in_progress ↔ paused
in_progress → completed / aborted / invalid
paused → aborted
```

### 7.2 自動保存

- GAME開始
- 1投ごと
- TURN確定
- ROUND終了
- pause
- バックグラウンド移行前
- GAME完了
- 訂正

### 7.3 Undo / Redo

- 現在の未確定TURN内だけ
- UndoはDARTを`voided`へ変更し物理削除しない
- Redo候補は画面セッション内メモリだけ
- 画面blur、pauseしてハブへ戻る、再起動、TURN確定でRedo候補を破棄
- BUST / CHECKOUT後のTURNは通常Undo不可

### 7.4 進行中ゲーム

端末内で`in_progress`または`paused`のGAMEは1件まで。

---

## 8. COUNT-UP

v1.0およびPhase 2実装を維持する。

- 8ラウンド固定
- Rating対象外
- Account未登録でも実行可能

---

## 9. 単独01

### 9.1 ルール

- 301 / 501 / 701 / 901
- 最大15ラウンド
- SINGLE OUT / MASTER OUT
- FAT BULL / SEPARATE BULL

### 9.2 Rating

- 初回Rating確定前: Rating対象外
- 初回Rating確定後: Account OWNERの正常完了GAMEを01指数更新候補にする
- MATCH指数・CRICKET指数は単独01で直接変更しない
- `source_type = standalone_zero_one`

### 9.3 単独01の評価対象完了理由

- `checkout`
- `round_limit`

`aborted`、`invalid`、論理削除は除外する。

---

## 10. STANDARD CRICKET

### 10.1 対象

- 20
- 19
- 18
- 17
- 16
- 15
- BULL

### 10.2 マーク

| 命中 | マーク |
|---|---:|
| SINGLE | 1 |
| DOUBLE | 2 |
| TRIPLE | 3 |
| OUTER BULL | 1 |
| INNER BULL | 2 |
| 対象外 / MISS | 0 |

### 10.3 CLOSE

累積3マークでCLOSEする。3を超えた分をOver Markとする。

### 10.4 単独CRICKETの得点

単独CRICKETでは、自分がCLOSE済みのナンバーへ追加したOver Markを得点へ変換する。

- 20～15: 1 Over Markにつきナンバー点
- BULL: 1 Over Markにつき25点
- INNER BULLは2マーク

### 10.5 0点上がり禁止

自然終了条件は次の両方を満たすこと。

```text
全7ターゲットをCLOSE
かつ
CRICKET得点 > 0
```

全CLOSEしても得点0ならゲームを継続する。CLOSE済みターゲットで得点を作るまで自然終了しない。

15ラウンド到達時は得点0でもGAME自体は`round_limit`で完了するが、次を保存する。

```text
clear_flag = false
completion_reason = round_limit
final_cricket_score = 0
```

### 10.6 MATCH内CRICKET

自然勝利条件:

1. 全ターゲットCLOSE
2. 自分の得点が1点以上
3. 自分の得点が相手以上

両者0点では自然勝利を作らない。

15ラウンド到達時は自然上がりと区別し、次の順で判定する。

1. 得点
2. CLOSE数
3. 総有効マーク数
4. 完全同値なら手動勝者決定

0対0でもラウンド上限判定により勝者が決まる場合はあるが、`clear_flag = false`とし「0点上がり」とは扱わない。

### 10.7 MPR

```text
MPR = 有効マーク合計 ÷ 確定TURN数
```

単独ゲームでは、CLOSE後のOver Markも有効マークに含める。対象外ナンバー・取消DARTは含めない。

### 10.8 Rating

- 初回Rating確定前: 対象外
- Rating確定後: Account OWNERの単独CRICKETをCricket指数更新候補にする
- 01指数・MATCH指数は単独CRICKETで直接変更しない
- 0点round limitでもMPR評価は可能
- `source_type = standalone_cricket`

---

## 11. MATCH

v1.0の構成を維持する。

```text
GAME 1: 501または701
GAME 2: STANDARD CRICKET
GAME 3: CHOICE（必要時）
```

初回Rating確定はEligible MATCH 3件で行う。

Account OWNERだけが正式Ratingを所有する。GUESTの成績はMATCH結果として保存するが、Rating Snapshotは作成しない。

---

## 12. Rating候補判定

### 12.1 GAME開始時

`rating_candidate`は開始時点で仮判定する。

- MATCH内GAME: MATCH評価候補
- 単独01 / CRICKET: Account登録済みかつRating確定済みなら1
- COUNT-UP等: 0

### 12.2 GAME完了時

開始時判定を再検証する。Account状態変更、データ不整合、開始日時不一致があれば除外する。

### 12.3 遡及禁止

Rating確定前に完了した単独ゲームを、Rating確定後に遡って有効化しない。

---

## 13. 画面要件

### 13.1 Account

- アカウント登録
- アカウントプロフィール
- Rating測定状態
- ローカル登録であることの説明

### 13.2 ゲーム設定

単独01・CRICKET設定画面へ次を表示する。

- `Rating対象外: 初回3MATCH未完了`
- `Rating対象: 確定済みAccount` 
- `Rating対象外: Account未登録`

### 13.3 Rating概要

- Account表示名
- DartsApp Rating
- 測定状態
- Eligible MATCH数
- 01指数
- CRICKET指数
- MATCH指数
- 単独ゲーム評価可否

---

## 14. エラー処理

| 状態 | 処理 |
|---|---|
| Account未登録 | ゲーム継続、Ratingのみ除外 |
| Account参照欠損 | activeAccountId修復、Rating除外 |
| OWNER未紐付け | 登録導線表示 |
| migration失敗 | DB初期化禁止、安全なエラー表示 |
| Rating評価元不整合 | Evaluationをexcluded |
| CRICKET全CLOSE0点 | ゲーム継続 |

---

## 15. 非機能要件

- Account情報を不要にログへ出さない
- メールアドレスを平文ログへ出さない
- パスワードを保存しない
- migrationは前進のみ
- 既存COUNT-UP・01履歴を保持
- Rating再計算は純粋TypeScript化
- 単独ゲーム連打によるRating操作を重み・変動上限で抑制

---

## 16. 受入条件

1. 既存OWNERがAccountへ安全に紐づく
2. Account未登録でもゲームは遊べる
3. Ratingは3MATCH前に確定しない
4. 3MATCH確定後のみ単独01・CRICKETがRating候補になる
5. Rating確定前の単独履歴は遡及しない
6. 単独CRICKETは全CLOSEかつ得点1以上で自然終了する
7. 全CLOSE0点では入力を継続できる
8. 15ラウンド0点はround limit・clear falseになる
9. GUESTに正式Ratingを作らない
10. 既存ゲーム・履歴・Outboxを破壊しない
