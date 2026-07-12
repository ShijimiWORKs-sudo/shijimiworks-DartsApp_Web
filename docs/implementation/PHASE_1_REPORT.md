# Phase 1 Report: Game Database Foundation

## 実施内容

- 実装先リポジトリを `origin`、既存MVPを `legacy` remoteとして接続
- `codex/phase-1-game-foundation` ブランチを作成
- 既存DartsSupportApp MVPを取り込み
- `expo-sqlite` を Expo SDK 54互換の `npx expo install expo-sqlite` で追加
- `docs/specs/` に実装基準仕様書を配置
- `features/game` に domain / application / infrastructure 境界を追加
- `dartsapp_games.db` 用のSQLite migration v1を追加
- `GameDatabaseContext` をルートProviderへ接続
- Player / Match / Game / Rating / IntegrationOutbox の最小Repositoryを追加
- Node 24 `node:sqlite` による実SQLiteテストを追加

## 設計との差分

- `docs/specs/DartsApp_DB_v1_schema.sql` には進行中GAMEの一意制約はありますが、進行中MATCHの一意制約がありません。
- Phase 1指示のテスト項目では進行中MATCHの一意制約も要求されているため、migration側で `uq_matches_active` を追加しました。
- この差分は `docs/implementation/OPEN_QUESTIONS.md` に記録しています。

## テスト結果

- `npm run typecheck`: pass
- `npm test`: pass
- `npm run lint`: pass
- `npm run format:check`: pass
- `npm run validate:data`: pass

初回MVP取り込み直後にも以下を確認済みです。

- `npm run typecheck`: pass
- `npm test`: pass
- `npm run validate:data`: pass

Phase 1追加後の `npm test` は93件passです。

## 未解決事項

- 進行中MATCH一意制約をSQL正本へ反映するか、Phase 1追加制約として維持するか確認が必要です。
- 完全なゲーム進行Repository、集計再計算、PracticeRecord反映Worker、Rating計算本体はPhase 1対象外です。
- COUNT-UP / 01 / CRICKET / MATCH / Ratingの本番画面は未実装です。

## Phase 2候補

- COUNT-UP設定・プレイ・結果画面
- 1投入力Application Service
- Turn / Dart保存Repositoryの拡張
- 完了ゲームからPracticeRecord Outboxを作る処理
- 履歴詳細に向けたGame queryの追加
