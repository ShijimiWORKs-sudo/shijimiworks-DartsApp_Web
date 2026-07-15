# DartsApp Codex Phase 8 実装指示書

- フェーズ: Phase 8 PC横長ゲームUI最適化
- 文書バージョン: 1.0
- ローカル作業先: `C:\制作データ\10_App\DartsApp`
- リポジトリ: `ShijimiWORKs-sudo/shijimiworks-DartsApp_Web`
- 作業ブランチ: `codex/phase-8-pc-landscape-ui`
- ベース: Phase 7 PC Web Foundationマージ済み`main`
- 正式確認環境: Windows 11 / Chrome / Edge
- 基準解像度: 1280×720 / 1920×1080
- 並列作業: 条件付きで必須

---

## 1. 目的

Phase 7で動作可能になったDartsAppのPC Web版を、ダーツ台の横長モニターで操作しやすいゲームUIへ最適化してください。

```text
PC横長画面
→ ゲーム開始まで迷わない
→ 得点・残り点・マークが離れていても読める
→ マウス操作で誤入力しにくい
→ 1280×720で縦スクロールを最小化
→ 1920×1080で余白を有効活用
```

既存のゲームロジック、SQLite、Account、Rating候補、Web WASM基盤は維持してください。

## 2. 正本として読む文書

```text
docs/audit/DARTSAPP_FEATURE_INVENTORY_v1.0.md
docs/audit/DARTSAPP_BOUNDARY_GAPS_v1.0.md
docs/audit/DARTSAPP_NEXT_ACTIONS_v1.0.md
docs/PC_WEB_SETUP.md
docs/PC_WEB_QA_CHECKLIST.md
docs/implementation/PHASE_7_REPORT.md
docs/ROUTES.md
docs/ARCHITECTURE.md
```

必要に応じてPhase 2～6レポートとゲーム仕様書も参照してください。

## 3. 実装対象

### 必須

- PC Web用レスポンシブレイアウト基盤
- PC用トップバーまたはサイドナビ
- WebではSupport系BottomNavを主要導線から外す
- HomeとGame Hubの横長再設計
- COUNT-UP設定・プレイ・結果のPCレイアウト
- 01設定・プレイ・結果のPCレイアウト
- STANDARD CRICKET設定・プレイ・結果のPCレイアウト
- MATCH設定・プレイ・CHOICE・結果のPCレイアウト
- Account概要のPC向け表示調整
- 1280×720で主要操作が画面内に収まる
- 1920×1080で過度に引き伸ばさない
- Chrome / Edge実機QA
- WebとExpo Goの回帰確認
- テスト・文書・Draft PR

### 対象外

- ゲームルール変更
- DB schema / migration追加
- Rating計算本体、Rating Snapshot更新
- 効果音・動画再生
- USBカメラ、realtime scoring
- キーボードショートカット本格実装
- フルスクリーンAPI
- Support機能の物理削除
- DartsSupportAppリポジトリ変更
- Supabase / API / cloud sync
- Expo SDK更新
- 新規UIフレームワーク導入

## 4. 最優先ルール

1. COUNT-UP、01、CRICKET、MATCHのロジックを変更しない。
2. Phase 7のWeb SQLite基盤を壊さない。
3. `crossOriginIsolated=true`を維持する。
4. Account保存・復元を壊さない。
5. migration 004を追加しない。
6. `PRAGMA user_version=3`を維持する。
7. iPhone / Expo Goでも操作可能な状態を維持する。
8. Web専用UIは`Platform.OS === 'web'`やレスポンシブ設計で分離する。
9. Support系routeを削除せず、URL直アクセスを壊さない。
10. 新規dependencyは追加しない。
11. `git reset --hard`、force pushは禁止。
12. `git add .`、`git add -A`は禁止。
13. 未追跡資料、audio、video、licensesを変更・commitしない。
14. mainへ自動マージしない。

## 5. 作業開始

```powershell
cd "C:\制作データ\10_App\DartsApp"
git status --short
git fetch origin
git switch main
git pull --ff-only origin main
git switch codex/phase-8-pc-landscape-ui
git pull --ff-only origin codex/phase-8-pc-landscape-ui
git branch --show-current
```

ローカルブランチがない場合のみ:

```powershell
git switch --track origin/codex/phase-8-pc-landscape-ui
```

baseline:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run validate:data
npm.cmd run web -- --port 8104 --clear
```

実装前にChromeで`/home`、`/game`、各設定画面を1280×720と1920×1080で記録してください。

## 6. 並列作業

### Stage 0：統合担当が直列でUI契約を確定

- Web breakpoint
- 最大コンテンツ幅
- PCトップバー / サイドバー構造
- ゲーム画面共通shell
- スコアパネル共通仕様
- 入力パッド共通仕様
- モバイルfallback
- Agentのファイル所有範囲

共通候補:

```text
components/web/WebAppShell.tsx
components/web/WebTopNavigation.tsx
components/web/WebGameShell.tsx
components/web/WebScorePanel.tsx
components/web/WebActionPanel.tsx
components/web/webLayout.ts
```

推奨breakpoint:

```text
desktop: 1024px以上
compact desktop: 1280×720
wide desktop: 1600px以上
mobile/tablet: 1023px以下は既存UIを維持
```

### Agent A：共通Web Shell・Home・Game Hub

所有:

```text
components/web/**
app/home.tsx
app/game/index.tsx
tests/web/webLayout.test.ts
```

担当: PC共通shell、トップナビ、Home、Game Hub、再開カード、最近のゲーム、モード色、2解像度対応。

### Agent B：COUNT-UP・01

所有:

```text
app/game/count-up/**
app/game/01/**
components/game/countUp/**
components/game/zeroOne/**
tests/web/countUpDesktopLayout.test.ts
tests/web/zeroOneDesktopLayout.test.ts
```

担当: 設定・プレイ・結果、文字サイズ、スコア優先順位、入力パッド、Undo / Redo / TURN終了、戻るUI。service / domain / DBは変更しない。

### Agent C：CRICKET

所有:

```text
app/game/cricket/**
components/game/cricket/**
tests/web/cricketDesktopLayout.test.ts
```

担当: マーク表、20～15 / BULL、CLOSE、得点、MPR、入力パッド、1280×720対応。判定ロジックとDBは変更しない。

### Agent D：MATCH

所有:

```text
app/game/match/**
components/game/match/**
tests/web/matchDesktopLayout.test.ts
```

担当: MATCH設定、GAME進行、01 / CRICKET表示、MATCHスコア、CHOICE、結果、Player切替。Service、Rating、DB、Common Contractは変更しない。

### Agent E：Account・QA・docs

所有:

```text
app/account/**
docs/PC_WEB_QA_CHECKLIST.md
docs/implementation/PHASE_8_REPORT.md
README.md
```

担当: Account PC表示、Chrome / Edge QA、Before / After、モバイル回帰、Phase 8レポート。

### 統合担当のみ

```text
app/_layout.tsx
components/BottomNav.tsx
components/Screen.tsx
components/Card.tsx
components/AppButton.tsx
```

必要な場合のみ最小変更。同一ファイルを複数Agentで同時編集しないこと。

## 7. PC Webナビゲーション

Webの主要導線は`HOME / GAME / ACCOUNT`とし、必要なら`HISTORY / SETTINGS`を追加できます。Support系機能を主導線にしないでください。

Webで主要導線から外すもの:

- 今日の練習
- 練習記録
- 分析
- フォーム相談
- 資料ライブラリ
- お気に入り
- iPhone用BottomNav

routeやデータは削除しません。WebではBottomNavを非表示にし、PCトップナビへ置き換え、Expo Goでは既存BottomNavを維持してください。トップバーは56～64px程度を目安とし、ゲーム中は簡略表示可能です。

## 8. Home

優先順位:

1. 進行中ゲーム / MATCHの再開
2. ゲームを始める
3. Account / Rating状態
4. 最近の結果
5. Web DB状態や補助情報

ゲーム開始CTAを大きくし、Support系カードを主役にしないでください。1280×720では2列、狭い画面では1列へ戻します。

## 9. Game Hub

4モードを横並びまたは2×2で表示します。

```text
COUNT-UP: 緑
01 GAME: 青
STANDARD CRICKET: 赤
MATCH: 紫
```

すべて白文字を維持。各カードにモード名、説明、Rating対象可否、開始ボタンを表示し、進行中ゲームがあれば再開を上位へ表示します。

## 10. 共通ゲーム画面

推奨構造:

```text
┌─────────────────────────────────────────────┐
│ Game Header / Mode / Round / Player         │
├──────────────────────┬──────────────────────┤
│ Score / Status       │ Input Pad            │
│ Player / Stats       │ Undo / Redo / Confirm│
├──────────────────────┴──────────────────────┤
│ Secondary info / darts / messages           │
└─────────────────────────────────────────────┘
```

プレイ中の通常操作で縦スクロールを要求しないこと。DART入力、TURN終了、残り点をファーストビュー内に保ちます。

文字サイズ目安:

```text
主要スコア: 48～96px
Player名: 22～32px
Round / status: 18～24px
入力ボタン: 16～22px
補助説明: 13～16px
```

操作領域:

- 最小クリック高44px以上
- 主要操作48～64px
- Undoと途中終了を隣接させない
- 危険操作は赤系
- disabled、hover、focus-visibleを明確にする
- tab移動でフォーカスを表示する

本格的なキーボードショートカットは実装しません。

## 11. COUNT-UP

優先表示: 合計得点、ROUND、現在TURN得点、入力済み3投、簡易統計。入力パッドは右側へまとめ、8R結果では総得点と平均を大きく表示します。

## 12. 01

優先表示: 残り点、TURN開始残り点、ROUND、現在TURN得点、OUT/BULLルール、BUST/CHECKOUT。MATCH内では両者残り点とcurrent playerを明確にし、BUST時に残り点が戻ったことを強調します。

## 13. STANDARD CRICKET

単独では20～15 / BULL、マーク、CLOSE、得点、MPR、current turn marksを表示。MATCHではPlayer 1 / 2を比較し、current player、得点可能状態、両者CLOSEを区別します。記号だけでなく色・線・テキストを併用してください。

## 14. MATCH

固定表示: MATCH score、GAME番号、mode、current player、Round、Player 1 / 2。GAME間はwinnerとスコア、次へ進むボタンを表示。CHOICEは選択者、01/CRICKET、先攻、確定を1280×720内に収めます。

## 15. 設定画面

PCでカードを縦積みしすぎず、左に設定項目、右にサマリー・Rating説明・開始ボタンを配置する構成を推奨します。開始ボタンは常時見える位置に置きます。

## 16. 結果画面

上部に結果、勝者または合計、PPD / 3DA / MPR、completion reason。下部に詳細統計、ROUND別、ターゲット別、Outbox / Rating候補。主要結果をファーストビューへ表示します。

## 17. レスポンシブ・モバイル回帰

次を壊さないこと:

- Expo Go縦画面
- 1024px未満Web
- 画面拡大125%
- 長いPlayer名
- 日本語文言
- Account未登録
- DB一時エラー

Web専用要素にはaccessibilityRole、label、focusを設定してください。

## 18. QA

Chrome / Edgeの両方で1280×720と1920×1080を確認します。

対象:

- Home
- Game Hub
- COUNT-UP設定 / プレイ / 結果
- 01設定 / プレイ / 結果
- CRICKET設定 / プレイ / 結果
- MATCH設定 / プレイ / CHOICE / 結果
- Account
- reload後の復元
- Console errorなし

合格基準:

- 主要操作が画面外にない
- プレイ中の通常操作で縦スクロール不要
- スコアとcurrent playerが明確
- 4モード色を維持
- Support系BottomNavがWeb主導線に出ない
- Web SQLiteとAccount復元が正常
- Chrome / Edge両方
- Expo Go回帰

## 19. テスト

既存195テストを壊さないこと。breakpoint、Web/nativeナビ切替、4モード色、desktop shell、primary action、current player、input panel order、Web BottomNav非表示、mobile BottomNav維持、長いPlayer名、結果summary、route回帰を追加してください。

必須:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run format:check
npm.cmd test
npm.cmd run validate:data
npx.cmd expo export --platform web
npm.cmd run web -- --port 8104 --clear
```

## 20. 文書

更新:

```text
README.md
docs/PC_WEB_QA_CHECKLIST.md
docs/implementation/PHASE_8_REPORT.md
docs/ROUTES.md
docs/ARCHITECTURE.md
```

Phase 8レポートにBefore / After、各画面、2解像度、Chrome、Edge、Expo Go、テスト、未実装、次工程を記録してください。

## 21. Git / PR

作業ブランチ:

```text
codex/phase-8-pc-landscape-ui
```

推奨commit:

```text
feat(web): optimize game UI for PC landscape
```

Draft PRタイトル:

```text
Phase 8: PC landscape game UI
```

mainへマージしないでください。

## 22. 完了報告

実装概要、並列作業、Agent別成果、共通shell、Webナビ、Home、Game Hub、各ゲーム、Account、2解像度、Chrome、Edge、Expo Go、全検証、テスト総数、変更ファイル、branch、commit SHA、push、Draft PR、mergeable、未追跡資料維持、次フェーズ候補を報告してください。

今回はPC横長UI最適化で停止し、Rating、音源・動画、カメラ判定へ進まないでください。
