# Phase 5 Report: Standalone Standard Cricket

## 1. 実装範囲

単独STANDARD CRICKETのドメイン、SQLite永続化サービス、Expo Router画面、ゲームハブ導線、結果画面、Rating候補作成、Outbox作成、テストを実装しました。

## 2. 並列化の有無

実装中に共通型・public APIを先に直列で確定しました。ファイル競合を避けるため、今回の編集はメイン担当で統合しながら進めました。

## 3. Agent担当

- Agent A相当: CRICKETドメイン型、採点、CLOSE/Over Mark判定
- Agent B相当: `CricketGameService`、SQLite永続化、Rating候補、Outbox
- Agent C相当: `/game/cricket/*` 画面とゲームハブ接続
- Agent D相当: ドメイン/サービス/Rating候補テスト
- Agent E相当: README、ROUTES、ARCHITECTURE、本レポート

## 4. 0点上がり禁止

全7ターゲットをCLOSEしてもCRICKET得点が0点の場合、自然終了しません。画面では継続理由を表示し、15ラウンド以内は入力を継続できます。

## 5. CLOSE / Over Mark / 得点

20/19/18/17/16/15/BULLを対象に、3マーク以上でCLOSEします。CLOSEに必要なマークを超えた分だけOver Markとしてターゲット値をCRICKET得点に加算します。BULLは25点換算です。

## 6. MPR

有効マーク合計を確定TURN数で割り、milli単位で `game_player_results.mpr_milli` と `rating_evaluations.cricket_mpr_milli` に保存します。

## 7. DB変更の有無

新規migrationはありません。Phase 1/4で用意済みの `game_sessions.mode = 'cricket'`、`cricket_number_states`、`darts.cricket_marks`、`game_player_results`、Rating Evaluation v2を利用します。

## 8. migration version

`PRAGMA user_version = 2` を維持します。

## 9. Rating候補

初回Rating確定後、Account OWNERの単独CRICKET完了時に `source_type = 'standalone_cricket'`、`source_weight_milli = 500` のpending `rating_evaluations` を作成します。Rating計算本体とSnapshot適用は未実装です。

## 10. Outbox

完了時に `practice_record_upsert` のpending Outboxを作成します。Rating候補が作成された場合は `rating_recalculate` のpending Outboxも作成します。

## 11. テスト結果

追加テストで採点、0点全CLOSE継続、1点以上の自然終了、15R round limit、Undo/Redo、voided dart保持、Rating候補作成を確認しました。

## 12. 実機確認

未実施です。ローカルの型チェック、lint、format check、Nodeテスト、data validationで検証します。

## 13. 未実装

MATCH本体、Rating計算本体、Rating Snapshot更新、効果音、アワード動画、音源/動画再生は未実装です。

## 14. 次フェーズ候補

MATCH縦断実装、Rating計算本体、Rating履歴画面、音源/動画演出、実機QAの拡張が候補です。
