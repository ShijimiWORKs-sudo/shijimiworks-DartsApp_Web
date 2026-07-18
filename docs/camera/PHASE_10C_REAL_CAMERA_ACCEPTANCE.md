# Phase 10C Real Camera Acceptance

## Scope

- カメラPC単体のCOUNT-UP MVP
- LAN未接続での候補生成、確定、手動補正、Undo / Redo、pause / resume / abort
- 影とダーツ本体の識別改善
- 画像本体を保存しない診断JSON

## Recommended Throw Set

- S11: 20投
- S16: 20投
- S20: 20投
- BULL: 20投
- LOW TON相当: 5ターン
- HIGH TON相当: 5ターン
- TON 80相当: 3ターン
- 強い影が出る照明条件: 10投
- 照明改善後: 10投

## Pass Criteria

- 第一候補が実投擲セグメントと一致する割合が改善している
- S11実投擲時にS16影を第一候補へしない
- `componentDiagnostics.elongation < 2.2` の影候補は除外または低confidenceになる
- 近接重複候補が3件へ水増しされない
- `highResolutionRoi` がある候補ではsource 640系のTip評価が表示される
- 照明診断JSONに画像、base64、grayPixelsが含まれない
- 手動補正後もゲーム進行、結果保存、再読込が維持される

## Tomorrow Physical-Camera Items

- 実カメラでDirect Canvasが優先されること
- 1280x720 / 1920x1080で候補マーカーと盤面座標が一致すること
- 影方向学習が3件以上の手動補正で有効化されること
- 照明改善前後で`shadowRisk`が下がること
- 8ラウンドCOUNT-UPを最後までプレイできること
