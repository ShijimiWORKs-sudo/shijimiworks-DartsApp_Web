# DartsApp Feature Inventory v1.0

- 作成日: 2026-07-14
- 対象リポジトリ: `ShijimiWORKs-sudo/shijimiworks-DartsApp_Web`
- 対象ブランチ: `codex/audit-dartsapp-product-boundary-v1`
- 参照境界: `docs/specs/DARTS_TWO_APP_PRODUCT_BOUNDARIES_v1.0.md`
- 作業種別: 調査・棚卸し・文書作成のみ

## 調査サマリー

| 項目                           |     件数 / 結果 |
| ------------------------------ | --------------: |
| app route file                 |              43 |
| app files                      |              43 |
| components files               |              16 |
| features files                 |              68 |
| contexts files                 |               2 |
| constants files                |               9 |
| utils files                    |              20 |
| tests files                    |              35 |
| `*.test.ts` files              |              32 |
| assets files                   |              20 |
| docs files                     |              39 |
| SQLite tables from migrations  |              24 |
| migration versions             | 001 / 002 / 003 |
| `PRAGMA user_version` expected |               3 |

## 分類件数

| 分類            | 件数 |
| --------------- | ---: |
| KEEP            |   15 |
| MOVE_LATER      |    7 |
| HIDE            |   15 |
| REMOVE          |    0 |
| SHARED_CONTRACT |    6 |
| REVIEW          |   11 |

## Inventory

| ID      | 機能/画面/データ                           | パス                                                                           | 現在状態                                                     | 分類            | 根拠                                                 | 依存                         | 次工程                                   |
| ------- | ------------------------------------------ | ------------------------------------------------------------------------------ | ------------------------------------------------------------ | --------------- | ---------------------------------------------------- | ---------------------------- | ---------------------------------------- |
| INV-001 | package identity                           | `package.json`                                                                 | `name = darts-support-app`                                   | REVIEW          | DartsApp repoだがSupport名のまま                     | Expo / npm scripts           | P1でDartsApp PC Web名へ整理              |
| INV-002 | Expo app config                            | `app.json`                                                                     | `DartsSupportApp`, portrait, iOS bundle中心                  | REVIEW          | 境界仕様のDartsAppはWindows PC Web横長               | Expo config                  | P1でPC Web向けidentity/QA前提へ更新      |
| INV-003 | 初期設定                                   | `app/index.tsx`                                                                | rating/machine/problem初期設定                               | HIDE            | Support用プロフィール開始導線に近い                  | AppState                     | DartsAppではゲーム開始前提へ置換検討     |
| INV-004 | 下部ナビ                                   | `components/BottomNav.tsx`, `ScreenShell.tsx`                                  | home/practice/records/analysis/consult                       | HIDE            | iPhone縦画面Support導線                              | Expo Router                  | PC WebゲームUIでは主要導線から外す       |
| INV-005 | Game Hub                                   | `app/game/index.tsx`                                                           | COUNT-UP/01/CRICKET開始・再開                                | KEEP            | DartsAppの主機能導線                                 | Game services / Account      | PC横長UIに再設計                         |
| INV-006 | COUNT-UP                                   | `app/game/count-up/**`, `CountUpGameService.ts`, `domain/countUp/**`           | 8R単独ゲーム実装済み                                         | KEEP            | DartsApp正式ゲーム                                   | SQLite game graph            | PC Web操作性QA                           |
| INV-007 | 単独01                                     | `app/game/01/**`, `ZeroOneGameService.ts`, `domain/zeroOne/**`                 | 301/501/701/901、15R、BUST等実装済み                         | KEEP            | DartsApp正式ゲーム                                   | SQLite / Rating candidate    | PC Web操作性QA                           |
| INV-008 | 単独STANDARD CRICKET                       | `app/game/cricket/**`, `CricketGameService.ts`, `domain/cricket/**`            | 15R、0点全CLOSE継続実装済み                                  | KEEP            | DartsApp正式ゲーム                                   | SQLite / Rating candidate    | PC Web操作性QA                           |
| INV-009 | MATCH DB foundation                        | `matches`, `match_players`, `match_player_results`                             | DB基盤と一意制約あり                                         | KEEP            | DartsApp正式MATCHの土台                              | migration 001                | PR #7実機確認後にmainへ統合              |
| INV-010 | MATCH UI / service                         | PR #7: `app/game/match/**`, `MatchGameService`, `domain/match/**`              | IMPLEMENTED_IN_PR_PENDING_MERGE                              | KEEP            | PR #7 Phase 6: two-player match vertical slice       | MATCH DB / common-contract   | 実機確認後にmainへマージ                 |
| INV-011 | Game services layer                        | `features/game/application/services/**`                                        | COUNT-UP/01/CRICKET serviceあり、MATCHはPR #7                | KEEP            | 画面からSQL直接実行しない構造                        | SQLite executor              | PR #7統合後も同層を維持                  |
| INV-012 | SQLite migrations                          | `features/game/infrastructure/sqlite/migrations/**`                            | 001/002/003、24 tables                                       | KEEP            | ゲーム正本DB                                         | expo-sqlite                  | Web SQLite問題を別途解消                 |
| INV-013 | Active uniqueness/idempotency              | `001_initial.ts`, tests/idempotency                                            | active GAME/MATCH, client_action_id                          | KEEP            | データ破損防止                                       | SQLite indexes               | 維持                                     |
| INV-014 | Account / OWNER                            | `features/account/**`, `app/account/**`                                        | local Account, OWNER link                                    | KEEP            | DartsApp Rating所有者に必要                          | SQLite / AppState            | PC Web文言へ調整                         |
| INV-015 | Rating Profile / Evaluation基盤            | `rating_profiles`, `rating_evaluations`, `StandaloneRatingCandidateService.ts` | 候補判定まで実装                                             | KEEP            | Rating算出の土台                                     | Account / Game result        | 計算本体はP2                             |
| INV-016 | Rating計算本体                             | `docs/specs/DartsApp_Rating計算モジュール仕様書_v1.1.md`                       | 仕様あり、実装未完                                           | REVIEW          | DartsApp責務だが未実装                               | Rating evaluations           | P2で純粋TS APIから実装                   |
| INV-017 | Common Account contract                    | `features/common-contract/**`                                                  | Account/Game/Rating/Event/Outbox JSON境界、MATCH JSONはPR #7 | SHARED_CONTRACT | 共通化対象はデータ契約                               | SQLite / validators          | PR #7統合後にMATCH契約もmainへ反映       |
| INV-018 | Account screens                            | `app/account/register.tsx`, `profile.tsx`, `rating-status.tsx`                 | local Account登録/表示                                       | KEEP            | DartsAppにも必要                                     | AccountService               | Support文言をPC Web向けに整理            |
| INV-019 | Common Account ID display                  | `app/account/profile.tsx`                                                      | 共通ID表示あり                                               | SHARED_CONTRACT | 2アプリ連携ID                                        | common-contract              | 維持                                     |
| INV-020 | AsyncStorage practice state                | `contexts/AppStateContext.tsx`                                                 | profile/records/favorites/consult等を保持                    | MOVE_LATER      | Support状態が混在、削除はしない                      | AppState migration           | DartsApp最小設定へ縮小計画               |
| INV-021 | 今日の練習 routes                          | `app/practice**`                                                               | おすすめ練習/詳細/履歴                                       | HIDE            | Support主機能                                        | practiceMenus                | DartsApp主要導線から外す候補             |
| INV-022 | Practice menu constants                    | `constants/practiceMenus.ts`                                                   | 練習メニューDB                                               | MOVE_LATER      | DartsSupportApp計画機能寄り                          | record/analysis              | 実践練習モード仕様へ再分類               |
| INV-023 | 練習記録 routes                            | `app/record.tsx`, `app/records**`, `PracticeRecordForm.tsx`                    | 簡易記録CRUD                                                 | HIDE            | Support主機能                                        | AppState records             | DartsApp結果表示とは分離                 |
| INV-024 | 分析画面                                   | `app/analysis.tsx`, `utils/analyzePracticeRecords.ts`                          | 練習記録分析                                                 | HIDE            | Support主機能                                        | AppState records             | DartsAppは元データ生成へ寄せる           |
| INV-025 | フォーム相談                               | `app/consult.tsx`, `utils/generateConsultAdvice.ts`                            | 固定助言/履歴                                                | HIDE            | DartsAppで実装しない範囲                             | consultAdvice                | SupportAppへ残す対象                     |
| INV-026 | フォーム写真相談                           | `app/consult/form-photo/**`, `generateFormPhotoAdvice.ts`                      | 3枚写真相談                                                  | HIDE            | DartsAppで実装しない範囲                             | expo-image-picker            | SupportAppへ残す対象                     |
| INV-027 | 資料ライブラリ                             | `app/library**`, `constants/knowledgeBase.ts`                                  | 記事検索/詳細                                                | HIDE            | DartsAppで実装しない範囲                             | knowledgeBase                | SupportAppへ残す対象                     |
| INV-028 | お気に入り                                 | `app/favorites.tsx`                                                            | 練習メニューお気に入り                                       | HIDE            | Support習慣化導線                                    | practiceMenus                | DartsApp主要導線から外す                 |
| INV-029 | 写真スコア記録                             | `app/photo-score/**`, `PhotoBoardCanvas.tsx`, photo utils                      | 手動/半自動写真スコア                                        | MOVE_LATER      | DartsAppリアルタイム判定とは別物だが座標変換資産あり | expo-image-picker / AppState | camera判定仕様へ再利用範囲確認           |
| INV-030 | Board coordinate utilities                 | `utils/boardCoordinateTransform.ts`, `imageCoordinateMapping.ts`               | 画像座標/盤面変換                                            | SHARED_CONTRACT | 投擲座標・判定元は共通契約候補                       | photo-score                  | DartsApp camera判定へ抽出検討            |
| INV-031 | Image picker dependency                    | `expo-image-picker`, photo routes                                              | iPhone写真/カメラ選択前提                                    | REVIEW          | PC USB/Webカメラ制御とは異なる                       | Expo native module           | Web camera API方針を決める               |
| INV-032 | Consult advice constants                   | `constants/consultAdvice.ts`                                                   | 悩み別固定助言                                               | HIDE            | Support相談機能                                      | consult routes               | DartsAppから非表示候補                   |
| INV-033 | Knowledge base constants                   | `constants/knowledgeBase.ts`                                                   | 資料ライブラリ                                               | HIDE            | Support資料機能                                      | library routes               | DartsAppから非表示候補                   |
| INV-034 | Recommendation utils                       | `recommendPracticeMenus.ts`                                                    | Support用おすすめ                                            | HIDE            | 今日の練習管理向け                                   | records/profile              | DartsApp実践練習推薦とは分離             |
| INV-035 | Settings/theme                             | `app/settings.tsx`, `constants/theme.ts`                                       | profile/theme/background                                     | MOVE_LATER      | 設定自体は必要だがSupport寄り項目あり                | AppState                     | PCフルスクリーン/音量/カメラ設定へ再設計 |
| INV-036 | Legal pages                                | `app/legal/**`                                                                 | Privacy/Terms/Credits                                        | MOVE_LATER      | 両アプリで必要だが文言がSupport寄り                  | settings                     | DartsApp配布形態に合わせて再作成         |
| INV-037 | image assets                               | `assets/images/**`                                                             | logo/icon/splash                                             | REVIEW          | App identityがSupport名                              | Expo config                  | DartsAppブランド資産へ確認               |
| INV-038 | audio/video assets                         | `assets/audio/**`, `assets/video/**`                                           | 未追跡ローカル素材あり                                       | REVIEW          | DartsApp演出責務だが未実装・未管理                   | licenses                     | ライセンス確認後に正式管理               |
| INV-039 | Game tests                                 | `tests/game/**`                                                                | COUNT-UP/01/CRICKET/DB/Rating tests、MATCH testsはPR #7      | KEEP            | DartsAppゲーム品質に必要                             | node sqlite adapter          | PR #7統合後にPC Web smoke追加            |
| INV-040 | Support utility tests                      | `tests/*consult*`, `*Practice*`, `*Photo*`                                     | Support系ロジック検証                                        | MOVE_LATER      | 削除せずSupport側へ整理候補                          | constants/utils              | 移管計画まで維持                         |
| INV-041 | QA checklist                               | `docs/QA_CHECKLIST.md`                                                         | iPhone + Expo Go中心                                         | HIDE            | DartsApp QAはPC Chrome/Edge必須                      | docs                         | DartsApp PC QAへ別文書化                 |
| INV-042 | EAS/TestFlight docs                        | `docs/EAS_BUILD_GUIDE.md`, `TESTFLIGHT_PREP.md`                                | iOS配布中心                                                  | MOVE_LATER      | DartsApp PC Web短期環境と不一致                      | Expo/EAS                     | DartsSupportApp文書へ分離                |
| INV-043 | DartsApp specs                             | `docs/specs/DartsApp_*v1.1.md`                                                 | DartsAppゲーム/DB/Rating仕様                                 | KEEP            | DartsApp正本仕様                                     | docs                         | 実装差分を継続追跡                       |
| INV-044 | Phase reports                              | `docs/implementation/**`                                                       | Phase 1-5 / common report                                    | KEEP            | 履歴説明として必要                                   | docs                         | Phase別状態を境界文書へリンク            |
| INV-045 | Product naming                             | README/app config/docs                                                         | DartsSupportApp名が多数                                      | REVIEW          | 2アプリ境界とリポジトリ名が不一致                    | README/app.json              | P1でrename方針決定                       |
| INV-046 | iPhone/Expo Go docs                        | README/QA/EAS docs                                                             | iPhone主用途として記載                                       | HIDE            | DartsApp正式QAではない                               | docs                         | PC Web文書へ置換                         |
| INV-047 | CommonEvent / Outbox                       | `common_events`, `common_outbox`, `integration_outbox`                         | local_only/pending境界                                       | SHARED_CONTRACT | 通信ではなく契約境界                                 | migration 003                | 外部通信前まで維持                       |
| INV-048 | Export / Import validation                 | `exportEnvelope.ts`, `importValidator.ts`                                      | JSON検証/preview                                             | SHARED_CONTRACT | 連携前の共通契約                                     | common-contract              | UI提供は境界確認後                       |
| INV-049 | PracticeRecord link                        | `practice_record_links`                                                        | SQLite結果と旧PracticeRecord境界                             | SHARED_CONTRACT | 移行/連携境界                                        | integration_outbox           | Support記録との接続点として整理          |
| INV-050 | Realtime camera scoring                    | specs only / photo utils                                                       | USB/Webカメラ判定未実装                                      | REVIEW          | DartsApp本来主機能が不足                             | camera API / board transform | P2でPC Web camera技術検証                |
| INV-051 | PC horizontal game UI                      | app/game screens                                                               | モバイルカードUI中心                                         | REVIEW          | 1280x720/1920x1080正式QA未確認                       | RN Web / styles              | P1で横長ゲームUI設計                     |
| INV-052 | Award playback                             | assets/specs                                                                   | 効果音・動画再生未実装                                       | REVIEW          | DartsApp演出責務                                     | audio/video/license          | P2で再生基盤とライセンス確認             |
| INV-053 | Dojo/Cricket Count-Up/number/bull practice | specs only / practiceMenus                                                     | 正式実践練習モード未実装                                     | REVIEW          | DartsApp本来機能が不足                               | game engine                  | P2/P3でmode別設計                        |
| INV-054 | Mobile shell/layout                        | `ScreenShell`, `BottomNav`, card-heavy screens                                 | 縦スクロール・下部ナビ中心                                   | HIDE            | PC横長ゲームアプリと不一致                           | route layout                 | DartsAppではPC shellへ置換               |

## Phase 6 MATCH Pending Merge Confirmation

`origin/codex/phase-6-match` をread-onlyで確認した結果、MATCHはPR #7
`Phase 6: two-player match vertical slice` 上で実装済み・main未マージとして扱う。
実機確認前のため、`IMPLEMENTED` や `COMPLETED` ではなく
`IMPLEMENTED_IN_PR_PENDING_MERGE` と記録する。

確認済み実装:

- GAME 1: 501または701
- GAME 2: STANDARD CRICKET
- 1勝1敗時のGAME 3 CHOICE
- CHOICEの01はGAME 1と同じ開始点
- 先に2勝したプレイヤーをMATCH勝者とする
- CRICKETの0点自然勝利禁止
- GUEST参加
- 一時停止・再開・途中終了
- Rating Evaluation候補
- MATCH共通JSON
- CommonEvent / CommonOutbox local_only

## DB Tables

`features/game/infrastructure/sqlite/migrations` から確認したtable:

`accounts`, `common_events`, `common_outbox`, `cricket_number_states`, `darts`, `db_migrations`, `domain_events`, `game_player_results`, `game_players`, `game_sessions`, `integration_outbox`, `match_player_results`, `match_players`, `matches`, `players`, `practice_record_links`, `rating_evaluation_exclusions`, `rating_evaluation_games`, `rating_evaluations`, `rating_migration_orphans`, `rating_profiles`, `rating_snapshots`, `rounds`, `turns`

## Verification Snapshot

| Command                              | Result                                                              |
| ------------------------------------ | ------------------------------------------------------------------- |
| `npm run typecheck`                  | PASS                                                                |
| `npm run lint`                       | PASS                                                                |
| `npm test`                           | PASS, 166 tests                                                     |
| `npm run validate:data`              | PASS                                                                |
| `npm run format:check`               | FAIL: untracked local instruction/spec files only                   |
| `npm run web -- --port 8104 --clear` | HTTP 200, then Web bundling failed on `expo-sqlite` WASM resolution |

`format:check` failure files:

- `docs/codex/CODEX_DARTSAPP_FEATURE_INVENTORY_v1.0.md`
- `docs/specs/CODEX_DARTSSUPPORTAPP_FEATURE_INVENTORY_v1.0.md`
- `docs/specs/DARTS_TWO_APP_PRODUCT_BOUNDARIES_v1.0.md`

Web bundling error:

- `Unable to resolve "./wa-sqlite/wa-sqlite.wasm" from "node_modules/expo-sqlite/web/worker.ts"`
