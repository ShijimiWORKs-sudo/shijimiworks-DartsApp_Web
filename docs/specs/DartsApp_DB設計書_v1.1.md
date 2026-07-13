# DartsApp DB設計書 v1.1

- 文書バージョン: 1.1
- DB schema target: `PRAGMA user_version = 2`
- 旧版: `DartsApp_DB設計書_v1.0.md`
- 対象DB: `dartsapp_games.db`
- 対象リポジトリ: `ShijimiWORKs-sudo/shijimiworks-DartsApp_Web`

---

## 1. 改訂概要

v1.1では次を追加する。

1. Accountテーブル
2. AccountとOWNER Playerの紐付け
3. Ratingの現在状態を保持する`rating_profiles`
4. MATCH・単独01・単独CRICKETを共通評価元として扱えるRating Evaluation v2
5. Account単位のRating Snapshot
6. 初回3MATCH確定後だけ単独ゲームを評価可能にするための状態管理
7. STANDARD CRICKETの0点自然終了禁止を保存できる結果構造

既存19テーブルは原則維持し、必要なテーブル追加・再構築をmigration 002で行う。

---

## 2. 正本と境界

| データ | 正本 |
|---|---|
| Account | SQLite `accounts` |
| Player | SQLite `players` |
| GAME / DART | SQLite既存テーブル |
| Rating現在値 | `rating_profiles` |
| Rating履歴 | `rating_snapshots` |
| Rating評価元 | `rating_evaluations` |
| activeAccountId | AsyncStorage AppState v10 |
| 認証秘密情報 | Phase 4では保存しない |

---

## 3. ER概要

```text
accounts 1 ── 0..1 players(owner)
accounts 1 ── 1 rating_profiles
accounts 1 ── * rating_evaluations
accounts 1 ── * rating_snapshots
players  1 ── * game_players
matches  1 ── * game_sessions
rating_evaluations 1 ── * rating_evaluation_games
```

GUEST Playerは`account_id = NULL`とする。

---

## 4. accounts

```sql
CREATE TABLE accounts (
  id TEXT PRIMARY KEY NOT NULL,
  user_name TEXT COLLATE NOCASE,
  display_name TEXT NOT NULL
    CHECK (length(trim(display_name)) BETWEEN 1 AND 30),
  email_normalized TEXT COLLATE NOCASE,
  status TEXT NOT NULL
    CHECK (status IN (
      'profile_incomplete',
      'local_registered',
      'cloud_verified',
      'disabled',
      'deleted'
    )),
  auth_provider TEXT NOT NULL DEFAULT 'local'
    CHECK (auth_provider IN ('local', 'email', 'apple', 'google')),
  auth_subject TEXT,
  registered_at TEXT,
  verified_at TEXT,
  last_login_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  CHECK (
    user_name IS NULL
    OR (
      length(user_name) BETWEEN 3 AND 20
      AND user_name NOT GLOB '*[^a-z0-9_]*'
    )
  )
);

CREATE UNIQUE INDEX uq_accounts_user_name
ON accounts(user_name)
WHERE user_name IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX uq_accounts_email
ON accounts(email_normalized)
WHERE email_normalized IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX uq_accounts_auth_subject
ON accounts(auth_provider, auth_subject)
WHERE auth_subject IS NOT NULL AND deleted_at IS NULL;
```

Phase 4では`auth_provider='local'`だけを生成する。

---

## 5. players変更

既存`players`へ追加する。

```sql
ALTER TABLE players ADD COLUMN account_id TEXT REFERENCES accounts(id);
```

Index:

```sql
CREATE UNIQUE INDEX uq_players_account_owner
ON players(account_id)
WHERE account_id IS NOT NULL
  AND player_type = 'owner'
  AND is_archived = 0;
```

整合性ルール:

- OWNERはAccountへ紐付け可能
- GUESTは`account_id = NULL`
- Account 1件につきactive OWNER 1件
- 既存`uq_players_active_owner`は維持

SQLiteのCHECK制約でGUESTのNULLを強制できないため、Repository・migration検証で保証する。

---

## 6. rating_profiles

Accountごとの現在Rating状態を保持する。

```sql
CREATE TABLE rating_profiles (
  account_id TEXT PRIMARY KEY NOT NULL REFERENCES accounts(id),
  owner_player_id TEXT NOT NULL UNIQUE REFERENCES players(id),
  measurement_status TEXT NOT NULL
    CHECK (measurement_status IN (
      'unmeasured',
      'provisional_1_of_3',
      'provisional_2_of_3',
      'provisional',
      'standard',
      'stable'
    )),
  rating_tenths INTEGER CHECK (rating_tenths BETWEEN 10 AND 180),
  precise_rating_milli INTEGER,
  confidence_bp INTEGER NOT NULL DEFAULT 0
    CHECK (confidence_bp BETWEEN 0 AND 10000),
  eligible_match_count INTEGER NOT NULL DEFAULT 0,
  eligible_standalone_zero_one_count INTEGER NOT NULL DEFAULT 0,
  eligible_standalone_cricket_count INTEGER NOT NULL DEFAULT 0,
  zero_one_index_milli INTEGER,
  cricket_index_milli INTEGER,
  match_index_milli INTEGER,
  calculation_version INTEGER NOT NULL DEFAULT 2,
  established_at TEXT,
  last_evaluated_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (
    (eligible_match_count < 3 AND established_at IS NULL)
    OR (eligible_match_count >= 3 AND established_at IS NOT NULL)
  )
);
```

単独Rating対象可否は次で導出する。

```text
established_at IS NOT NULL
AND account.status IN ('local_registered', 'cloud_verified')
```

---

## 7. rating_evaluations v2

v1のMATCH必須構造を、共通評価元へ再構築する。

```sql
CREATE TABLE rating_evaluations_v2 (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  player_id TEXT NOT NULL REFERENCES players(id),
  source_type TEXT NOT NULL
    CHECK (source_type IN (
      'match',
      'standalone_zero_one',
      'standalone_cricket'
    )),
  source_match_id TEXT REFERENCES matches(id),
  source_game_id TEXT REFERENCES game_sessions(id),
  source_revision INTEGER NOT NULL CHECK (source_revision >= 1),
  status TEXT NOT NULL
    CHECK (status IN ('pending', 'eligible', 'excluded', 'applied', 'invalidated')),
  candidate_flag INTEGER NOT NULL CHECK (candidate_flag IN (0, 1)),
  match_result TEXT CHECK (match_result IN ('win', 'loss')),
  zero_one_game_count INTEGER NOT NULL DEFAULT 0,
  zero_one_ppd_milli INTEGER,
  cricket_game_count INTEGER NOT NULL DEFAULT 0,
  cricket_mpr_milli INTEGER,
  total_darts INTEGER NOT NULL DEFAULT 0,
  total_rounds INTEGER NOT NULL DEFAULT 0,
  source_weight_milli INTEGER NOT NULL DEFAULT 1000
    CHECK (source_weight_milli BETWEEN 1 AND 1000),
  auto_detected_darts INTEGER NOT NULL DEFAULT 0,
  adjusted_darts INTEGER NOT NULL DEFAULT 0,
  fully_manual_darts INTEGER NOT NULL DEFAULT 0,
  correction_count INTEGER NOT NULL DEFAULT 0,
  input_payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  evaluated_at TEXT,
  applied_at TEXT,
  invalidated_at TEXT,
  CHECK (
    (source_type = 'match'
      AND source_match_id IS NOT NULL
      AND source_game_id IS NULL
      AND match_result IS NOT NULL)
    OR
    (source_type IN ('standalone_zero_one', 'standalone_cricket')
      AND source_match_id IS NULL
      AND source_game_id IS NOT NULL
      AND match_result IS NULL)
  )
);

CREATE UNIQUE INDEX uq_rating_eval_match_v2
ON rating_evaluations_v2(source_match_id, account_id, source_revision)
WHERE source_type = 'match';

CREATE UNIQUE INDEX uq_rating_eval_game_v2
ON rating_evaluations_v2(source_game_id, account_id, source_revision)
WHERE source_type IN ('standalone_zero_one', 'standalone_cricket');
```

migration完了後、正式名を`rating_evaluations`へ戻す。

### 7.1 source weight

| source_type | source_weight_milli |
|---|---:|
| match | 1000 |
| standalone_zero_one | 500 |
| standalone_cricket | 500 |

---

## 8. rating_evaluation_games

既存構造を維持する。単独評価では1行、MATCH評価では構成GAME分を保存する。

追加要件:

- standalone_zero_one: `mode='zero_one'`, `game_no=1`
- standalone_cricket: `mode='cricket'`, `game_no=1`
- match: GAME 1～3

---

## 9. rating_evaluation_exclusions

既存を維持し、新理由コードを追加する。

| reason_code | 意味 |
|---|---|
| `ACCOUNT_NOT_REGISTERED` | Account未登録 |
| `ACCOUNT_NOT_ACTIVE` | Account状態不正 |
| `OWNER_NOT_LINKED` | OWNER紐付けなし |
| `INITIAL_RATING_NOT_ESTABLISHED` | 3MATCH未完了 |
| `GAME_BEFORE_RATING_ESTABLISHED` | established_at以前の単独GAME |
| `STANDALONE_GAME_ABORTED` | 単独GAME途中終了 |
| `STANDALONE_GAME_INVALID` | 単独GAME不整合 |
| `UNSUPPORTED_STANDALONE_MODE` | 対象外単独モード |
| `STALE_SOURCE_REVISION` | 古いrevision |

単独ゲーム確定前の履歴は`INITIAL_RATING_NOT_ESTABLISHED`として記録してもよいが、Evaluation行を作らずGAME側`extra_stats_json`へ除外理由を保存する方式でもよい。実装方式は一貫させる。

---

## 10. rating_snapshots v2

```sql
CREATE TABLE rating_snapshots_v2 (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  player_id TEXT NOT NULL REFERENCES players(id),
  evaluation_id TEXT UNIQUE REFERENCES rating_evaluations_v2(id),
  previous_snapshot_id TEXT REFERENCES rating_snapshots_v2(id),
  source_type TEXT NOT NULL
    CHECK (source_type IN ('match', 'standalone_zero_one', 'standalone_cricket')),
  measurement_status TEXT NOT NULL
    CHECK (measurement_status IN (
      'unmeasured',
      'provisional_1_of_3',
      'provisional_2_of_3',
      'provisional',
      'standard',
      'stable'
    )),
  rating_tenths INTEGER CHECK (rating_tenths BETWEEN 10 AND 180),
  precise_rating_milli INTEGER,
  confidence_bp INTEGER NOT NULL CHECK (confidence_bp BETWEEN 0 AND 10000),
  evaluated_match_count INTEGER NOT NULL DEFAULT 0,
  evaluated_standalone_zero_one_count INTEGER NOT NULL DEFAULT 0,
  evaluated_standalone_cricket_count INTEGER NOT NULL DEFAULT 0,
  window_match_count INTEGER NOT NULL DEFAULT 0,
  window_zero_one_observation_count INTEGER NOT NULL DEFAULT 0,
  window_cricket_observation_count INTEGER NOT NULL DEFAULT 0,
  zero_one_index_milli INTEGER,
  cricket_index_milli INTEGER,
  match_index_milli INTEGER,
  stability_adjustment_milli INTEGER,
  continuity_bonus_milli INTEGER,
  applied_delta_milli INTEGER,
  calculation_version INTEGER NOT NULL DEFAULT 2,
  calculation_detail_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  invalidated_at TEXT
);

CREATE INDEX idx_rating_snapshots_account_current_v2
ON rating_snapshots_v2(account_id, created_at DESC)
WHERE invalidated_at IS NULL;
```

migration完了後、正式名を`rating_snapshots`へ戻す。

---

## 11. CRICKET結果保存

`game_player_results.extra_stats_json`へ次を保存する。

```json
{
  "schemaVersion": 2,
  "completionReason": "all_closed_with_score",
  "clearFlag": true,
  "finalCricketScore": 20,
  "allClosed": true,
  "zeroPointFinishPrevented": false,
  "targets": {
    "20": { "marks": 4, "closed": true, "points": 20 }
  }
}
```

completion reason:

- `all_closed_with_score`
- `round_limit`
- `aborted`
- `invalid`

自然終了時は`clearFlag = true`かつ`finalCricketScore > 0`を必須とする。

全CLOSE0点で15ラウンド終了した場合:

```json
{
  "completionReason": "round_limit",
  "clearFlag": false,
  "finalCricketScore": 0,
  "allClosed": true,
  "zeroPointFinishPrevented": true
}
```

---

## 12. game_sessions.rating_candidate

### 12.1 COUNT-UP

常に0。

### 12.2 単独01・CRICKET

開始時に次を満たせば1。

- OWNERにAccountあり
- Account状態が登録済み
- `rating_profiles.established_at IS NOT NULL`
- GAME開始日時がestablished_at以降

完了時に再検証する。

### 12.3 MATCH

MATCH全体の適格判定で決定する。

---

## 13. migration 002

### 13.1 方針

- migration 001を書き換えない
- `db_migrations.version = 2`
- `PRAGMA user_version = 2`
- 前進migrationのみ
- 既存GAMEデータを保持
- 最後に`PRAGMA foreign_key_check`

### 13.2 手順

1. `accounts`作成
2. 既存active OWNERごとに`profile_incomplete` Accountを作成
3. `players.account_id`追加・OWNERへ紐付け
4. `rating_profiles`作成
5. 既存Ratingテーブルを`*_v1_backup`へrename
6. v2 Ratingテーブルを作成
7. OWNERに紐づく既存MATCH Evaluationを移行
8. GUESTまたはAccount不明の旧Rating行を`rating_migration_orphans`へJSON保存
9. dependent tableを移行
10. v1 backupを削除
11. Index作成
12. `db_migrations`へ記録
13. `user_version=2`
14. foreign key check

### 13.3 migration account

既存OWNER用Account:

- `status='profile_incomplete'`
- `display_name=players.display_name`
- `user_name=NULL`
- `email_normalized=NULL`
- `auth_provider='local'`

アプリ起動後に登録画面へ誘導するが、既存ゲーム機能はブロックしない。

### 13.4 rating_migration_orphans

```sql
CREATE TABLE rating_migration_orphans (
  id TEXT PRIMARY KEY NOT NULL,
  source_table TEXT NOT NULL,
  source_row_id TEXT,
  reason_code TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

既存データを黙って捨てない。

---

## 14. AppState migration

AppState schemaVersion 9 → 10:

```ts
activeAccountId: string | null;
```

移行時は`null`。SQLite migration後、active OWNERのAccountが1件なら自動設定してよい。

DBに存在しない場合は`null`へ修復する。

---

## 15. Index

追加:

```sql
CREATE INDEX idx_accounts_status_updated
ON accounts(status, updated_at DESC)
WHERE deleted_at IS NULL;

CREATE INDEX idx_players_account
ON players(account_id, is_archived);

CREATE INDEX idx_rating_evaluations_account_status_v2
ON rating_evaluations(account_id, status, created_at DESC);

CREATE INDEX idx_rating_evaluations_source_game_v2
ON rating_evaluations(source_game_id, source_revision DESC)
WHERE source_game_id IS NOT NULL;

CREATE INDEX idx_rating_profiles_status
ON rating_profiles(measurement_status, updated_at DESC);
```

---

## 16. トランザクション境界

- Account登録とOWNER紐付け
- Rating Profile初期作成
- GAME完了とEvaluation候補作成
- Evaluation適用とSnapshot・Profile更新
- migration 002

Rating適用は、Evaluation status更新、Snapshot追加、Profile更新を同一排他トランザクションで行う。

---

## 17. 受入条件

1. schema v1からv2へ移行できる
2. 既存GAME・DART・結果が残る
3. active OWNERへAccountが紐づく
4. GUESTへAccountを自動作成しない
5. Account未完了でも既存ゲームを遊べる
6. Rating Evaluationが3種類のsource_typeを保持できる
7. 単独Evaluationはmatch_id不要
8. Rating SnapshotがAccountに紐づく
9. CRICKET全CLOSE0点をclearとして保存できない
10. migration再実行が冪等
11. foreign key checkが成功する
