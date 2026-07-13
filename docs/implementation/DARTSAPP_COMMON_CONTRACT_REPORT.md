# DartsApp Common Account Contract Report

## Scope

DartsApp側へ共通Account ID、共通JSON mapper、CommonEvent、CommonOutbox、Export / Import検証基盤を追加しました。DartsSupportApp通信、API通信、クラウド同期、Supabase、Apple Login、Google Loginは未実装です。

## Migration

- migration: `003_common_account_contract`
- `PRAGMA user_version`: 3
- 追加テーブル: `common_events`, `common_outbox`
- 追加列: `accounts.legacy_account_id`

## Account ID

既存Account IDは書き換えません。Phase 4のAccount登録はUUID v4形のIDを生成済みです。UUIDでない旧IDがある場合は参照を壊さず、段階的移行用に `legacy_account_id` を保持できます。

## OWNER / Rating Owner

OWNER Playerは `players.account_id` でAccountへ紐付きます。Rating Profileは `rating_profiles.account_id` を所有者として保持します。GUESTはaccount_id不要です。

## CommonEvent

`CommonEvent` は `event_version = 1`、`source_app = darts_app`、snake_case JSONを正本にします。予約済みevent_typeは `account_created`、`account_profile_updated`、`practice_session_completed`、`game_session_completed`、`match_completed`、`rating_updated`、`consultation_saved`、`record_deleted` です。

## Outbox

`common_outbox` はCommonEventを参照し、現段階では `sync_status = local_only` を初期値にします。送信処理、リトライ実行、API通信は実装していません。

## Export / Import

Export Envelopeは `contract_name = darts_common_data`、`contract_version = 1`、`source_app = darts_app` です。Importはcontract名、version、source_app、UUID、payload objectを検証し、プレビューを返します。既存DBの無条件上書きは行いません。

## Tests

以下を確認します。

- UUID v4 validation
- Account / OWNER profile / Rating / Game Session mapper
- snake_case JSON
- secret非混入
- CommonEvent生成
- local_only Outbox
- Import invalid contract拒否
- migration 003適用と再実行
- foreign_key_check
- activeAccountId保持
- Account / Rating保持

## Known Limits

- DartsSupportAppとの通信は未実装
- API通信は未実装
- クラウド同期は未実装
- Supabase、Apple Login、Google Loginは未実装
- Rating計算本体は未実装
- CRICKET本体、MATCH本体、効果音、動画は未実装
