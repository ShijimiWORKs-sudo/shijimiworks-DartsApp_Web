# Open Questions

現在、Phase 9に関する未解決事項は1件あります。

## 未解決: 複数有効Accountの選択UI

- 現状のDartsAppは端末内のRating所有者を1 Account前提で扱う
- `activeAccountId = null` または古いIDの場合、有効なOWNER Accountが1件なら自動復元する
- `activeAccountId`がdisabled/deleted相当の場合、そのAccountはRating所有者として自動選択しない
- 有効なOWNER Accountが複数存在する場合の選択UIと優先順位は未設計
- 複数Account対応フェーズで、Account選択画面または明示的な切替UIを定義する

## 解決済み: Active MATCH uniqueness

- `uq_matches_active`を正式仕様として採用
- `docs/specs/DartsApp_DB_v1_schema.sql`へ反映済み
- `docs/specs/DartsApp_DB設計書_v1.0.md`へ反映済み
- migrationと仕様書の差分は解消済み

## 解決済み: Phase 9 Rating Engine v2

- `calculation_version = 2`を正式仕様として採用
- Rating範囲は1.0〜18.0
- 初回RatingはEligible MATCH 3件だけで確定
- 単独01/CRICKETは初回確定後のゲームだけを対象とし、遡及利用しない
- 単独01は01 Indexだけ、単独CRICKETはCricket Indexだけを更新
- 単独ゲームでMatch Indexは変更しない
- 単独1件の総合Rating変動は±0.2以内
- GUESTにはRating Profile、Evaluation、Snapshotを作成しない
- Evaluation、Snapshot、Profile、Outbox更新は同一transactionで実行
- migration 004は追加せず、`PRAGMA user_version = 3`を維持
