# DartsApp Codex Phase 7 実装指示書

- フェーズ: Phase 7 PC Web Foundation
- 文書バージョン: 1.0
- ローカル作業先: `C:\制作データ\10_App\DartsApp`
- リポジトリ: `ShijimiWORKs-sudo/shijimiworks-DartsApp_Web`
- 作業ブランチ: `codex/phase-7-pc-web-foundation`
- ベース: Phase 6 MATCH・製品境界棚卸しマージ済み`main`
- 正式対象環境: Windows 11 / Chrome / Edge / PC Web
- 並列作業: 条件付きで実施

---

## 1. 目的

DartsAppをWindows PC Webで起動・操作できる状態へ進めるため、最初の基盤を整備してください。

現在の主要障害:

```text
Unable to resolve "./wa-sqlite/wa-sqlite.wasm"
from "node_modules/expo-sqlite/web/worker.ts"
```

今回のゴール:

```text
Metroがexpo-sqliteのWASMをbundleできる
→ Chrome / Edgeで白画面にならない
→ SQLite DBが初期化される
→ Account / COUNT-UP / 01 / CRICKET / MATCHの既存データフローがWebで動く
→ Web exportが成功する
→ PC Web向けQA基準を文書化する
```

Expo SDK 54と`expo-sqlite ~16.0.10`を維持してください。

---

## 2. 公式仕様の前提

Expo SDK 54の公式`expo-sqlite`資料に従ってください。

公式資料が示す前提:

- `expo-sqlite`のWeb対応はalpha
- MetroへWASM対応設定が必要
- `SharedArrayBuffer`利用のためCOEP / COOPヘッダーが必要
- `metro.config.js`がなければ作成する
- 配信環境にも同等のヘッダーが必要

対象資料:

```text
https://docs.expo.dev/versions/v54.0.0/sdk/sqlite/
```

公式資料と現在導入済みのSDK 54実装を優先し、ブログの古い回避策や非公式patchを正本にしないでください。

---

## 3. 今回の実装対象

### 必須

1. `expo-sqlite` Web WASM bundle解決
2. Metro Web設定
3. COEP / COOPヘッダー設定
4. Web開発起動成功
5. Web production export成功
6. Chrome / Edge起動手順
7. DartsAppのPC Web product identityの最低限修正
8. Web DB初期化・migration 001→002→003
9. Web上のAccount作成・復元
10. Web上のゲームDB基本CRUD確認
11. 白画面時の可視エラー表示
12. Web QAチェックリスト
13. 既存182テストの維持
14. Draft PR

### 今回対象外

- PC横長ゲーム画面の全面再設計
- Support系route削除
- BottomNavの完全撤去
- Rating計算本体
- Rating Snapshot更新
- 効果音・動画再生
- USBカメラ
- realtime scoring
- キーボード専用操作
- フルスクリーン専用操作
- DartsSupportApp通信
- Supabase / API / cloud sync
- Expo SDK upgrade
- migration 004

---

## 4. 最優先ルール

1. Expo SDK 54を維持する。
2. `expo-sqlite ~16.0.10`を維持する。
3. 安易にSDK 55以上へ更新しない。
4. `node_modules`へ直接patchしない。
5. patch-packageを追加しない。
6. WASMを手動コピーして依存パッケージ内部構造へ固定しない。
7. migration 001～003を変更しない。
8. `PRAGMA user_version = 3`を維持する。
9. iPhone / Expo Go動作を壊さない。
10. COUNT-UP、01、CRICKET、MATCHを壊さない。
11. Account復旧とSQLite lock対策を壊さない。
12. `git reset --hard`、force pushは禁止。
13. `git add .`、`git add -A`は禁止。
14. 未追跡資料、audio、video、licensesをcommitしない。
15. mainへ自動マージしない。

---

## 5. 作業開始

```powershell
cd "C:\制作データ\10_App\DartsApp"
git status --short
git fetch origin
git switch main
git pull --ff-only origin main
git switch codex/phase-7-pc-web-foundation
git pull --ff-only origin codex/phase-7-pc-web-foundation
git branch --show-current
```

ローカルブランチがない場合だけ:

```powershell
git switch --track origin/codex/phase-7-pc-web-foundation
```

既知の未追跡資料は削除・変更・stash・commitしないでください。

baseline:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run validate:data
```

さらに現在のWeb失敗を再現し、ログへ保存してください。

```powershell
npx.cmd expo export --platform web
```

再現したエラー、参照元、Node / npm / Expo CLIのversionをPhase 7レポートへ記録してください。

---

# 6. 並列作業方針

## Stage 0: 直列調査

統合担当が先に調査してください。

- `package.json`
- `app.json`
- `expo-sqlite`の実version
- `expo-router`の実version
- Metro default config
- `node_modules/expo-sqlite/web/worker.ts`
- 実際のWASMファイル位置
- `npx expo config --type public`
- 現在のWeb error stack
- Chrome / Edgeで必要なresponse headers

調査前に設定を推測して変更しないでください。

## Agent A: Metro / WASM

所有:

```text
metro.config.js
tests/web/metroConfig.test.ts または等価テスト
```

担当:

- Expo SDK 54 default Metro configを拡張
- `.wasm`を正しいasset/source分類で解決
- `.mjs`等が必要か実依存を確認
- native bundleを壊さない
- configテスト

## Agent B: Web headers / product identity

所有:

```text
app.json
package.json
tests/web/appConfig.test.ts
```

担当:

- COEP / COOP設定
- Expo Router plugin設定を壊さずオブジェクト形式へ移行
- Web用script整備
- package名を`darts-app`へ修正
- Expo表示名を`DartsApp`へ修正
- slug / schemeをDartsApp向けへ修正
- native identifier / EAS projectIdは今回独断で変更しない
- configテスト

注意:

```text
iOS bundleIdentifier
EAS projectId
owner
```

は今回は維持してください。変更が必要なら`OPEN_QUESTIONS.md`へ記載してください。

orientationは全面UI改修前なので独断で`landscape`固定にしないでください。
PC Webレイアウトは次フェーズです。

## Agent C: Web DB smoke / error boundary

所有候補:

```text
features/web/**
components/WebStartupErrorBoundary.tsx
tests/web/webDatabaseSmoke.test.ts
```

担当:

- Web DB初期化失敗を白画面にせず表示
- エラーを技術ログへ残す
- Account / migration /簡易CRUD smoke helper
- nativeでは既存挙動を維持
- テスト

本番画面へ開発専用ボタンを追加しないでください。

## Agent D: Web QA / docs

所有:

```text
docs/PC_WEB_QA_CHECKLIST.md
docs/PC_WEB_SETUP.md
docs/implementation/PHASE_7_REPORT.md
README.md
```

担当:

- Windows PowerShellでは`npm.cmd`を使う手順
- Chrome / Edge確認
- headers確認
- 1280x720 / 1920x1080
- Web export
- IndexedDB / OPFS等、実際の保存先を確認して記録
- alpha制限を明記
- 既知問題

## 統合担当だけが変更

```text
app/_layout.tsx
contexts/GameDatabaseContext.tsx
```

必要な場合だけ最小変更してください。

同一ファイルを複数Agentで編集しないでください。

---

# 7. Metro設定

`metro.config.js`が存在しないため、Expo SDK 54のdefault configを基準に新規作成してください。

要件:

- `expo/metro-config`またはSDK 54推奨APIを利用
- 既存default値を破壊しない
- `.wasm`を重複追加しない
- 必要な拡張子だけ追加
- Windowsパスでも動作
- native startも動作
- `wa-sqlite.wasm`をbundleで解決
- production exportでも解決

実装後に、実際の`metro.config.js`のresolved configをテストしてください。

禁止:

- `node_modules/expo-sqlite/web/worker.ts`の書換え
- 絶対パスを個人PC固定で記述
- WASMをbase64直書き
- package内部ファイルのコピーを恒久解決策にする

---

# 8. COEP / COOP

最低ヘッダー:

```text
Cross-Origin-Embedder-Policy: credentialless
Cross-Origin-Opener-Policy: same-origin
```

Expo Router / app configでSDK 54互換の方法を採用してください。

確認:

```text
window.crossOriginIsolated === true
typeof SharedArrayBuffer !== 'undefined'
```

ChromeとEdgeで確認してください。

ヘッダーがdev serverとproduction hostingで異なる場合:

- local dev
- static export
- production hosting

を分けて文書化してください。

静的ファイル自体へヘッダーを埋め込めない場合は、推奨hosting設定例を`docs/PC_WEB_SETUP.md`へ記載してください。

---

# 9. Product identity最低限修正

現在の誤表記:

```text
package.json name: darts-support-app
app.json name: DartsSupportApp
slug: darts-support-app
scheme: dartssupportapp
```

今回修正:

```text
package.json name: darts-app
app.json name: DartsApp
slug: darts-app
scheme: dartsapp
```

今回は維持:

```text
ios.bundleIdentifier
extra.eas.projectId
owner
icon / splash画像
```

UI内に残るDartsSupportApp表記は棚卸しし、今回の起動・README上の主要product identityだけ修正してください。
Support系機能の削除は行わないでください。

---

# 10. Web起動失敗の可視化

白画面は禁止です。

DB初期化またはWASM Worker起動に失敗した場合、画面へ最低限表示:

```text
DartsAppを起動できませんでした。

Webデータベースの初期化に失敗しました。
ブラウザを再読み込みしてください。
問題が続く場合は、開発者コンソールのログを確認してください。
```

開発時のみ追加情報:

- error name
- error message
- stage
- recovery action

秘密情報、メール、Player名、DB内容は表示しないでください。

再試行ボタンを付ける場合は、Providerの無限再mountを起こさないようにしてください。

---

# 11. Web DB smoke

Webブラウザで最低限確認:

1. DB初期化
2. migration 001→002→003
3. `user_version = 3`
4. `foreign_key_check = 0`
5. Account作成
6. Accountプロフィール再読込
7. ブラウザreload後のAccount復元
8. COUNT-UP開始
9. 1投保存
10. pause / resume
11. completed result load
12. MATCH route load

全ゲームを長時間プレイする必要はありません。
ただしSQLite read/writeが実際にWebで永続化されることを確認してください。

ブラウザデータ削除後は新規DBになることを文書化してください。

---

# 12. Chrome / Edge QA

対象:

```text
Google Chrome stable
Microsoft Edge stable
Windows 11
```

確認解像度:

```text
1280x720
1920x1080
```

今回の合格基準:

- 白画面なし
- consoleにWASM resolve errorなし
- Worker起動
- `crossOriginIsolated = true`
- SharedArrayBuffer利用可能
- DB初期化
- Account復元
- Game Hub表示
- 4ゲームボタン表示
- MATCH route表示
- reload後にデータ維持
- Chrome / Edgeの両方で基本操作可能

PC横長の美観・画面最適化は次フェーズのため、今回の合否には含めません。
重大な表示崩れで操作不能な場合だけ修正してください。

---

# 13. Build / Export

必須:

```powershell
npm.cmd run web -- --port 8104 --clear
npx.cmd expo export --platform web
```

成功条件:

- WASM resolve errorなし
- export完了
- 出力ディレクトリにWASM assetが存在
- bundleがWASMを正しいURLで参照
- export成果物をHTTP server経由で起動可能

`file://`直開きで評価しないでください。

簡易HTTP serverを利用する場合、新規本番dependencyは追加しないでください。
Node標準機能または既存ツールを利用してください。

---

# 14. 回帰テスト

既存182テストを壊さないこと。

必須:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run format:check
npm.cmd test
npm.cmd run validate:data
```

加えて:

- Metro config test
- app config identity / headers test
- Web startup error mapping test
- native config回帰
- migration 001→003
- Account復旧
- Database lock回帰
- COUNT-UP / 01 / CRICKET / MATCH route回帰

---

# 15. Git / PR

作業ブランチ:

```text
codex/phase-7-pc-web-foundation
```

推奨commit:

```text
feat(web): enable expo sqlite web foundation
```

push:

```powershell
git push origin codex/phase-7-pc-web-foundation
```

Draft PR:

```text
Title:
Phase 7: PC Web and SQLite WASM foundation
```

PR本文:

- Summary
- Root cause
- Metro config
- COEP / COOP
- Product identity
- Chrome / Edge
- Web DB smoke
- Export
- Tests
- Manual QA
- Known alpha limitations
- Deferred PC landscape work

mainへマージしないでください。

---

# 16. 完了報告

以下を報告してください。

1. WASM resolve errorの原因
2. 変更ファイル
3. Metro設定
4. headers設定
5. product identity変更
6. native identifierを維持したこと
7. Web dev start結果
8. Web export結果
9. Chrome結果
10. Edge結果
11. crossOriginIsolated結果
12. SharedArrayBuffer結果
13. DB migration結果
14. Account復元結果
15. Game Hub / MATCH表示結果
16. 全検証結果
17. テスト総数
18. 既知のalpha制限
19. branch
20. commit SHA
21. push結果
22. Draft PR
23. mergeable
24. 未追跡資料維持

今回はPC Web foundationで停止してください。
PC横長全面改修、Rating、音源・動画、カメラ判定には進まないでください。
