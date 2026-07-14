# DartsSupportApp

DartsSupportApp は、iPhone でソフトダーツの練習メニュー、記録、分析、フォーム相談を確認するための Expo + React Native MVP です。

MVP v0.1 では実データ連携やAI連携は行わず、端末内ローカル保存と固定ロジックで、主要な画面遷移と練習支援の体験を確認できる状態にしています。

## MVPでできること

- 初期設定: レーティング、利用機種、主な悩みを保存
- ゲーム: COUNT-UP、単独01、単独STANDARD CRICKET、2人対戦MATCHの開始、再開、手入力、undo/redo、一時停止、中断、結果表示
- Account: 端末内ローカルAccountでRating所有者を識別
- 練習メニュー: レベル、悩み、ゲーム種別に応じたメニュー表示
- おすすめ練習: プロフィールと記録に基づく固定ロジック推薦
- 練習記録: 入力、一覧、詳細、編集、削除
- 写真スコア記録: 基準ボード画像、画像解析候補、半自動候補、手動タップ、ドラッグ/十字微調整で3本分のスコアとグルーピング傾向を保存
- 分析: 期間別集計、ゲーム別集計、簡易グラフ、改善コメント
- フォーム相談: カテゴリ別の固定アドバイス表示
- フォーム写真3枚相談: 正面、横、リリース後写真と自己チェック、直近写真スコアから固定ロジック助言、履歴保存/詳細/削除
- 相談履歴: 相談結果の保存、一覧、詳細、削除
- 資料ライブラリ: 知識記事の検索、カテゴリ/タグ絞り込み
- お気に入り: よく使う練習メニューの保存
- 表示設定: 白/グレー系テーマと背景色の切り替え

## 技術スタック

- Expo
- React Native
- TypeScript
- Expo Router
- React Context
- AsyncStorage
- expo-sqlite
- Node.js built-in test runner
- ESLint / Prettier

## Requirements

- Node.js 22 以上
- npm
- iPhone 実機、または iOS Simulator
- iPhone 実機で確認する場合は Expo Go

## Setup

```bash
npm install
```

## Start

```bash
npx expo start
```

起動後、ターミナルに表示されるQRコードを Expo Go で読み取ります。

よく使う起動コマンド:

```bash
npm run start:lan
npm run start:tunnel
```

## iPhone Expo Goで確認する

1. iPhone に Expo Go をインストールします。
2. PC と iPhone を同じネットワークに接続します。
3. `npx expo start` を実行します。
4. Expo Go でQRコードを読み取ります。
5. 初期設定、ホーム、練習記録、分析、相談履歴、資料検索を確認します。

Expo Goで確認している間は、画面上部に「コードスキャナー」などExpo Go側の表示が出ることがあります。これは開発確認用アプリのUIで、TestFlightやstandalone buildでは表示されません。

iOS Simulator が使える環境では、起動中のターミナルで `i` を押すか、次を実行します。

```bash
npm run ios
```

## EAS Build準備

Expo Goは開発確認用アプリ上でJavaScriptを読み込む確認方法です。TestFlightやApp Store配布では、EAS BuildでiOSアプリ本体を作成します。

EAS CLIはグローバルインストールせず、`npx eas-cli` でも利用できます。

```bash
npx eas-cli login
npx eas-cli init
npx eas-cli build:configure
npx eas-cli build --platform ios --profile preview
npx eas-cli build --platform ios --profile production
```

このリポジトリには `eas.json` を追加済みです。

同じビルド操作はnpm scriptsからも実行できます。

```bash
npm run eas:build:preview
npm run eas:build:production
npm run eas:submit:ios
```

Apple Developer Program未加入の場合、iOS配布ビルド、証明書作成、TestFlight提出の段階で止まる可能性があります。Apple Team ID、EAS projectId、App Store Connect情報は実行後に確定するため、架空値は入れていません。EAS Build本番実行は、人間側でAppleログインと証明書設定を確認してから行います。

## TestFlightへ進む前に必要なもの

- Apple Developer Programへの加入
- App Store Connectでの新規アプリ作成
- Bundle ID: `com.shijimiworks.dartssupportapp`
- App Store Connect用のPrivacy Policy URL
- サポートURL
- TestFlight用スクリーンショット
- 内部テスター設定

## Legal pages

アプリ内に公開前確認用ページを追加しています。

- `/legal/privacy`
- `/legal/terms`
- `/legal/credits`

v0.1.0時点ではログイン、クラウド同期、AI API連携、公式API連携はなく、入力データは端末内AsyncStorageに保存されます。外部送信は行っていません。

写真スコア記録MVPでは、画像そのものの永続保存は必須にしていません。練習記録には、ボードキャリブレーション、タップ座標、判定結果、候補由来、信頼度、合計スコアなどを保存します。

空のボード写真を基準画像として登録できます。写真スコア記録時に基準画像と現在画像のキャリブレーション差を評価し、中心ズレ、外周半径差、20方向の角度差を警告します。現時点ではExpo Goで動く範囲を優先しているため、実ピクセル差分による完全なダーツ検出は未実装で、単一画像候補βまたはキャリブレーション候補へフォールバックします。

画像解析候補は完全自動判定ではありません。Expo Goで動く軽量構成を優先しているため、候補が外れる場合はユーザーが候補選択後にドラッグ微調整するか、手動タップで追加します。

3本の座標から、まとまり具合、上下左右の偏り、縦散り/横散りを分析し、リリース、スタンス、フォロースルー、狙い位置に関する固定ロジックのアドバイスを表示します。

フォーム写真3枚相談MVPでは、正面、横、リリース後の写真と自己チェックをもとに、スタンス、グリップ、リリース、フォロースルー、体の開き、リズムに関する固定ロジックの助言を表示します。画像AIによる骨格推定や自動フォーム診断はまだ行いません。直近の写真スコア記録がある場合は、グルーピング傾向も助言に反映します。

フォーム写真相談の結果は端末内に保存され、履歴一覧と詳細画面で見返せます。不要な履歴は削除できますが、練習記録や写真スコア記録には影響しません。

操作の流れ:

1. `/photo-score` で写真を選択または撮影します。
2. 中心、20方向、外周を順番にタップしてボードを合わせます。
3. 必要に応じて `/photo-score/reference` で空のボード基準画像を登録します。
4. 基準画像比較、画像候補β、半自動候補、手動タップから3本の位置を選びます。
5. 必要に応じて選択点をドラッグ/十字微調整します。
6. 結果画面でスコア、判定元、グルーピング分析、アドバイスを確認して保存します。

## Display settings

設定画面から表示テーマと背景色を選択できます。

- 背景色: 黒 `#040000`
- 背景色: ブラウン `#955629`
- 背景色: 紫 `#A64A97`
- 背景色: オレンジ `#F6AD3C`
- 背景色: 白 `#FFFFFF`

## Quality checks

```bash
npm run typecheck
npm run lint
npm run format:check
npm test
npm run validate:data
```

## Game Database / COUNT-UP / 01 / CRICKET / MATCH / Account / Rating Foundation

Phase 1では、後続のCOUNT-UP / 01 / CRICKET / MATCH実装に向けたSQLiteゲーム基盤を追加しています。
Phase 2では、COUNT-UPの縦断実装を追加しています。
Phase 3では、1人用の単独01縦断実装を追加しています。
Phase 4では、ローカルAccount、OWNER紐付け、Rating Profile、単独Rating候補判定の基盤を追加します。
共通Account契約では、DartsApp / DartsSupportApp連携へ向けてAccount ID、共通JSON、CommonEvent、Outbox、Export / Import検証の境界を追加します。
Phase 5では、1人用の単独STANDARD CRICKET縦断実装を追加しています。
Phase 6では、2人対戦MATCH縦断実装を追加しています。

- DBファイル名: `dartsapp_games.db`
- 保存方式: `expo-sqlite`
- migration管理: `PRAGMA user_version` と `db_migrations`
- v1 migration: `features/game/infrastructure/sqlite/migrations/001_initial.ts`
- v2 migration: `features/game/infrastructure/sqlite/migrations/002_account_rating_foundation.ts`
- v3 migration: `features/game/infrastructure/sqlite/migrations/003_common_account_contract.ts`
- SQL正本: `docs/specs/DartsApp_DB_v1_schema.sql`

DB初期化時に以下を適用します。

```sql
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA synchronous = NORMAL;
PRAGMA busy_timeout = 5000;
```

ゲーム領域の正本はSQLiteです。既存プロフィール、練習記録、写真スコア、相談履歴、表示設定は引き続きAsyncStorageの `AppState` に保持します。SQLiteから既存PracticeRecordへ反映する将来連携は `integration_outbox` を境界にします。

COUNT-UPでできること:

- `/game` からCOUNT-UPを開始
- `/game/count-up/settings` でBull設定を選択
- `/game/count-up/[gameId]` で手入力、undo/redo、ラウンド確定、一時停止、再開、中断
- 8ラウンド確定で `/game/count-up/[gameId]/result` に結果表示
- 完了時に `game_player_results` と `integration_outbox` を作成
- `client_action_id` で投擲入力の冪等性を担保
- COUNT-UPはRating対象外

単独01でできること:

- `/game` から01 GAMEを開始
- `/game/01/settings` で開始点、アウト方式、Bull設定を選択
- 開始点は 301 / 501 / 701 / 901
- アウト方式は SINGLE OUT / MASTER OUT
- `/game/01/[gameId]` で手入力、undo/redo、TURN終了、一時停止、再開、中断
- BUST時は投擲を保存したうえでTURNを即時終了し、残り点をTURN開始時へ戻す
- CHECKOUT時は結果を保存し、`/game/01/[gameId]/result` へ遷移
- 15ラウンド終了時にCHECKOUTしていない場合はround limitとして完了
- 完了時に `game_player_results`、`integration_outbox`、`practice_record_links` を作成
- 初回Rating確定前はRating対象外
- 初回Rating確定後はAccount OWNERの正常完了ゲームをRating評価候補として保存

単独STANDARD CRICKETでできること:

- `/game` からSTANDARD CRICKETを開始
- `/game/cricket/settings` でBull設定を選択
- `/game/cricket/[gameId]` で20/19/18/17/16/15/BULLの手入力、undo/redo、TURN終了、一時停止、再開、中断
- 各ターゲットは3マークでCLOSEし、CLOSE後のOver MarkをCRICKET得点へ加算
- 全7ターゲットCLOSEかつCRICKET得点1点以上で自然終了
- 全7ターゲットCLOSE済みでもCRICKET得点0点なら終了せず、15ラウンド以内は継続
- 15ラウンド終了時はround limitとして完了し、0点全CLOSEはclear扱いにしない
- 完了時に `game_player_results`、`cricket_number_states`、`integration_outbox`、`practice_record_links` を更新
- 初回Rating確定前はRating対象外
- 初回Rating確定後はAccount OWNERの正常完了ゲームを `standalone_cricket` のRating評価候補として保存

2人対戦MATCHでできること:

- `/game` からMATCHを開始
- `/game/match/settings` でGAME1の開始点501/701、Out、Bull、GAME1先攻、相手Playerを選択
- GAME1は01、GAME2はSTANDARD CRICKET
- GAME2の先攻はGAME1先攻ではないプレイヤー
- 1勝1敗の場合のみ `/game/match/[matchId]/choice` でGAME3の種目と先攻を選択
- GAME3で01を選んだ場合、開始点はGAME1と同じ501または701
- 先に2勝したプレイヤーをMATCH勝者として保存
- 2人対戦CRICKETは全7ターゲットCLOSE済みでも0点なら自然勝利せず、15ラウンド以内は継続
- `/game/match/[matchId]` で手入力、undo/redo、TURN終了、一時停止、再開、中断、手動勝者確定
- undo/redoは `darts.status` を `active` / `voided` に更新し、物理削除しない
- MATCH完了時に `match_player_results`、OWNERのみのpending `rating_evaluations`、`rating_evaluation_games`、`rating_recalculate` Outbox、`common_events`、`common_outbox(local_only)` を作成
- Rating計算本体とSnapshot更新はPhase 6では実行しない
- DartsSupportApp通信、API通信、クラウド同期は実装しない

Account / Rating基盤:

- `/account/register` で端末内ローカルAccountを登録
- `/account/profile` でAccount状態、OWNER紐付け、Rating状態、共通Account IDを表示
- `/account/rating-status` で初回MATCH測定状態と単独Rating対象可否を表示
- Account登録はゲーム開始の必須条件ではありません
- GUESTには正式Rating Profile、Rating Evaluation、Rating Snapshotを作成しません
- COUNT-UPは常にRating対象外です
- Rating計算本体、Snapshot更新エンジン、Rating履歴画面の完全実装は後続フェーズで扱います

共通Account契約:

- `account_id` はUUID v4形のAccount IDを外部契約の正本にします
- 既存Account IDは書き換えず、旧IDがある場合は段階的移行用の `legacy_account_id` を保持できます
- OWNER Playerは `players.account_id` でAccountへ紐付き、Rating Profileは `account_id` を所有者として保持します
- `features/common-contract` がAccount、OWNER profile、Rating、Game Session、MATCH、CommonEvent、Export Envelopeをsnake_case JSONへ変換します
- `common_events` と `common_outbox` は将来同期用のローカル境界です
- 現段階のOutbox状態は `local_only` で、DartsSupportApp通信、API通信、クラウド同期は実装しません
- Importはcontract名、version、UUID、payloadの検証と件数プレビューだけを行い、既存DBを無条件上書きしません

Rating計算本体、効果音・アワード動画は次フェーズ以降で実装します。

## App identity

- App name: `DartsSupportApp`
- Expo slug: `darts-support-app`
- Version: `0.1.0`
- iOS bundle identifier: `com.shijimiworks.dartssupportapp`
- Logo path: `assets/images/logo.png`
- Icon path: `assets/images/icon.png`
- Splash path: `assets/images/splash.png`

## 現在未対応のこと

- DARTSLIVE / PHOENIX 公式API連携
- AI API連携
- クラウド同期
- ログイン
- Supabase / Apple Login / Google Login
- 外部グラフライブラリ
- 本番向けデータバックアップ

## 注意

- DARTSLIVE / PHOENIX の公式ロゴ、公式画像、公式APIは使用していません。
- 機種名は文字ラベルとしてのみ使用しています。
- 練習・相談内容は一般化したプロトタイプ用情報です。
- 医療的な診断や治療を目的としたものではありません。

## Docs

- `docs/MVP_FEATURES.md`
- `docs/ROUTES.md`
- `docs/ARCHITECTURE.md`
- `docs/implementation/PHASE_1_REPORT.md`
- `docs/implementation/PHASE_2_REPORT.md`
- `docs/implementation/PHASE_3_REPORT.md`
- `docs/implementation/PHASE_4_REPORT.md`
- `docs/implementation/DARTSAPP_COMMON_CONTRACT_REPORT.md`
- `docs/implementation/PHASE_5_REPORT.md`
- `docs/implementation/PHASE_6_REPORT.md`
- `docs/implementation/OPEN_QUESTIONS.md`
- `docs/EAS_BUILD_GUIDE.md`
- `docs/TESTFLIGHT_PREP.md`
- `docs/APP_STORE_METADATA_DRAFT.md`
- `docs/QA_CHECKLIST.md`
- `docs/RELEASE_NOTES_v0.1.md`
- `docs/design/README.md`
