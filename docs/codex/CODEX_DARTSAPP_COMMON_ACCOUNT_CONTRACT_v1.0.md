# DartsApp 共通Account・データ契約組み込み Codex指示書 v1.0

- 対象: PC/Web版 DartsApp
- リポジトリ: `ShijimiWORKS-sudo/shijimiworks-DartsApp_Web`
- 前提:
  - Phase 4 Account・Rating基盤はmainへマージ済み
  - DartsSupportApp側とはまだ通信しない
  - 共通Account ID・JSON契約だけを揃える
- 参照設計:
  - `docs/specs/Darts_Common_Account_Data_Contract_v1.0.md`

## 1. 目的

DartsAppに、DartsSupportAppと共通利用する以下の契約を組み込む。

1. 共通`account_id` UUID v4
2. Account JSON契約
3. OWNER Playerとの紐付け
4. Rating Profileのaccount_id所有
5. CommonEvent
6. Export/Import用JSON mapper
7. 将来同期用Outbox
8. 既存SQLite・AppStateとの互換性
9. migration・tests・docs

今回は実データ連携をしない。

## 2. 実装しないもの

- DartsSupportAppとの通信
- API通信
- Supabase
- Apple Login
- Google Login
- クラウド同期
- CRICKET本体
- MATCH本体
- Rating計算本体
- 効果音・動画
- 既存Account登録フローの全面作り直し

## 3. 作業開始

```powershell
cd "C:\制作データ\10_App\DartsApp"
git status --short
git fetch origin
git switch main
git pull --ff-only origin main
npm run typecheck
npm run lint
npm run format:check
npm test
npm run validate:data
git switch -c codex/common-account-contract-v1
```

未commit変更がある場合は、削除・stashせず停止して報告する。
baseline失敗時も実装へ進まない。

## 4. 共通設計書配置

以下をDartsAppへ追加する。

```text
docs/specs/Darts_Common_Account_Data_Contract_v1.0.md
docs/codex/CODEX_DARTSAPP_COMMON_ACCOUNT_CONTRACT_v1.0.md
```

## 5. Account ID整合

既存AccountのID生成・保存方式を確認する。

要件:

- `accountId`はUUID v4
- 一度発行したIDは変更しない
- displayName、email、userNameをIDにしない
- existing local_registered Accountを保持
- UUIDでない旧IDが存在する場合は、既存参照を壊さず段階的migration
- 安易にIDを書き換えない
- 必要なら`legacyAccountId`をoptionalで保持

既存内部status名と共通契約名が異なる場合は、内部型を壊さず外部契約mapperで変換する。

## 6. OWNER Player紐付け

- OWNER Playerは必ずAccountと紐付く
- GUESTはaccount_id不要
- Rating所有者はOWNER Account
- 既存Player IDは変更しない
- `accountId`を外部契約の正本にする
- Account削除時もゲーム履歴は削除しない

## 7. Rating Profile

Rating Profileへ以下を保証する。

```ts
accountId: string;
calculationVersion: number;
ratingStatus:
  | 'unmeasured'
  | 'measuring'
  | 'provisional'
  | 'standard'
  | 'stable';
```

既存内部statusと異なる場合はmapperで変換する。
Rating計算本体は変更しない。

## 8. CommonEvent

追加する。

```ts
type CommonEventType =
  | 'account_created'
  | 'account_profile_updated'
  | 'practice_session_completed'
  | 'game_session_completed'
  | 'match_completed'
  | 'rating_updated'
  | 'record_deleted';

type CommonEvent = {
  eventId: string;
  eventType: CommonEventType;
  eventVersion: 1;
  accountId: string;
  sourceApp: 'darts_app';
  sourceRecordId: string | null;
  occurredAt: string;
  createdAt: string;
  payload: Record<string, unknown>;
};
```

今回生成対象:

- account_created
- account_profile_updated
- game_session_completed
- rating_updated
- record_deleted

## 9. Outbox

追加する。

```ts
type SyncStatus = 'local_only' | 'pending' | 'synced' | 'conflict' | 'failed' | 'deleted';

type CommonOutboxItem = {
  outboxId: string;
  event: CommonEvent;
  syncStatus: SyncStatus;
  retryCount: number;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
};
```

現段階は`local_only`。送信処理は実装しない。

SQLiteへ追加する場合:

- migrationは冪等
- foreign key整合確認
- migration 002を壊さない
- 新規migration番号を使う
- `PRAGMA user_version`を更新

## 10. 共通JSON mapper

推奨構成:

```text
features/common-contract/
  domain/types.ts
  application/accountMapper.ts
  application/gameSessionMapper.ts
  application/ratingMapper.ts
  application/exportEnvelope.ts
  application/importValidator.ts
```

外部JSONはsnake_case。

実装:

```ts
toCommonAccountJson(account);
toCommonPlayerProfileJson(player, account);
toCommonRatingJson(ratingProfile);
toCommonGameSessionJson(gameSession);
createCommonExportEnvelope(payload, accountId, appVersion);
validateCommonImportEnvelope(value);
```

共通エンベロープ:

```json
{
  "contract_name": "darts_common_data",
  "contract_version": 1,
  "export_id": "UUID",
  "exported_at": "ISO8601",
  "source_app": "darts_app",
  "source_app_version": "current",
  "account_id": "UUID",
  "payload": {}
}
```

## 11. Export / Import

Export対象:

- Account
- OWNER Player profile
- Rating Profile
- completed game sessions
- CommonEvent / Outbox status summary

含めない:

- PIN
- token
- secret
- SQLite内部パス
- カメラ画像
- 動画
- 音源
- キャッシュ

Import要件:

- JSON検証
- contract_name検証
- contract_version検証
- account_id検証
- 件数プレビュー
- 既存データの無条件上書き禁止
- 同じIDはskipまたはconflict
- partial failureで既存DBを壊さない
- PIN・認証秘密情報は復元しない

## 12. migration

必要に応じて新規migrationを追加。

要件:

- 既存Account・Player・Rating・ゲーム履歴保持
- account_id追加または正規化
- Outbox table追加
- CommonEvent保存構造追加
- migration再実行で壊れない
- foreign_key_check成功
- activeAccountIdを消さない
- SQLITE_BUSY / SQLITE_LOCKED時にAccount IDを消さない
- Phase 4の直列化・bootstrap修正を維持

## 13. UI

Account画面へ追加可能:

- 共通Account ID表示
- Export
- Import
- 「DartsSupportApp連携は未実装」
- 「このAccount IDは将来連携で使用」

強制同期、クラウド接続、リンクボタンは作らない。

## 14. テスト

最低限:

- UUID v4
- Account mapper
- OWNER紐付け
- GUESTにaccountId不要
- Rating ownerがaccountId
- snake_case
- envelope生成
- invalid contract_name拒否
- unsupported version拒否
- invalid UUID拒否
- secretが含まれない
- account_created生成
- game_session_completed生成
- rating_updated生成
- local_only
- migration 002から新migrationへ移行
- 再実行可能
- activeAccountId保持
- Account保持
- Rating保持
- foreign_key_check
- SQLITE_BUSY時にAccount ID消去なし

## 15. docs

更新:

```text
README.md
docs/ARCHITECTURE.md
docs/MVP_FEATURES.md
docs/ROUTES.md
docs/QA_CHECKLIST.md
docs/specs/Darts_Common_Account_Data_Contract_v1.0.md
docs/implementation/DARTSAPP_COMMON_CONTRACT_REPORT.md
```

## 16. 品質確認

```powershell
npm run typecheck
npm run lint
npm run format:check
npm test
npm run validate:data
npm run start:lan
```

可能ならmigration再実行確認と`foreign_key_check`も行う。

## 17. Git

対象ファイルのみadd。

```powershell
git status --short
git diff --check
git diff --stat
git add <対象ファイル一覧>
git commit -m "Align DartsApp with common account contract"
git push -u origin codex/common-account-contract-v1
```

Draft PR:

```powershell
gh pr create --draft --base main --head codex/common-account-contract-v1 --title "Align DartsApp with common account contract" --body-file docs/implementation/DARTSAPP_COMMON_CONTRACT_REPORT.md
```

mainへマージしない。

## 18. 完了報告

- 変更ファイル
- migration番号
- account_id整合方法
- 旧IDの扱い
- OWNER紐付け
- Rating所有者
- CommonEvent
- Outbox
- Export/Import
- テスト件数
- migration結果
- 起動結果
- 既知制限
- DartsSupportApp未変更確認
- branch
- commit hash
- Draft PR URL
