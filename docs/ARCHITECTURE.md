# Architecture

DartsSupportApp MVP v0.1 の構成メモです。

## app/

Expo Router のルート画面を配置します。

- `app/index.tsx`: 初期設定
- `app/home.tsx`: ホーム、ゲーム開始/再開導線
- `app/game*.tsx`: ゲームハブ、COUNT-UP設定/プレイ/結果、01設定/プレイ/結果、CRICKET設定/プレイ/結果、MATCH設定/プレイ/CHOICE/結果
- `app/account*.tsx`: ローカルAccount登録、共通Account ID表示、Rating状態表示
- `app/practice*.tsx`: 練習メニューと履歴
- `app/record.tsx`: 練習記録入力
- `app/records*.tsx`: 練習記録一覧/詳細/編集
- `app/photo-score*.tsx`: 写真スコア記録、基準画像登録、候補選択、結果保存
- `app/analysis.tsx`: 分析
- `app/consult*.tsx`: フォーム相談と相談履歴
- `app/library*.tsx`: 資料ライブラリ
- `app/favorites.tsx`: お気に入り練習
- `app/settings.tsx`: 設定編集

## components/

画面間で使う共通UIです。

- `AppButton`: 共通ボタン
- `Card`: カード表示
- `ScreenShell`: SafeArea + ScrollView + BottomNav
- `BottomNav`: 主要5画面へのタブ導線
- `PracticeMenuCard`: 練習メニューカード
- `PracticeRecordForm`: 練習記録フォーム
- `SimpleBarChart`: 軽量バーグラフ
- `StatCard`: 統計カード

## constants/

アプリ内固定データです。

- `practiceMenus.ts`: 練習メニューDB
- `consultAdvice.ts`: 悩み別アドバイスDB
- `knowledgeBase.ts`: 知識記事DB
- `labels.ts`: ラベル定義
- `levels.ts`: レベル判定
- `theme.ts`: 色と余白

## contexts/

`AppStateContext.tsx` が AsyncStorage とReact Contextを接続します。

保持する主な状態:

- `profile`
- `records`
- `favoritePracticeMenuIds`
- `practiceFilterState`
- `consultHistories`
- `formPhotoAdviceResults`
- `boardReferenceImages`
- `activeAccountId`

`GameDatabaseContext.tsx` はゲーム領域のSQLite接続、Repository入口、Service入口を提供します。

公開する状態:

- DB初期化中か
- DB利用可能か
- 初期化エラー
- `PlayerRepository` / `MatchRepository` / `GameRepository` / `RatingRepository` / `IntegrationOutboxRepository`
- `CountUpGameService`
- `ZeroOneGameService`
- `CricketGameService`
- `MatchGameService`
- `AccountService`
- `StandaloneRatingCandidateService`

`AppStateContext` へ投擲履歴やMATCH履歴を混在させません。ゲームの正本は `dartsapp_games.db` のSQLite、既存MVP状態の正本はAsyncStorageです。

## features/game/

ゲーム機能は画面から分離し、次のレイヤーに分けます。

- `domain/`: enum値、ドメイン型、COUNT-UP/01/CRICKET/MATCHスコア計算、ID生成、ゲーム領域エラー
- `application/`: Repository port、COUNT-UP/01/CRICKET/MATCHアプリケーションサービス
- `infrastructure/sqlite/`: DB初期化、migration、Repository実装、row mapper

Phase 2ではCOUNT-UPの縦断実装を追加しています。Phase 3では単独01の縦断実装を追加します。Phase 5では単独STANDARD CRICKETの縦断実装を追加します。Phase 6では2人対戦MATCHの縦断実装を追加します。画面は `CountUpGameService`、`ZeroOneGameService`、`CricketGameService`、`MatchGameService` を通じてSQLiteへ保存し、既存AsyncStorageのPracticeRecordへは直接書き込みません。単独ゲーム完了時は `integration_outbox` と `practice_record_links` にpending状態を作り、後続フェーズの同期処理境界にします。MATCH完了時はOWNERのみのRating Evaluation候補、`rating_recalculate` Outbox、CommonEvent、`common_outbox(local_only)` を作成します。

SQLite DB:

- ファイル名: `dartsapp_games.db`
- migration: `PRAGMA user_version` と `db_migrations`
- v1: 19テーブル、Outbox、投擲の `client_action_id` 冪等制約、進行中GAME/MATCHの一意制約
- v2: Account、OWNER紐付け、Rating Profile、Rating Evaluation v2、Rating Snapshot v2、migration orphan保存
- v3: 共通Account契約用 `common_events`、`common_outbox`、段階的移行用 `accounts.legacy_account_id`
- Phase 6ではmigration 004を追加せず、`PRAGMA user_version = 3` を維持
- SQL正本: `docs/specs/DartsApp_DB_v1_schema.sql`

COUNT-UP:

- 単独ゲームとして `game_sessions.mode = 'count_up'` に保存
- `max_rounds = 8`、1プレイヤー、Rating対象外
- 手入力ダーツは `darts.input_source = 'manual_segment'`、`is_rating_eligible = 0`
- `client_action_id` で二重入力を防止
- undo/redoは `darts.status` を `active` / `voided` に更新し、物理削除しない
- 8ラウンド確定時に `game_player_results`、`integration_outbox`、`practice_record_links` を作成

単独01:

- 単独ゲームとして `game_sessions.mode = 'zero_one'` に保存
- `max_rounds = 15`、1プレイヤー、Rating対象外
- 開始点は `zero_one_start_score` に 301 / 501 / 701 / 901 を保存
- アウト方式は `out_rule` に `single_out` または `master_out` を保存
- Bull方式は `bull_rule` に保存し、FAT BULL / SEPARATE BULLの得点計算に使う
- 手入力ダーツは `darts.input_source = 'manual_segment'`、`is_rating_eligible = 0`
- 投擲得点は入力値ではなく、area、segment、Bull方式からドメイン層で再計算する
- BUSTはdart行を保存したままTURNを終了し、`turns.raw_score` に実投得点、`turns.applied_score` に0を保存する
- CHECKOUTまたは15ラウンド上限で `game_player_results`、`integration_outbox`、`practice_record_links` を作成する
- `integration_outbox` は `practice_record_upsert` をpendingで作成し、consumerは後続フェーズに残す
- 初回Rating確定前は `rating_candidate = 0`
- 初回Rating確定後、Account OWNERの完了ゲームは `rating_candidate = 1` とし、pending `rating_evaluations` と `rating_recalculate` Outboxを作成する
- Rating計算本体とSnapshot適用はPhase 4では実行しない

単独STANDARD CRICKET:

- 単独ゲームとして `game_sessions.mode = 'cricket'` に保存
- `max_rounds = 15`、1プレイヤー、Rating確定前はRating対象外
- 対象は20/19/18/17/16/15/BULLで、3マーク以上をCLOSEとして `cricket_number_states` に保存する
- CLOSE後のOver MarkだけをCRICKET得点へ加算する
- 全7ターゲットCLOSEかつCRICKET得点1点以上で `completion_reason = 'all_closed_with_score'` として自然終了する
- 全7ターゲットCLOSE済みでもCRICKET得点0点の場合は自然終了せず、15R到達時に `completion_reason = 'round_limit'`、`clearFlag = false` で完了する
- MPRは有効マーク合計を確定TURN数で割り、milli単位で保存する
- undo/redoは `darts.status` を `active` / `voided` に更新し、物理削除しない
- 完了時に `game_player_results`、`integration_outbox`、`practice_record_links` を作成する
- 初回Rating確定後、Account OWNERの完了ゲームは `source_type = 'standalone_cricket'` のpending `rating_evaluations` と `rating_recalculate` Outboxを作成する
- Rating計算本体とSnapshot適用はPhase 5では実行しない

2人対戦MATCH:

- `matches` と `match_players` を親にし、各GAMEは `game_sessions.match_id` と `match_game_no` で紐付ける
- GAME1は `mode = 'zero_one'`、開始点は501または701
- GAME2は `mode = 'cricket'`、先攻はGAME1先攻ではないプレイヤー
- 1勝1敗時のみ `choice_required` となり、GAME3の01/CRICKETと先攻をユーザーが選択する
- GAME3で01を選んだ場合はGAME1と同じ開始点を保存する
- 先に2勝したPlayerを `matches.winner_player_id` として確定し、`match_player_results` を保存する
- 2人対戦01は15R上限、ラウンド上限時は残り点が少ないPlayerを勝者、完全同点は手動勝者を要求する
- 2人対戦CRICKETは相手が未CLOSEのターゲットへのOver Markだけ得点化し、全CLOSE済みでも0点なら自然勝利しない
- 2人対戦CRICKETの15R上限は得点、CLOSE数、Marks順で比較し、完全同点は手動勝者を要求する
- undo/redoは画面セッション内だけRedo候補を持ち、DBでは `darts.status` を `active` / `voided` に更新して物理削除しない
- MATCHは初回Rating確定前でもOWNER Playerの `source_type = 'match'` 評価候補を作成する
- GUEST PlayerにはRating Evaluation、Rating Profile、Rating Snapshotを作成しない
- Rating計算本体とSnapshot適用、DartsSupportApp通信はPhase 6では実行しない

## features/account/

Account機能は端末内でRating所有者を識別するためのローカル基盤です。

- `domain/`: Account状態、入力検証、email normalize
- `application/`: Account登録、active Account取得、OWNER紐付け、Rating Profile初期化
- `infrastructure/sqlite/`: AccountとRating ProfileのSQLite Repository

Phase 4では`auth_provider = 'local'`のみを扱い、パスワード、クラウド認証、本人確認トークンは保存しません。

OWNER PlayerはAccountに紐づきます。GUEST Playerは`account_id = NULL`のままで、正式Rating Profile、Rating Evaluation、Rating Snapshotを持ちません。

## features/common-contract/

DartsApp / DartsSupportAppの将来連携に向けた外部JSON契約境界です。

- `domain/types.ts`: snake_case JSON契約、CommonEvent、CommonOutbox、Export Envelope
- `application/accountMapper.ts`: AccountとOWNER/GUEST profileの共通JSON変換
- `application/ratingMapper.ts`: Rating Profileの共通JSON変換
- `application/gameSessionMapper.ts`: 完了済みゲームセッションの共通JSON変換
- `application/matchMapper.ts`: 完了済みMATCHの共通JSON変換
- `application/events.ts`: `account_created`、`game_session_completed`、`rating_updated`などのCommonEvent生成
- `application/exportEnvelope.ts`: `contract_name = darts_common_data`、`contract_version = 1` のExport Envelope生成
- `application/importValidator.ts`: Import JSONの検証とプレビュー

内部DB型は既存のcamelCase/SQLite構造を維持し、外部境界だけsnake_caseへ変換します。Importは検証のみで、既存データの無条件上書きやDartsSupportApp通信は行いません。

## features/game/domain/rating/

Phase 4ではRating計算本体ではなく、評価候補判定の境界を追加します。

- MATCHは初回3件でRatingを確定する将来評価元
- 単独01と単独CRICKETはRating確定後だけ評価候補
- COUNT-UP、道場、CRICKET COUNT-UPは対象外
- 除外理由は `ACCOUNT_NOT_REGISTERED`、`OWNER_NOT_LINKED`、`INITIAL_RATING_NOT_ESTABLISHED` などのreason codeで扱う

`rating_evaluations` は `source_type = match | standalone_zero_one | standalone_cricket` を保持します。単独ゲームは `source_weight_milli = 500`、MATCHは `1000` です。

## utils/

画面から分離したロジックです。

- `analyzePracticeRecords.ts`: 分析集計
- `recommendPracticeMenus.ts`: おすすめ練習
- `generateConsultAdvice.ts`: 相談回答
- `generateFormPhotoAdvice.ts`: フォーム写真3枚相談の固定ロジック助言
- `createConsultHistory.ts`: 相談履歴生成
- `searchKnowledgeBase.ts`: 資料検索
- `detectDartCandidatesFromImage.ts`: 写真スコアの自動候補β検出入口
- `detectDartCandidatesFromDifference.ts`: 基準画像比較候補の入口とフォールバック制御
- `evaluatePhotoDetectionQuality.ts`: 基準画像と現在画像のキャリブレーション品質評価
- `boardCoordinateTransform.ts`: 画像座標とボード正規化座標の変換
- `photoScoreCandidates.ts`: キャリブレーション候補生成、候補マージ、ヒット生成
- `analyzePhotoScoreGrouping.ts`: 写真スコア3点のグルーピング、偏り、散り方、助言生成
- `appStateMigration.ts`: 保存データmigration
- `validateDataIntegrity.ts`: DB参照整合性チェック

## tests/

Node.js built-in test runner で pure TypeScript ロジックを検証します。

- 分析ロジック
- おすすめ練習ロジック
- 相談回答ロジック
- フォーム写真相談ロジック
- migration
- COUNT-UPドメイン計算
- COUNT-UPサービスとSQLite永続化
- CRICKETドメイン計算
- CRICKETサービスとSQLite永続化
- MATCHドメイン計算
- MATCHサービスとSQLite永続化
- データ整合性
- 資料検索

## 保存データ構造

AsyncStorage key:

- `DartsSupportApp:appState`
- 旧互換用:
  - `DartsSupportApp:userProfile`
  - `DartsSupportApp:practiceRecords`

現在の `AppState`:

```ts
{
  schemaVersion: 10,
  activeAccountId: string | null,
  profile: UserProfile | null,
  records: PracticeRecord[], // photoScore?: PhotoScoreEntry を含む場合あり
  favoritePracticeMenuIds: string[],
  practiceFilterState: PracticeFilterState,
  consultHistories: ConsultHistory[],
  formPhotoAdviceResults: FormPhotoAdviceResult[],
  boardReferenceImages: BoardReferenceImage[],
  uiTheme: 'light' | 'gray',
  backgroundTheme: 'black' | 'brown' | 'purple' | 'orange' | 'white'
}
```

## schemaVersion 10

Phase 4で `activeAccountId: string | null` を追加します。

- schemaVersion 9以前からのmigrationでは `activeAccountId = null`
- SQLite migration後、active OWNERに紐づくAccountが1件なら設定可能
- DBに存在しないAccount IDはnullへ修復
- 既存プロフィール、練習記録、写真スコア、相談履歴、表示設定は維持

## schemaVersion 9

現在は相談履歴保存の `consultHistories`、フォーム写真相談結果の `formPhotoAdviceResults`、写真スコア基準画像の `boardReferenceImages`、実機表示調整用の `uiTheme`、背景色選択用の `backgroundTheme`、写真スコア記録用の `PracticeRecord.photoScore` を扱います。

初期値:

- `uiTheme`: `gray`
- `backgroundTheme`: `white`
- `boardReferenceImages`: `[]`

Migration方針:

- schemaVersion 1〜8 は `consultHistories: []`、`formPhotoAdviceResults: []`、`boardReferenceImages: []`、`uiTheme: 'gray'`、`backgroundTheme: 'white'` を必要に応じて補完
- 既存のプロフィール、練習記録、お気に入り、フィルタ条件、相談履歴、フォーム写真相談結果、写真スコア関連データは維持
- 壊れたJSONはクラッシュさせず、legacy/default値へフォールバック
- 複雑な破損データ修復はMVP範囲外

写真スコアMVP:

- 画像そのものの永続保存は必須にしない
- `BoardCalibration`、タップ座標、`DartHitResult[]`、合計スコア、Bull/Triple/Double数を保存
- `PhotoScoreGroupingAnalysis` はグループ中心、まとまり半径、上下左右の偏り、縦散り/横散り、助言をoptionalで保存
- `DartHitResult` には `detectionSource`、`candidateId`、`confidence` をoptionalで保存
- `detectionSource` は `imageAnalysisCandidate`、`autoCandidate`、`manualTap`、`adjusted` を扱う
- `BoardReferenceImage` は空のボード写真URI、ボード種別、キャリブレーション、撮影メモ、画像サイズを保存する
- 分析画面は既存の `score` / `bullCount` を使うため、大きな変更なしで反映される

写真スコア候補フロー:

1. `detectDartCandidatesFromDifference` が基準画像、現在画像URI、現在キャリブレーションを受け取る
2. `evaluatePhotoDetectionQuality` が中心差、外周半径差、20方向角度差、縦横比差を評価する
3. MVPでは実ピクセル差分は未実装のため、`detectDifferenceCandidates` は差し替え用の境界として空配列を返す
4. 差分候補がない場合、`fallbackToSingleImageCandidates` が `detectDartCandidatesFromImage` の自動候補βへフォールバックする
5. 画像候補が作れない場合、`generateCalibrationBasedCandidates` がボード幾何ベースの補助候補を返す
6. `mergePhotoScoreCandidates` が画像候補βと補助候補を統合し、近い候補を重複除去して最大件数へ制限する
7. ユーザーが候補を選択するか、手動で刺さった先端位置を追加し、ドラッグまたは十字ボタンで微調整する
8. 最終的な採点は、ユーザーが選択・調整した3点だけで行う
9. 将来OpenCV、ML Kit、TensorFlow Lite、Core ML / Visionへ移行する場合は `detectDifferenceCandidates` または `detectDartCandidatesFromImage` の内部を差し替える
10. 本格的な画像認識を使う場合は、Expo Goではなく EAS Development Build でネイティブ依存を検証する

現在の自動候補βは、Expo Goで動く軽量な候補表示であり、完全な画像認識ではありません。
候補が外れる前提で、手動追加、ドラッグ調整、十字微調整を主導線にしています。

基準画像比較フェーズ1:

- `/photo-score/reference` でボード種別ごとに空のボード基準画像を管理する
- `/photo-score/reference/register` で空ボード写真、中心、20方向、外周、撮影条件メモを保存する
- `/photo-score/mark` では登録済み基準画像がある場合に「基準画像と比較して候補を探す」を表示する
- 現在は品質評価とフォールバックの導線を完成させ、実ピクセル差分は未実装
- `PhotoDetectionQuality` と `DifferenceDetectionResult` は将来の画像差分/AI検出結果を同じUIに流し込むための境界

フォーム写真3枚相談MVP:

- `FormPhotoAdviceResult` として、利き手、3枚写真の種類、自己チェック、直近写真スコア連携、助言、確認ポイント、おすすめ練習IDを保存
- `formPhotoAdviceResults` は `AppState` 内の配列として AsyncStorage に保存し、履歴一覧・詳細・削除で利用する
- MVPでは画像そのものの永続保存は必須にせず、結果保存時は写真タイプとメモを中心に残す
- 画像AIによる骨格推定や自動フォーム診断は行わない
- `generateFormPhotoAdvice` が自己チェックと直近 `PracticeRecord.photoScore.groupingAnalysis` を組み合わせて固定ロジックで助言する
- 将来的に Vision、ML Kit、MediaPipe、MoveNet、OpenCV へ拡張する場合は、写真解析層を追加し、`generateFormPhotoAdvice` の入力に姿勢特徴量を渡す構造へ拡張する
- ネイティブ画像解析を使う場合は Expo Go ではなく EAS Development Build で検証する
