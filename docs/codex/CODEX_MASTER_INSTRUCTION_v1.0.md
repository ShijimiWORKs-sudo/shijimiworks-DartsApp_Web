# DartsApp Codex実装指示書

- 文書バージョン: 1.0
- 作成日: 2026-07-12
- ローカル作業フォルダ: `C:\制作データ\10_App\DartsApp`
- 実装先リポジトリ: `https://github.com/ShijimiWORKs-sudo/shijimiworks-DartsApp_Web`
- 既存MVP参照元: `https://github.com/ShijimiWORKs-sudo/shijimiworks-dartssuportapp`
- 今回の実行範囲: **Phase 1「既存MVP取込み・SQLite基盤・ゲームドメイン基盤」まで**

---

## 1. あなたの役割

あなたはDartsAppのシニアReact Native / Expo / TypeScriptエンジニアです。

この指示書と仕様書一式を唯一の実装基準として、既存DartsSupportApp MVPを新しいDartsAppリポジトリへ安全に移し、ゲーム機能の実装基盤を構築してください。推測で仕様を変更せず、既存機能を壊さず、検証可能な小さな単位で進めてください。

---

## 2. 最優先ルール

1. 作業対象は`C:\制作データ\10_App\DartsApp`と`ShijimiWORKs-sudo/shijimiworks-DartsApp_Web`だけです。
2. 既存MVP参照元の`shijimiworks-dartssuportapp`へcommit・pushしてはいけません。
3. `main`へ直接実装commitを積まず、`codex/phase-1-game-foundation`ブランチを作成してください。
4. `git reset --hard`、履歴改変、強制push、既存データ初期化は禁止です。
5. `.env`、トークン、Apple証明書、個人情報、秘密鍵をcommitしてはいけません。
6. DARTSLIVE / PHOENIXの公式ロゴ、画像、非公開計算式、公式APIを複製してはいけません。
7. 既存の練習記録、写真スコア、分析、相談、資料、設定、法務ページ、EAS設定を削除してはいけません。
8. ゲーム判定を画面コンポーネントへ直書きしてはいけません。
9. 投擲の正本をAsyncStorageの単一AppStateへ追加してはいけません。ゲーム領域はSQLiteを正本とします。
10. 仕様に不整合が見つかった場合は、独断で大規模変更せず、`docs/implementation/OPEN_QUESTIONS.md`へ記録し、影響のない範囲だけ進めてください。
11. 今回はPhase 1だけを実行し、COUNT-UP・01・CRICKET・MATCHの全画面実装へ進まないでください。
12. 作業終了時にテスト結果、変更ファイル、未実装項目、次フェーズ候補を報告してください。

---

## 3. 仕様書の優先順位

ローカル準備スクリプトで展開される次の資料を順番に参照してください。

1. `docs/specs/DartsApp_詳細設計書_v1.0.md`
2. `docs/specs/DartsApp_DB設計書_v1.0.md`
3. `docs/specs/DartsApp_DB_v1_schema.sql`
4. `docs/specs/DartsApp_画面遷移設計書_v1.0.md`
5. `docs/specs/DartsApp_Rating計算モジュール仕様書_v1.0.md`
6. 本指示書

矛盾した場合は、DBの列・制約・index・migrationはDB資料、画面URL・戻る動作・再開先は画面遷移資料、Rating数式・丸め・除外条件はRating資料、全体方針と禁止事項は詳細設計書を優先してください。仕様書にない機能を追加しないでください。

---

## 4. 技術前提

- Expo SDK 54
- React Native
- TypeScript
- Expo Router
- React Context
- AsyncStorage（既存AppState用）
- `expo-sqlite`（ゲーム領域用）
- Node.js 22以上
- Node.js built-in test runner
- ESLint / Prettier

リポジトリ名に`Web`が含まれていますが、承認済み仕様はExpo / React Nativeアプリです。明示的な承認なしにNext.js、Vite、ブラウザ専用SPAへ置換しないでください。iPhone・Expo Goでの確認を優先し、Expo Webを不必要に破壊しない構成にしてください。

---

## 5. Phase 0：作業環境と既存MVPの取込み

### 5.1 ローカルフォルダ

```powershell
$workspace = 'C:\制作データ\10_App\DartsApp'
$parent = Split-Path $workspace -Parent
New-Item -ItemType Directory -Force -Path $parent | Out-Null
```

対象フォルダが存在しない場合:

```powershell
git clone https://github.com/ShijimiWORKS-sudo/shijimiworks-DartsApp_Web.git $workspace
Set-Location $workspace
```

存在する場合は別フォルダを作らず、次を確認してください。

```powershell
Set-Location $workspace
git status
git remote -v
```

未commitの変更がある場合は消さず、内容を報告して停止してください。

次に仕様書bundleを展開してください。

```powershell
.\scripts\restore-specs.ps1
```

### 5.2 既存MVP参照元の登録

```powershell
git remote get-url legacy 2>$null
if ($LASTEXITCODE -ne 0) {
  git remote add legacy https://github.com/ShijimiWORKS-sudo/shijimiworks-dartssuportapp.git
}
git fetch legacy main
```

### 5.3 既存MVPの取込み

実装先にアプリコードがまだ存在しない場合だけ、既存MVPの追跡ファイルを取込みます。

```powershell
git checkout legacy/main -- .
```

次のファイルは削除・上書きしないでください。

- `docs/codex/**`
- `docs/specs/**`
- `docs/specs-bundle/**`
- `scripts/setup-local-workspace.ps1`
- `scripts/restore-specs.ps1`

取込み後:

```powershell
git status --short
npm install
npm run typecheck
npm test
npm run validate:data
```

取込みだけで既存テストが失敗した場合は、ゲーム実装へ進まず原因を記録してください。

### 5.4 作業ブランチ

```powershell
git switch -c codex/phase-1-game-foundation
```

同名ブランチがある場合は勝手に削除せず、状態を確認してください。

---

## 6. 今回実装するPhase 1

Phase 1の目的は、UIを大量実装することではなく、後続フェーズが安全に積み上がるゲーム基盤を完成させることです。

### 6.1 依存関係

```powershell
npx expo install expo-sqlite
```

Expo SDK 54に適合する方法を使い、互換性不明のバージョンを手動指定しないでください。

### 6.2 推奨ディレクトリ

```text
features/
└─ game/
   ├─ domain/
   │  ├─ types.ts
   │  ├─ constants.ts
   │  ├─ errors.ts
   │  └─ ids.ts
   ├─ application/
   │  ├─ ports.ts
   │  └─ services/
   ├─ infrastructure/
   │  └─ sqlite/
   │     ├─ database.ts
   │     ├─ migrations/
   │     │  ├─ index.ts
   │     │  └─ 001_initial.ts
   │     ├─ repositories/
   │     └─ rowMappers/
   └─ index.ts
contexts/
└─ GameDatabaseContext.tsx
tests/
└─ game/
```

既存命名規則に合わせた軽微な変更は可能ですが、domain / application / infrastructureの境界は維持してください。

### 6.3 SQLite初期化

DBファイル名は`dartsapp_games.db`です。接続直後に次を適用してください。

```sql
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA synchronous = NORMAL;
PRAGMA busy_timeout = 5000;
```

- アプリ全体で1つの論理接続を共有する。
- `SQLiteProvider`と初期化関数を分離する。
- migrationは`PRAGMA user_version`と`db_migrations`で管理する。
- v1適用後は`PRAGMA user_version = 1`にする。
- migration途中失敗で半端なテーブル群を残さない。
- 書込みは可能な限り`withExclusiveTransactionAsync`を使用する。
- ユーザー入力をSQL文字列へ連結しない。

### 6.4 初期スキーマ

`docs/specs/DartsApp_DB_v1_schema.sql`を正本としてmigration 001を実装してください。

必須条件:

- 19テーブルを欠落なく作成する。
- CHECK制約、外部キー、UNIQUE制約、部分indexを維持する。
- 進行中ゲームを端末内1件に制限するindexを維持する。
- `client_action_id`による二重登録防止を維持する。
- PPD、MPR、Rating、信頼度は仕様書の整数scaleを維持する。
- `darts`を投擲の正本とし、訂正・取消の監査情報を物理削除しない。
- SQLiteとAsyncStorage間のOutboxを実装する。

SQLファイルを実行時に直接読めない場合はTypeScript migrationへ埋め込んで構いませんが、SQL正本との差分確認方法を残してください。

### 6.5 ドメイン型

少なくとも次を定義してください。

- `PlayerKind`
- `GameMode`
- `GameStatus`
- `MatchStatus`
- `OutRule`
- `BullRule`
- `InputSource`
- `DartArea`
- `TurnResult`
- `RatingEligibilityStatus`
- Player / Match / GameSession / GamePlayer / Round / Turn / Dartのドメイン型
- Repository入出力DTO

仕様値とDB enum文字列を一元管理し、画面側で文字列literalを重複させないでください。

### 6.6 ID生成

`Date.now()`単体を主キーにしないでください。Expo Goで利用できる衝突しにくいUUID相当のID生成関数を1か所に実装し、テスト可能にしてください。

### 6.7 Repositoryの最小実装

- `PlayerRepository`
- `MatchRepository`
- `GameRepository`
- `RatingRepository`
- `IntegrationOutboxRepository`

最低限必要な操作:

- OWNERを冪等に作成・取得する。
- GUESTを作成・一覧・archiveする。
- 進行中GAME / MATCHの有無を取得する。
- ID指定でGAME / MATCHの基礎情報を取得する。
- Outboxを追加し、pending一覧を取得し、processed / failedへ更新する。
- Rating最新snapshotを取得できる境界を用意する。

未実装メソッドを空の成功値でごまかさないでください。Phase 2以降はinterfaceだけ定義するか、明示的な`NotImplementedError`としてください。

### 6.8 Context接続

既存`AppStateContext`へSQLiteの全状態を混在させないでください。`GameDatabaseContext`または同等Providerを追加し、DB初期化状態、利用可否、初期化error、RepositoryまたはApplication Serviceへの安全な入口だけを公開してください。

既存AppStateの`schemaVersion: 9`は、Phase 1でゲーム既定設定を追加しない限り変更しないでください。

### 6.9 UIの範囲

Phase 1で許可するUI変更:

- ルートProviderへ`GameDatabaseProvider`を接続する。
- DB初期化失敗をクラッシュさせず表示できる最低限のerror boundary。

まだ実装しないもの:

- `/game`以下の本番画面
- COUNT-UP / 01 / CRICKET / MATCHのplay画面
- Rating画面
- ホームの大型UI改修

---

## 7. Phase 1テスト

最低限、次を自動テストしてください。

1. 空DBへのmigration 001で`user_version = 1`になる。
2. migrationを2回実行しても壊れない。
3. 全必須テーブルが存在する。
4. `PRAGMA foreign_key_check`が0件。
5. 不正enum、負数、範囲外Rating等がCHECK制約で拒否される。
6. 同一`client_action_id`の重複投擲が拒否される。
7. 進行中GAME / MATCHの一意制約が機能する。
8. OWNER作成が冪等である。
9. archiveしたGUESTを通常一覧から除外できる。
10. Outboxのpending → processed / failed遷移が正しい。
11. Repositoryがparameter bindingを使用する。
12. 既存テストがすべて通る。

Node環境で`expo-sqlite`実DBテストが難しい場合はSQLite CLIまたはテスト用adapterを利用して構いません。ただし、本番migration SQLそのものを検証し、完全mockだけで済ませないでください。

---

## 8. 品質確認

```powershell
npm run typecheck
npm run lint
npm run format:check
npm test
npm run validate:data
```

必要に応じて:

```powershell
npm run start:lan
```

長時間待機する起動processは、起動logとerrorの有無を確認後に終了して構いません。

---

## 9. ドキュメント更新

- `README.md`: SQLiteゲーム基盤、DB名、migration、Phase 1では画面未実装であること。
- `docs/ARCHITECTURE.md`: AsyncStorageとSQLiteの責務分離、`features/game`構造。
- `docs/implementation/PHASE_1_REPORT.md`: 実施内容、設計との差分、テスト、未解決事項、Phase 2候補。
- `docs/implementation/OPEN_QUESTIONS.md`: 未確定事項がある場合だけ。

仕様書そのものを実装都合で書き換えないでください。

---

## 10. Git運用

推奨commit例:

```text
chore: import existing DartsSupportApp MVP
chore: add expo sqlite dependency
feat: add game database migration v1
feat: add game domain types and repositories
feat: connect game database provider
test: add game database foundation tests
docs: document phase 1 game foundation
```

commit前:

```powershell
git status
git diff --check
git diff --stat
```

検証後:

```powershell
git push -u origin codex/phase-1-game-foundation
```

GitHub CLIが利用可能ならmain向けDraft PRを作成してください。

```powershell
gh pr create --draft --base main --head codex/phase-1-game-foundation --title "Phase 1: game database foundation" --body-file docs/implementation/PHASE_1_REPORT.md
```

GitHub CLIがない場合はpushまで行い、PR未作成と報告してください。mainへのmergeは行わないでください。

---

## 11. 完了条件

- 既存MVPが新リポジトリ上で維持されている。
- `expo-sqlite`がSDK互換の方法で導入されている。
- DB v1の全テーブル・制約・indexが作成される。
- migrationが冪等で、失敗時に半端な状態を残さない。
- SQLiteとAsyncStorageの責務が分離されている。
- 最小RepositoryとDB Providerが実装されている。
- 既存・新規テストが通る。
- Phase 1 reportがある。
- 作業branchがGitHubへpushされている。
- ゲーム画面を先走って実装していない。

---

## 12. 最終報告フォーマット

```text
1. 実施概要
2. 作成・変更した主要ファイル
3. DB migration結果
4. 実行した検証コマンドと成否
5. Gitブランチ名・最終commit SHA・push結果
6. 仕様との差分
7. 未解決事項
8. Phase 2で着手すべき内容
```

失敗した項目を成功扱いにせず、原因と再現手順を明記してください。
