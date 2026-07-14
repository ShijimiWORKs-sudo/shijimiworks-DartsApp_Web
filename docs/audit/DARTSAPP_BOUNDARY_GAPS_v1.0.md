# DartsApp Boundary Gaps v1.0

- 作成日: 2026-07-14
- 対象: DartsApp repo `ShijimiWORKs-sudo/shijimiworks-DartsApp_Web`
- 境界基準: `docs/specs/DARTS_TWO_APP_PRODUCT_BOUNDARIES_v1.0.md`
- 実装変更: なし

## 1. Executive Summary

現在のリポジトリは、SQLiteゲーム基盤、COUNT-UP、単独01、単独STANDARD CRICKET、Account/Rating基盤、共通Account契約を持つ一方、README、app config、QA、主要route、BottomNav、Support系機能の多くが `DartsSupportApp` として残っている。

Phase 6 MATCHはPR #7 `Phase 6: two-player match vertical slice` で実装済み・main未マージであることをread-onlyで確認した。したがって、MATCH本体は不足機能ではなく「実装済み・マージ待ち・実機確認待ち」として扱う。

短期の正式DartsAppは Windows PC Web / Chrome / Edge / PC横長画面であるため、現状は「DartsAppゲーム基盤」と「DartsSupportApp MVP UI」が同居している状態と判断する。

削除や移動は今回行わない。次工程では、まずDartsAppとしてのproduct identity、PC Web QA、主要導線、Support機能の非主導線化を決める必要がある。

## 2. DartsAppに不足している本来機能

| ID      | 不足項目                      | 根拠                                                  | 影響                         | 推奨分類 |
| ------- | ----------------------------- | ----------------------------------------------------- | ---------------------------- | -------- |
| GAP-001 | PC Web product identity       | `package.json`, `app.json`, READMEがDartsSupportApp名 | 配布・QA・PRの対象誤認       | P1       |
| GAP-002 | PC横長ゲームUI                | 現行画面はScrollView/Card/BottomNav中心               | 1280x720/1920x1080受入不可   | P1       |
| GAP-003 | Chrome / Edge QA手順          | `docs/QA_CHECKLIST.md` がiPhone + Expo Go中心         | 正式QA未定義                 | P1       |
| GAP-005 | Rating計算本体                | Candidate/DBはあるが計算API未実装                     | Ratingが最終値へ進まない     | P2       |
| GAP-006 | Web camera / realtime scoring | photo-scoreは静止画・ImagePicker前提                  | DartsApp主目的の自動判定不足 | P2       |
| GAP-007 | Award sound/video playback    | assets候補はあるが再生基盤未実装                      | DartsApp演出不足             | P2       |
| GAP-008 | 道場50R                       | 仕様のみ                                              | 実践練習不足                 | P2       |
| GAP-009 | CRICKET COUNT-UP              | enum/Rating除外理由はあるがmode未実装                 | 実践練習不足                 | P2       |
| GAP-010 | ナンバー練習 / ブル練習       | Support practice menuとしては存在                     | DartsApp実践モード不足       | P3       |
| GAP-011 | フルスクリーン/キーボード操作 | PC Web QA項目として未整備                             | PC筐体利用に弱い             | P1       |
| GAP-012 | USB/Webカメラ対応方針         | Expo ImagePicker中心                                  | Windows PC Web利用に不明点   | P2       |

## 3. 実装済み・マージ待ち・実機確認待ち

| 項目             | 確認元                                         | 状態                              |
| ---------------- | ---------------------------------------------- | --------------------------------- |
| 2人対戦MATCH     | PR #7 Phase 6: two-player match vertical slice | IMPLEMENTED_IN_PR_PENDING_MERGE   |
| 501 / 701        | `MatchGameService`, `domain/match/**`          | PR #7で実装済み                   |
| STANDARD CRICKET | GAME 2 sequence                                | PR #7で実装済み                   |
| CHOICE           | `/game/match/[matchId]/choice`                 | PR #7で実装済み                   |
| MATCH Rating候補 | Rating Evaluation v2 candidate                 | PR #7で実装済み、計算本体は未実装 |
| MATCH共通契約    | `matchMapper.ts`, `matchContract.test.ts`      | PR #7で実装済み                   |

## 4. DartsAppに混入している可能性があるSupport機能

| ID      | 混入候補                     | パス                                                 | 理由                              | 推奨分類   |
| ------- | ---------------------------- | ---------------------------------------------------- | --------------------------------- | ---------- |
| MIX-001 | 今日の練習                   | `app/practice**`                                     | DartsSupportApp主機能             | HIDE       |
| MIX-002 | 簡易練習記録                 | `app/record.tsx`, `app/records**`                    | Support記録管理                   | HIDE       |
| MIX-003 | 分析ダッシュボード           | `app/analysis.tsx`                                   | Support詳細分析                   | HIDE       |
| MIX-004 | フォーム相談                 | `app/consult.tsx`                                    | DartsAppでは実装しない            | HIDE       |
| MIX-005 | フォーム写真相談             | `app/consult/form-photo/**`                          | DartsAppでは実装しない            | HIDE       |
| MIX-006 | 資料ライブラリ               | `app/library**`                                      | DartsAppでは実装しない            | HIDE       |
| MIX-007 | お気に入り練習               | `app/favorites.tsx`                                  | Support習慣化導線                 | HIDE       |
| MIX-008 | iPhone向けBottomNav          | `components/BottomNav.tsx`                           | PCゲームUIには不向き              | HIDE       |
| MIX-009 | iPhone/Expo Go QA            | `docs/QA_CHECKLIST.md`, README                       | DartsApp正式QAと不一致            | HIDE       |
| MIX-010 | EAS/TestFlight中心文書       | `docs/EAS_BUILD_GUIDE.md`, `docs/TESTFLIGHT_PREP.md` | DartsApp PC Web短期環境と不一致   | MOVE_LATER |
| MIX-011 | AppState Support fields      | `contexts/AppStateContext.tsx`                       | records/consult/favorites等が混在 | MOVE_LATER |
| MIX-012 | Support recommendation logic | `utils/recommendPracticeMenus.ts`                    | 今日の練習管理向け                | HIDE       |

## 5. PC Web確認不足

| 項目           | 現状                                                          |
| -------------- | ------------------------------------------------------------- |
| Web起動        | `npm run web -- --port 8104 --clear` でHTTP 200応答までは確認 |
| Web bundling   | `expo-sqlite` の `wa-sqlite.wasm` 解決エラーあり              |
| Chrome実操作   | 未確認                                                        |
| Edge実操作     | 未確認                                                        |
| 1280x720       | 未確認                                                        |
| 1920x1080      | 未確認                                                        |
| マウス         | 未確認                                                        |
| キーボード     | 未確認                                                        |
| USB/Webカメラ  | 未確認                                                        |
| スピーカー     | 未確認                                                        |
| フルスクリーン | 未確認                                                        |

Web bundling error:

```text
Unable to resolve "./wa-sqlite/wa-sqlite.wasm" from "node_modules/expo-sqlite/web/worker.ts"
```

このため、現時点では「Web dev serverは応答するが、DartsApp PC Webとして受入完了できる状態ではない」と扱う。

## 6. モバイル前提の箇所

- `app.json` の `orientation: portrait`
- iOS bundle identifier `com.shijimiworks.dartssupportapp`
- READMEの「iPhone Expo Goで確認する」
- QA_CHECKLISTの全体がiPhone + Expo Go前提
- BottomNavを主要5タブとして固定
- 写真選択/撮影が `expo-image-picker` 中心
- カード縦積み・ScrollView中心の画面構成

## 7. 共通契約にすべき項目

| 項目                          | 現状                           | 判断               |
| ----------------------------- | ------------------------------ | ------------------ |
| `account_id`                  | common-contract実装済み        | SHARED_CONTRACT    |
| OWNER/GUEST profile           | mapper実装済み                 | SHARED_CONTRACT    |
| Rating Profile                | mapper実装済み                 | SHARED_CONTRACT    |
| Game Session JSON             | COUNT-UP/01/CRICKET mapperあり | SHARED_CONTRACT    |
| MATCH JSON                    | PR #7で実装済み・main未マージ  | KEEP pending merge |
| CommonEvent                   | `common_events`あり            | SHARED_CONTRACT    |
| CommonOutbox                  | `common_outbox.local_only`あり | SHARED_CONTRACT    |
| PracticeRecord link           | `practice_record_links`あり    | SHARED_CONTRACT    |
| Board coordinate / hit source | photo-score utilsに実装        | REVIEW             |
| Export / Import validation    | common-contractに実装          | SHARED_CONTRACT    |

## 8. 仕様書と実装の不一致

| ID       | 仕様                                    | 実装                                            | 影響                     |
| -------- | --------------------------------------- | ----------------------------------------------- | ------------------------ |
| SPEC-001 | DartsAppはWindows PC Web主用途          | README/app.jsonはDartsSupportApp/iPhone中心     | product boundary不一致   |
| SPEC-002 | MATCH routeあり                         | PR #7で `/game/match/**` 実装済み・main未マージ | 実機確認とmainマージ待ち |
| SPEC-003 | Rating概要 `/rating`, `/rating/history` | 実装は `/account/rating-status` のみ            | route差分                |
| SPEC-004 | PC Chrome/Edge正式QA                    | QAはiPhone + Expo Go                            | 受入条件不足             |
| SPEC-005 | リアルタイム判定/USBカメラ              | 静止画photo-scoreのみ                           | 主機能不足               |
| SPEC-006 | Award効果音/動画                        | 素材候補のみ、再生未実装                        | 演出不足                 |
| SPEC-007 | DartsSupportAppへゲーム重複実装しない   | このrepoにSupport routeと正式ゲームが同居       | 2アプリ境界が曖昧        |

## 9. DBと画面の不一致

| ID     | DB                                                 | 画面/Service                                      | 判断               |
| ------ | -------------------------------------------------- | ------------------------------------------------- | ------------------ |
| DB-001 | `matches`, `match_players`, `match_player_results` | PR #7でMATCH画面・service実装済み・main未マージ   | merge待ち          |
| DB-002 | `rating_evaluations.source_type = match`           | PR #7でMATCH Rating候補実装済み、計算本体は未実装 | P2                 |
| DB-003 | `rating_snapshots`                                 | Snapshot更新エンジンなし                          | P2                 |
| DB-004 | `common_events`, `common_outbox`                   | UIでExport/Import実行なし                         | 連携前までは許容   |
| DB-005 | `practice_record_links`                            | Support AppState recordsと併存                    | 契約境界として整理 |

## 10. 残るPC Web不足機能

- Rating計算本体
- Rating Snapshot更新
- PC横長専用UI最適化
- Chrome / Edge正式QA
- `expo-sqlite` Web WASM解決
- camera / realtime scoring
- award音声・動画再生
- USBカメラ
- キーボード操作最適化
- フルスクリーンQA

## 11. Remove判断

今回の棚卸しでは `REMOVE` は0件とする。

理由:

- Support系機能は現時点で動作しており、境界確定前に削除しない。
- DartsSupportApp側への移管工程が未実施。
- データ互換や履歴文書を壊す恐れがある。
