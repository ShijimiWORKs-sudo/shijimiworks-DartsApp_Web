# DartsApp Next Actions v1.0

- 作成日: 2026-07-14
- 対象: DartsApp repo `ShijimiWORKs-sudo/shijimiworks-DartsApp_Web`
- 入力: `DARTSAPP_FEATURE_INVENTORY_v1.0.md`, `DARTSAPP_BOUNDARY_GAPS_v1.0.md`
- 実装変更: なし

## 1. Priority Definition

| Priority | 意味                                                    |
| -------- | ------------------------------------------------------- |
| P0       | 境界混線を広げないため、次の実装前に方針固定する項目    |
| P1       | DartsApp PC Webとして受入・PR判断に必要な項目           |
| P2       | DartsApp正式機能として必要だが、P1完了後に着手する項目  |
| P3       | 将来拡張またはDartsSupportApp移管計画とあわせて扱う項目 |

## 2. P0 Actions

| ID     | Action                                                 | 対象                             | 目的                                | 禁止範囲                      | QA                                     |
| ------ | ------------------------------------------------------ | -------------------------------- | ----------------------------------- | ----------------------------- | -------------------------------------- |
| P0-001 | PR #7のMATCH実機確認を行う                             | PR #7 Phase 6 MATCH              | 実装済みMATCHをmain投入前に確認する | Rating計算本体・外部通信      | 501/701、CRICKET、CHOICE、pause/resume |
| P0-002 | PR #7をmainへマージする                                | `origin/codex/phase-6-match`     | MATCHをDartsApp本体機能へ昇格する   | rebase/履歴改変               | main上でMATCH route/service/testを確認 |
| P0-003 | DartsApp repoでSupport新機能を増やさない方針を固定する | 今後のCodex指示書、PR review観点 | 2アプリ境界の追加混線を防ぐ         | 既存Support機能の削除         | PR本文で「DartsApp対象のみ」と確認     |
| P0-004 | DartsSupportApp repoを変更しない運用を継続する         | 作業手順、ブランチ運用           | DartsApp側の棚卸しを独立させる      | DartsSupportApp通信・同期実装 | DartsSupportApp差分なしを確認          |

## 3. P1 Actions

| ID     | Action                                            | 対象候補                                   | 目的                                                                     | 禁止範囲           | QA                                        |
| ------ | ------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------ | ------------------ | ----------------------------------------- |
| P1-001 | PR #8棚卸し文書を最新mainへ取り込む               | `docs/audit/**`                            | PR #7マージ後のmainに棚卸し結果を残す                                    | コード変更         | PR #8を最新mainへmerge/update             |
| P1-002 | Web起動の `expo-sqlite` WASM解決を修正する        | Web bundler設定、sqlite web dependency     | PC Web受入を可能にする                                                   | DB schema変更      | `npm run web` でbundle errorなし          |
| P1-003 | PC横長のゲームハブ導線を定義する                  | Home/Game Hub/Navigation docs              | DartsAppの初期表示をPCゲーム用途に寄せる                                 | Support機能削除    | 1280x720/1920x1080で目視確認              |
| P1-004 | PC Web QA checklistを追加する                     | `docs/QA_CHECKLIST.md` または新規PC QA文書 | Chrome/Edge/1280/1920/マウス/キーボード/カメラ/スピーカー/全画面を正式化 | iPhone QAの削除    | Chrome/Edgeの起動確認結果を記録           |
| P1-005 | product identityをDartsApp PC Webへ揃える         | `package.json`, `app.json`, README, docs   | repo名・アプリ名・QA対象を一致させる                                     | ゲームロジック変更 | `git diff`でmetadata/docs中心であること   |
| P1-006 | Support routeをDartsApp主導線から外す方針を決める | BottomNav, route docs                      | DartsApp操作面をゲーム中心にする                                         | 既存route削除      | 主要導線からSupport画面へ不用意に入らない |

## 4. P2 Actions

| ID     | Action                                            | 対象候補                                           | 目的                                   | 禁止範囲                      | QA                                         |
| ------ | ------------------------------------------------- | -------------------------------------------------- | -------------------------------------- | ----------------------------- | ------------------------------------------ |
| P2-001 | Rating計算本体を実装する                          | rating service/snapshot                            | v1.1仕様のRating確定・更新             | DartsSupportApp同期           | Rating候補からSnapshot更新までの単体テスト |
| P2-002 | Rating Snapshot更新を実装する                     | rating snapshot writer                             | MATCH/単独ゲーム結果をRating履歴へ反映 | DartsSupportApp同期           | Snapshot作成・再計算境界を確認             |
| P2-003 | Award音声・動画再生を実装する                     | assets/audio, assets/video, playback layer         | DartsApp演出を満たす                   | 素材ライセンス未確認の公開    | 再生/停止/ミュート/未対応環境を確認        |
| P2-004 | Web camera / realtime scoring方針を実装する       | camera access, board calibration, scoring pipeline | PC Webの自動判定主機能を満たす         | DartsSupportAppカメラ相談機能 | USB/Webカメラと手入力fallbackを確認        |
| P2-005 | USBカメラ・キーボード・フルスクリーンQAを整備する | PC Web QA / settings                               | 実機筐体利用の受入条件を固める         | モバイル前提への回帰          | USBカメラ、キーボード、全画面を確認        |
| P2-006 | 道場50Rを実装する                                 | practice game mode                                 | 実践トレーニングをDartsApp側へ実装     | Supportの今日の練習管理       | 50R完走・中断・記録を確認                  |
| P2-007 | CRICKET COUNT-UPを実装する                        | practice game mode                                 | CRICKET実践トレーニングを追加          | STANDARD CRICKET仕様変更      | 対象ナンバー・終了条件を確認               |

## 5. P3 Actions

| ID     | Action                                                      | 対象候補                  | 目的                                      | QA                             |
| ------ | ----------------------------------------------------------- | ------------------------- | ----------------------------------------- | ------------------------------ |
| P3-001 | ナンバー練習 / ブル練習をDartsApp実践モードとして再定義する | practice mode docs/routes | Support記録機能ではなく実投擲モードへ整理 | 入力・履歴・Rating除外を確認   |
| P3-002 | Support機能の移管計画を作成する                             | DartsSupportApp側Backlog  | 既存Support UIの扱いを安全に決める        | DartsApp側で削除せず計画化     |
| P3-003 | Export / Import UXを整える                                  | common-contract UI        | 共通契約をユーザー操作へ接続              | 秘密情報なし、local_onlyを確認 |

## 6. Recommended Sequence

1. P0-001でPR #7のMATCH実機確認を行う。
2. P0-002でPR #7をmainへマージする。
3. P1-001でPR #8棚卸し文書を最新mainへ取り込む。
4. P1-002で`expo-sqlite` Web WASM問題を解決する。
5. P1-003 / P1-004でPC横長UIとChrome / Edge QAを整える。
6. P2-001 / P2-002でRating計算本体とSnapshot更新へ進む。
7. P2-003 / P2-004 / P2-005で効果音・アワード動画、USBカメラ、リアルタイム判定を進める。

## 7. Non Goals

今回の棚卸しから直接実装しない項目:

- CRICKET本体の変更
- PR #7以外でのMATCH本体の再実装
- Rating計算本体
- DB migration
- route削除
- package変更
- 効果音・動画再生
- DartsSupportApp通信
- DartsSupportApp repo変更
