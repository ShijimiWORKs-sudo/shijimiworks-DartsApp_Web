# Open Questions

## 1. Active MATCH uniqueness

`docs/specs/DartsApp_DB_v1_schema.sql` には進行中GAMEを端末内1件に制限する `uq_game_sessions_single_active` がありますが、進行中MATCHを端末内1件に制限する部分インデックスはありません。

一方、Phase 1指示のテスト要件には「進行中GAME / MATCHの一意制約が機能する」とあります。

Phase 1実装では、指示要件を満たすためにmigrationへ `uq_matches_active` を追加しました。SQL正本へ同制約を追記するか、実装側の補助制約として維持するか確認が必要です。
