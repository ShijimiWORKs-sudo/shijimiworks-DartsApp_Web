# DartsApp / DartsSupportApp 共通アカウント・データ連携設計書 v1.0

- 文書バージョン: 1.0
- 基準日: 2026-07-13
- 対象:
  - PC版: DartsApp
  - iPhone版: DartsSupportApp
- 方針:
  - 両アプリは当面、完全に独立して開発する
  - 現時点では実データ連携を実装しない
  - 共通のアカウントID・JSON契約・同期メタデータだけ先に固定する
  - DartsSupportAppへ先行実装し、DartsAppは現行Phase 4完了後に取り込む

## 1. 目的

本書は、DartsAppとDartsSupportAppを別アプリとして独立開発しながら、将来の連携時にデータ形式を作り直さないため、以下を共通仕様として定義する。

1. 共通アカウントID
2. ローカルアカウントと将来クラウドアカウントの関係
3. ユーザープロフィール形式
4. Rating所有者の識別方法
5. プレイ・練習・分析データのJSON形式
6. エクスポート／インポート形式
7. 将来API契約
8. 同期状態・競合解決・削除の扱い
9. バージョニング
10. セキュリティ境界

## 2. 基本原則

### 2.1 独立動作

- DartsApp単体でゲーム・Rating・履歴を利用できる
- DartsSupportApp単体で練習記録・分析・相談を利用できる
- どちらもクラウド未接続で利用可能
- 一方の未完成が他方を止めない

### 2.2 共通ID

```text
account_id: UUID v4
```

要件:

- 端末内で新規作成時にUUID v4を生成
- 一度発行したIDは変更しない
- 表示名、メール、ユーザー名をIDとして使わない
- エクスポート・インポート後も維持
- 将来クラウド認証と結び付けても維持
- Apple、Google、メール認証の識別子は別フィールドで管理

### 2.3 OWNERとGUEST

- OWNER: 正式アカウントに紐づく本人プレイヤー
- GUEST: 端末上の一時的な対戦相手・練習相手
- OWNERのみ正式Rating所有者
- GUESTはaccount_idを必須としない
- GUESTは将来Accountへ昇格可能

### 2.4 JSON命名

API・エクスポート・アプリ間契約はsnake_caseを正本とする。
内部TypeScriptはcamelCaseでもよいが、境界で変換する。

## 3. 共通Account JSON

```json
{
  "schema_version": 1,
  "account_id": "8ad2b35e-d973-4e2c-bf2f-6df0f430af10",
  "user_name": "yousuke",
  "display_name": "Yousuke",
  "email": null,
  "account_status": "local_active",
  "auth_mode": "local_pin",
  "cloud_auth_subject": null,
  "created_at": "2026-07-13T10:00:00.000Z",
  "updated_at": "2026-07-13T10:00:00.000Z",
  "deleted_at": null
}
```

### 3.1 account_status

```ts
type AccountStatus = 'local_active' | 'cloud_pending' | 'cloud_active' | 'suspended' | 'deleted';
```

### 3.2 auth_mode

```ts
type AuthMode = 'local_pin' | 'local_no_auth' | 'email_password' | 'apple' | 'google';
```

初期DartsSupportAppはlocal_pinを使用する。

## 4. 共通プロフィール

```json
{
  "schema_version": 1,
  "profile_id": "7cc978a2-661d-48c3-9d6a-8c76d73b30a4",
  "account_id": "8ad2b35e-d973-4e2c-bf2f-6df0f430af10",
  "player_type": "owner",
  "display_name": "Yousuke",
  "throwing_hand": "right",
  "main_machine": "DARTSLIVE",
  "rating_system_preference": "dartsapp",
  "self_reported_rating": 7.0,
  "avatar_uri": null,
  "created_at": "2026-07-13T10:00:00.000Z",
  "updated_at": "2026-07-13T10:00:00.000Z"
}
```

```ts
type PlayerType = 'owner' | 'guest';
```

## 5. 共通Rating

```json
{
  "schema_version": 1,
  "rating_profile_id": "0ab4f7e0-b820-43d7-89a5-181d7f66940b",
  "account_id": "8ad2b35e-d973-4e2c-bf2f-6df0f430af10",
  "rating_value": 7.4,
  "rating_status": "provisional",
  "confidence_percent": 62,
  "evaluated_match_count": 4,
  "calculation_version": 1,
  "updated_at": "2026-07-13T10:00:00.000Z"
}
```

Rating所有者はaccount_idで識別する。

## 6. 共通エンベロープ

```json
{
  "contract_name": "darts_common_data",
  "contract_version": 1,
  "export_id": "ee24fd90-b84b-4fe6-a4c3-8d0ef925ebd9",
  "exported_at": "2026-07-13T11:00:00.000Z",
  "source_app": "darts_support_app",
  "source_app_version": "0.2.0",
  "account_id": "8ad2b35e-d973-4e2c-bf2f-6df0f430af10",
  "payload": {}
}
```

```ts
type SourceApp = 'darts_app' | 'darts_support_app';
```

## 7. 共通イベント

```json
{
  "event_id": "a77be0e6-0ca2-47c4-a32c-b6dd8b9a31af",
  "event_type": "practice_session_completed",
  "event_version": 1,
  "account_id": "8ad2b35e-d973-4e2c-bf2f-6df0f430af10",
  "source_app": "darts_support_app",
  "source_record_id": "local-record-id",
  "occurred_at": "2026-07-13T10:30:00.000Z",
  "created_at": "2026-07-13T10:31:00.000Z",
  "payload": {}
}
```

予約event_type:

- account_created
- account_profile_updated
- practice_session_completed
- game_session_completed
- match_completed
- rating_updated
- consultation_saved
- record_deleted

## 8. 練習記録JSON

```json
{
  "record_id": "e2f3450d-3729-4534-938e-c33c81b2d352",
  "account_id": "8ad2b35e-d973-4e2c-bf2f-6df0f430af10",
  "record_type": "practice",
  "game_type": "COUNT_UP",
  "machine_type": "DARTSLIVE",
  "played_at": "2026-07-13T10:00:00.000Z",
  "score": 612,
  "bull_count": 12,
  "double_count": 1,
  "triple_count": 2,
  "cricket_marks": 0,
  "condition": "normal",
  "memo": "ブル練習",
  "source_app": "darts_support_app",
  "source_record_id": "practice-record-local-id",
  "created_at": "2026-07-13T10:05:00.000Z",
  "updated_at": "2026-07-13T10:05:00.000Z"
}
```

## 9. ゲームセッションJSON

DartsApp側で後日実装し、DartsSupportAppは受信・表示側を将来実装する。

```json
{
  "session_id": "5ce00885-bdf0-4aa3-b978-0d09f8071d48",
  "account_id": "8ad2b35e-d973-4e2c-bf2f-6df0f430af10",
  "game_type": "ZERO_ONE",
  "game_variant": "501",
  "status": "completed",
  "started_at": "2026-07-13T10:00:00.000Z",
  "completed_at": "2026-07-13T10:20:00.000Z",
  "rating_eligible": true,
  "summary": {
    "score": null,
    "ppd": 21.8,
    "three_dart_average": 65.4,
    "mpr": null,
    "bull_count": 5,
    "triple_count": 7,
    "double_count": 2,
    "bust_count": 1
  },
  "source_app": "darts_app",
  "source_record_id": "sqlite-game-id"
}
```

## 10. 同期メタデータ

```json
{
  "sync_status": "local_only",
  "sync_revision": 1,
  "last_synced_at": null,
  "sync_error": null
}
```

```ts
type SyncStatus = 'local_only' | 'pending' | 'synced' | 'conflict' | 'failed' | 'deleted';
```

現時点のDartsSupportAppはlocal_only。

## 11. 競合解決

1. IDが異なるデータは別レコード
2. 同じIDでrevisionが異なる場合は新しいrevisionを優先
3. 同じrevisionで内容が異なる場合はconflict
4. 削除はdeleted_atによる論理削除
5. Rating Snapshotは派生データとして再計算可能
6. 元ゲーム・練習履歴を優先保持

## 12. 共通形式

- 日時: ISO 8601 UTC、ミリ秒付き
- 文字コード: UTF-8
- Rating: number
- 割合: 0～100
- 座標: 0.0～1.0
- JSONでは未設定値をnull
- 金額情報は含めない

## 13. ローカル認証とクラウド認証

初期DartsSupportApp:

- ローカルAccount + PIN
- PIN平文をAsyncStorageへ保存しない
- PIN認証情報はSecureStore
- Accountプロフィールは既存AppStateまたはアプリDB
- クラウド認証済みと表示しない

将来:

- account_id + cloud_auth_subject
- 既存account_idをクラウド認証主体へ結び付ける
- ローカルAccountを捨てて作り直さない

## 14. DartsSupportApp先行実装

実装する:

- Account型
- UUID v4 account_id
- ローカルAccount登録
- PIN設定・変更・解除・ロック
- activeAccountId
- OWNERプロフィール紐付け
- Accountプロフィール
- ログイン／ロック解除
- JSONエクスポート
- JSONインポート検証
- 共通contract mapper
- 将来同期用Outbox
- 既存記録へのaccount_id互換対応
- migration・テスト・docs

実装しない:

- Supabase
- Apple/Google Login
- メール認証
- クラウド同期
- DartsApp通信
- API通信
- 複数端末同期

## 15. DartsApp後日組込み

DartsApp Phase 4完了後:

- accounts.account_idのUUID契約
- OWNER Player紐付け
- Rating Profileのaccount_id所有
- CommonEvent生成
- game_session_completed mapper
- Export/Import
- Outbox
- contract_version統一

現行DartsAppブランチは今変更しない。

## 16. API予約

```text
POST   /v1/accounts/link
GET    /v1/accounts/{account_id}
PATCH  /v1/accounts/{account_id}
POST   /v1/events/batch
GET    /v1/events?since=...
POST   /v1/exports/import
GET    /v1/rating/{account_id}
```

現段階では実装しない。

## 17. セキュリティ

- PIN、パスワード、秘密鍵をJSONへ含めない
- `.env`やtokenをGitへ保存しない
- メールは任意
- ローカルPINは端末内ロックであり本人確認ではない
- インポートJSONはschemaとaccount_idを検証
- 不正JSONで既存データを上書きしない

## 18. 受入条件

- 共通account_id形式が確定
- JSON契約がversion管理される
- DartsSupportAppが単独でAccount登録・PINロック可能
- クラウド未導入でも利用可能
- DartsAppを変更せず進められる
- エクスポートに秘密情報が含まれない
- 既存ユーザー・記録をmigrationで保持
