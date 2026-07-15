# Open Questions

現在、Phase 9に関する未解決事項はありません。

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
