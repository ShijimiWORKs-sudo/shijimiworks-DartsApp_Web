# Phase 10B Report: LAN Camera Node Foundation

## Scope

- 同一Wi-Fi上の別PCをCamera Nodeとして使うLAN WebSocket基盤を追加
- ゲームPC側にLAN relay serverを追加
- Camera Node側はlocalhostでCameraViewを起動
- Relayへ送るのはTestDetectionCandidate、heartbeat、状態、accept/rejectのみ
- 映像全体、base64画像、Account token、個人情報はLAN送信しない

## Routes

- `/camera/lan`: ゲーム操作PC側の接続画面
- `/camera/node`: カメラ判定PC側のCamera Node画面
- `/camera/capture`: Phase 10A単体撮影テストを維持

## Scripts

- `npm.cmd run camera:relay`: `ws://0.0.0.0:8120` でRelay待受
- `npm.cmd run web:lan-main`: ゲームPC Webを `http://localhost:8112` で起動
- `npm.cmd run camera:node`: Camera Node Webを `http://localhost:8110` で起動

## Protocol

- `protocolVersion = 1`
- 6桁pairing code
- pairing TTL: 2分
- heartbeat: 5秒
- offline timeout: 15秒
- reconnect: exponential backoff、最大30秒
- sessionId不一致を拒否
- protocolVersion不一致を表示
- 重複candidateIdを二重反映しない
- 2台目Nodeは自動選択せず拒否

## Secure Context

Camera Node画面はカメラPC自身のlocalhostで開きます。

禁止:

- `http://ゲームPCのLAN-IP/camera/node` をカメラPCから開いてgetUserMediaする構成

## Explicit Non-Goals

- OpenCV
- ML
- スコア画像認識
- ダーツ輪郭検出
- 盤面キャリブレーション
- 動体検出
- 自動確定
- WebRTC映像配信
- クラウド中継
- DartsSupportApp通信
- Rating変更
- migration追加

## Database

- migration追加なし
- `PRAGMA user_version = 3` を維持
- 映像、base64画像、LAN候補ログはSQLiteへ保存しない
