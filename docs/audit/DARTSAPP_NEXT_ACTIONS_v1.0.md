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

| ID     | Action                                                 | 対象                             | 目的                           | 禁止範囲                      | QA                                 |
| ------ | ------------------------------------------------------ | -------------------------------- | ------------------------------ | ----------------------------- | ---------------------------------- |
| P0-001 | DartsApp repoでSupport新機能を増やさない方針を固定する | 今後のCodex指示書、PR review観点 | 2アプリ境界の追加混線を防ぐ    | 既存Support機能の削除         | PR本文で「DartsApp対象のみ」と確認 |
| P0-002 | DartsSupportApp repoを変更しない運用を継続する         | 作業手順、ブランチ運用           | DartsApp側の棚卸しを独立させる | DartsSupportApp通信・同期実装 | DartsSupportApp差分なしを確認      |

## 3. P1 Actions

| ID     | Action                                            | 対象候補                                   | 目的                                                                     | 禁止範囲                 | QA                                        |
| ------ | ------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------ | ------------------------ | ----------------------------------------- |
| P1-001 | product identityをDartsApp PC Webへ揃える         | `package.json`, `app.json`, README, docs   | repo名・アプリ名・QA対象を一致させる                                     | ゲームロジック変更       | `git diff`でmetadata/docs中心であること   |
| P1-002 | PC Web QA checklistを追加する                     | `docs/QA_CHECKLIST.md` または新規PC QA文書 | Chrome/Edge/1280/1920/マウス/キーボード/カメラ/スピーカー/全画面を正式化 | iPhone QAの削除          | Chrome/Edgeの起動確認結果を記録           |
| P1-003 | Web起動の `expo-sqlite` WASM解決を修正する        | Web bundler設定、sqlite web dependency     | PC Web受入を可能にする                                                   | DB schema変更            | `npm run web` でbundle errorなし          |
| P1-004 | PC横長のゲームハブ導線を定義する                  | Home/Game Hub/Navigation docs              | DartsAppの初期表示をPCゲーム用途に寄せる                                 | Support機能削除          | 1280x720/1920x1080で目視確認              |
| P1-005 | MATCH本体をmainへ統合する                         | `/game/match/**`, Match service/domain     | DartsApp主機能を満たす                                                   | Rating計算本体・外部通信 | MATCH 501/701 + CRICKET + CHOICEをテスト  |
| P1-006 | Support routeをDartsApp主導線から外す方針を決める | BottomNav, route docs                      | DartsApp操作面をゲーム中心にする                                         | 既存route削除            | 主要導線からSupport画面へ不用意に入らない |

## 4. P2 Actions

| ID     | Action                                      | 対象候補                                           | 目的                               | 禁止範囲                      | QA                                         |
| ------ | ------------------------------------------- | -------------------------------------------------- | ---------------------------------- | ----------------------------- | ------------------------------------------ |
| P2-001 | Rating計算本体を実装する                    | rating service/snapshot                            | v1.1仕様のRating確定・更新         | DartsSupportApp同期           | Rating候補からSnapshot更新までの単体テスト |
| P2-002 | Award音声・動画再生を実装する               | assets/audio, assets/video, playback layer         | DartsApp演出を満たす               | 素材ライセンス未確認の公開    | 再生/停止/ミュート/未対応環境を確認        |
| P2-003 | Web camera / realtime scoring方針を実装する | camera access, board calibration, scoring pipeline | PC Webの自動判定主機能を満たす     | DartsSupportAppカメラ相談機能 | USB/Webカメラと手入力fallbackを確認        |
| P2-004 | 道場50Rを実装する                           | practice game mode                                 | 実践トレーニングをDartsApp側へ実装 | Supportの今日の練習管理       | 50R完走・中断・記録を確認                  |
| P2-005 | CRICKET COUNT-UPを実装する                  | practice game mode                                 | CRICKET実践トレーニングを追加      | STANDARD CRICKET仕様変更      | 対象ナンバー・終了条件を確認               |

## 5. P3 Actions

| ID     | Action                                                      | 対象候補                  | 目的                                      | QA                             |
| ------ | ----------------------------------------------------------- | ------------------------- | ----------------------------------------- | ------------------------------ |
| P3-001 | ナンバー練習 / ブル練習をDartsApp実践モードとして再定義する | practice mode docs/routes | Support記録機能ではなく実投擲モードへ整理 | 入力・履歴・Rating除外を確認   |
| P3-002 | Support機能の移管計画を作成する                             | DartsSupportApp側Backlog  | 既存Support UIの扱いを安全に決める        | DartsApp側で削除せず計画化     |
| P3-003 | Export / Import UXを整える                                  | common-contract UI        | 共通契約をユーザー操作へ接続              | 秘密情報なし、local_onlyを確認 |

## 6. Recommended Sequence

1. P0-001 / P0-002で今後の境界運用を固定する。
2. P1-001 / P1-002 / P1-003でDartsApp PC Webとしての受入前提を整える。
3. P1-004 / P1-006で主要導線をゲーム中心へ寄せる。ただしSupport routeは削除しない。
4. P1-005でMATCH本体をmainへ統合する。
5. P2のRating、camera、award、practice modeへ進む。

## 7. Non Goals

今回の棚卸しから直接実装しない項目:

- CRICKET本体の変更
- MATCH本体の新規実装
- Rating計算本体
- DB migration
- route削除
- package変更
- 効果音・動画再生
- DartsSupportApp通信
- DartsSupportApp repo変更
