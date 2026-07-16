# DartsApp Codex Phase 10A 実装指示書

- フェーズ: Phase 10A カメラ基盤
- 文書バージョン: 1.0
- 作業フォルダ: `C:\制作データ\10_App\DartsApp`
- リポジトリ: `ShijimiWORKs-sudo/shijimiworks-DartsApp_Web`
- 作業ブランチ: `codex/phase-10a-camera-foundation`
- ベース: Phase 8マージ済み`main`
- Phase 9とは別ブランチで並行実施
- Expo SDK: 54を維持
- 対応対象: iPhone Expo Go / Chrome / Edge

---

## 1. 目的

Phase 10Aでは、将来のダーツ自動判定に必要な**カメラ入力基盤だけ**を実装してください。

今回の完成範囲:

```text
カメラ利用可否確認
→ 権限説明
→ 権限リクエスト
→ カメラプレビュー
→ 背面/前面切替
→ ダーツボード撮影ガイド表示
→ 静止画撮影
→ 撮影画像プレビュー
→ 撮り直し / この写真を使う
→ 画面離脱時のカメラ停止
```

「この写真を使う」はPhase 10Aでは次工程へ渡せる一時データを作るところまでです。スコア判定や画像認識は行いません。

---

## 2. 必ず読むもの

最初から最後まで読んでください。

```text
package.json
app.json
README.md
docs/ARCHITECTURE.md
docs/ROUTES.md
docs/specs/DARTS_TWO_APP_PRODUCT_BOUNDARIES_v1.0.md
docs/audit/DARTSAPP_FEATURE_INVENTORY_v1.0.md
docs/audit/DARTSAPP_BOUNDARY_GAPS_v1.0.md
docs/audit/DARTSAPP_NEXT_ACTIONS_v1.0.md
docs/implementation/PHASE_7_REPORT.md
docs/implementation/PHASE_8_REPORT.md
```

Expo公式のSDK 54 Camera仕様を基準にしてください。

```text
https://docs.expo.dev/versions/v54.0.0/sdk/camera/
```

重要な公式仕様:

- `expo-camera`はAndroid / iOS / Web対応
- Expo Goに含まれる
- SDK 54推奨版は`~17.0.10`
- `CameraView`を使用
- `useCameraPermissions`を使用
- 撮影前に`onCameraReady`を待つ
- 同時に有効なカメラプレビューは1つだけ
- 画面非表示時はCameraViewをアンマウントまたは停止
- Webの撮影URIはbase64形式
- Nativeの撮影URIは一時キャッシュ

---

## 3. 作業開始

未追跡の次を削除・変更・stash・commitしないでください。

```text
Context/
DartsApp_DB_v1_schema.sql
assets/audio/
assets/video/
docs/licenses/
未追跡のCodex指示書・仕様書
```

禁止:

```text
git add .
git add -A
git reset --hard
force push
mainへのマージ
```

開始コマンド:

```powershell
cd "C:\制作データ\10_App\DartsApp"
git status --short
git fetch origin
git switch main
git pull --ff-only origin main
git switch codex/phase-10a-camera-foundation
git pull --ff-only origin codex/phase-10a-camera-foundation
git branch --show-current
```

baseline:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run format:check
npm.cmd test
npm.cmd run validate:data
npx.cmd expo export --platform web
```

baseline失敗時は実装せず報告してください。

---

## 4. Phase 9との並行ルール

Phase 9は`codex/phase-9-rating-engine`で継続中です。

Phase 10Aでは次へ触れないでください。

```text
features/game/domain/rating/**
features/game/application/services/RatingApplicationService.ts
features/game/application/services/RatingRecalculationService.ts
features/game/infrastructure/sqlite/repositories/SQLiteRatingRepository.ts
app/account/rating/**
components/game/RatingResultCard.tsx
app/dev/match-diagnostics/**
```

Phase 9がmainへ入るまでは、Phase 10Aをmainへマージしません。

Phase 10A完了後:

1. Draft PRを作る
2. Phase 9のmainマージ後にlatest mainを取り込む
3. コンフリクト解消
4. Rating回帰確認
5. その後にPhase 10Aをマージ候補にする

---

## 5. 今回の対象

### 必須

- `expo-camera`導入
- カメラ権限
- カメラ利用可否
- CameraViewプレビュー
- 背面 / 前面切替
- Camera ready状態
- Camera mount error表示
- 静止画撮影
- 撮影中の二重押下防止
- 撮影画像のプレビュー
- 撮り直し
- 写真採用
- ダーツボード用撮影ガイド
- 画面focus / blur時のカメラ停止
- Web / Expo Go
- Chrome / Edge / iPhone検証
- テスト
- docs
- Draft PR

### 任意

- カメラがないWeb環境で写真ライブラリ選択へ誘導
- 既存`expo-image-picker`を使った代替画像入力
- iOSで利用可能なレンズ一覧表示

### 対象外

- ダーツ検出
- ダーツボード自動検出
- OpenCV
- ML Kit
- TensorFlow / ONNX
- スコア自動判定
- BULL / 20方向の推定
- 画像補正・射影変換
- リアルタイム動画判定
- カメラ常時録画
- 音声録音
- USBカメラ専用制御
- 画像クラウド送信
- Supabase
- DartsSupportApp通信
- DB migration
- Rating変更
- ゲーム進行への自動入力

---

## 6. package / app config

### 6.1 インストール

手動でバージョンを推測せず、Expo SDK 54互換版を入れてください。

```powershell
npx.cmd expo install expo-camera
```

期待:

```text
expo-camera: SDK 54互換版（公式推奨は~17.0.10）
```

Expo本体やReact Nativeのメジャー / マイナー更新は禁止です。

既存のExpo patch警告をPhase 10Aの都合だけで一括更新しないでください。

### 6.2 app.json

`plugins`へ`expo-camera`を追加してください。

動画・音声録音は対象外なので、Androidの録音権限は追加しません。

推奨:

```json
[
  "expo-camera",
  {
    "cameraPermission": "ダーツボードを撮影して、刺さった位置の記録候補を作成するためにカメラを使用します。",
    "recordAudioAndroid": false
  }
]
```

既存の`NSCameraUsageDescription`との文言を整合させてください。

`NSMicrophoneUsageDescription`や`RECORD_AUDIO`を新規追加しないでください。

既存のapp identity、bundle identifier、EAS projectId、orientationは変更しないでください。

---

## 7. route

最低限、次を追加してください。

```text
/camera
/camera/capture
/camera/review
```

役割:

```text
/camera
- カメラ機能説明
- 対応状況
- 権限状態
- 撮影開始
- 写真ライブラリ選択（任意）

/camera/capture
- CameraView
- 撮影ガイド
- カメラ切替
- 撮影
- 戻る

/camera/review
- 撮影画像
- 幅 / 高さ
- platform
- 撮り直す
- この写真を使う
```

採用後route候補:

```text
/camera/accepted
```

ただしPhase 10Aでは「写真を受け付けました。自動判定は次工程で実装します。」までで構いません。

---

## 8. 共通Camera foundation

UIへ`expo-camera`の詳細を直接散らさず、共通層を作ってください。

候補:

```text
features/camera/domain/types.ts
features/camera/application/CameraCaptureService.ts
features/camera/application/cameraSession.ts
features/camera/ui/useCameraSession.ts
components/camera/CameraPermissionCard.tsx
components/camera/DartboardCaptureGuide.tsx
components/camera/CapturedImageReview.tsx
```

最低型:

```ts
export type CameraPermissionState =
  | 'loading'
  | 'granted'
  | 'denied'
  | 'blocked'
  | 'unavailable'
  | 'error';

export type CameraFacing = 'back' | 'front';

export type CapturedBoardImage = {
  id: string;
  uri: string;
  width: number;
  height: number;
  capturedAt: string;
  platform: 'ios' | 'android' | 'web';
  facing: CameraFacing;
  mimeType: 'image/jpeg';
  base64Included: boolean;
};
```

画像解析向け将来拡張は可能にしますが、判定値は入れないでください。

---

## 9. カメラ権限

`useCameraPermissions`を使用してください。

状態を明確に分けてください。

### loading

```text
カメラ権限を確認しています…
```

### 未許可・再リクエスト可能

```text
ダーツボードを撮影するため、カメラへのアクセスが必要です。
[カメラを許可する]
```

### denied / canAskAgain=false

```text
カメラが無効になっています。
端末の設定からDartsAppのカメラを許可してください。
[設定方法を見る]
```

OS設定を直接開ける場合は`Linking.openSettings()`を使用可能です。

### unavailable

```text
この端末ではカメラを利用できません。
写真ライブラリから画像を選択してください。
```

### Web

- `localhost`で確認
- ブラウザ権限拒否を正しく表示
- `Camera.isAvailableAsync()`相当の利用可否確認
- cross-origin iframe前提にしない
- 8104 proxy経由で確認

権限リクエストはユーザー操作後だけ実行し、画面表示直後に勝手にダイアログを出さないでください。

---

## 10. CameraView

`CameraView`を使ってください。

最低props:

```tsx
<CameraView
  ref={cameraRef}
  style={styles.camera}
  facing={facing}
  mode="picture"
  flash="off"
  animateShutter
  onCameraReady={handleCameraReady}
  onMountError={handleMountError}
/>
```

条件:

- 初期は`back`
- front / back切替
- `onCameraReady`まで撮影ボタン無効
- mount errorを一般向け文言で表示
- 連打防止
- 撮影中インジケータ
- 同時にCameraViewを複数mountしない
- review画面ではCameraViewをmountしない
- capture画面のfocusが外れたらCameraViewをunmount
- ブラウザ戻るでも停止
- Expo Routerのfocus lifecycleを使用

カメラ切替時は準備状態を一度falseへ戻し、再度`onCameraReady`を待ってください。

---

## 11. 撮影

`takePictureAsync()`は`onCameraReady`後だけ呼んでください。

推奨options:

```ts
{
  quality: 0.85,
  skipProcessing: false,
  exif: false,
  base64: Platform.OS === 'web'
}
```

要件:

- 撮影成功時にuri / width / heightを保持
- Webではbase64 URIを扱える
- Nativeではcache URIを扱う
- Phase 10Aでは永久保存しない
- 画像をDBへbase64保存しない
- 画像をGit管理しない
- クラウド送信しない
- 失敗時は再試行可能

エラー表示:

```text
撮影できませんでした。
カメラを確認して、もう一度お試しください。
```

技術的errorは`console.warn`へ出し、画面にstack traceを表示しないでください。

---

## 12. ダーツボード撮影ガイド

CameraView上へガイドを重ねてください。

必須:

- 円形または正方形のボード配置枠
- 中心クロス
- 上方向マーカー
- 「ボード全体を枠内に入れてください」
- 「できるだけ正面から撮影してください」
- ガイドは撮影画像へ焼き込まない
- pointerEvents="none"

PC Web:

- カメラ領域左または中央
- 操作パネルを右へ置く2列構成
- 1280×720で撮影ボタン表示

Mobile:

- 縦型
- preview上にガイド
- 下部へ撮影ボタン

ガイド座標やboard calibrationはPhase 10Bで扱うため、今回は表示だけです。

---

## 13. review

撮影後に表示:

- 撮影画像
- 横幅
- 縦幅
- 撮影日時
- カメラ向き
- Web / iOS / Android
- [撮り直す]
- [この写真を使う]

撮り直す:

- captureへ戻る
- 旧一時画像stateを破棄

この写真を使う:

- Phase 10A用の一時sessionへ保存
- accepted画面または確認カードへ移動
- 自動判定はしない

表示:

```text
写真を受け付けました。
刺さり位置の自動判定は次の工程で追加します。
```

アプリ再起動後の復元はPhase 10A対象外です。

---

## 14. 導線

PC HOME / GAMEに大きな変更を入れず、最小導線を追加してください。

候補:

```text
GAME画面:
「カメラ撮影テスト」

Accountまたは開発カード:
「カメラ設定」
```

既存ゲーム開始ボタン、Ratingカード、離脱Modalを壊さないでください。

Phase 10Aではゲーム入力画面へ撮影結果を自動反映しないでください。

---

## 15. 並列作業

最初に統合担当が直列で確定:

- route
- public types
- camera session API
- Agent所有ファイル
- package / app config担当

その後、同一ファイルを同時編集しない範囲で並列実行してください。

### Agent A: package / permission / platform

所有:

```text
package.json
package-lock.json
app.json
features/camera/application/**
```

担当:

- expo-camera導入
- permission state
- availability
- platform差分

### Agent B: capture UI

所有:

```text
app/camera/index.tsx
app/camera/capture.tsx
components/camera/CameraPermissionCard.tsx
components/camera/DartboardCaptureGuide.tsx
features/camera/ui/**
```

担当:

- preview
- guide
- facing
- capture
- lifecycle

### Agent C: review / temporary session

所有:

```text
app/camera/review.tsx
app/camera/accepted.tsx
components/camera/CapturedImageReview.tsx
features/camera/domain/**
```

担当:

- captured image model
- review
- retake
- accept

### Agent D: tests / docs / QA

所有:

```text
tests/camera/**
tests/web/cameraRoutes.test.ts
README.md
docs/ROUTES.md
docs/ARCHITECTURE.md
docs/implementation/PHASE_10A_REPORT.md
```

統合担当だけが導線共通ファイルを変更してください。

---

## 16. テスト

既存テストをすべて維持してください。

最低限:

1. permission loading
2. permission granted
3. permission denied / canAskAgain=true
4. permission blocked
5. unavailable
6. permission requestはボタン操作で実行
7. CameraViewはgranted時だけmount
8. onCameraReady前は撮影不可
9. ready後は撮影可能
10. 撮影中二重実行なし
11. takePicture成功
12. takePicture失敗から再試行
13. front / back切替
14. 切替後readyを再待機
15. blur時CameraView unmount
16. review中CameraViewなし
17. 撮り直し
18. 写真採用
19. Web base64 URI
20. Native cache URI
21. guide overlayは画像データへ含めない
22. game / rating / account回帰
23. DB migrationなし
24. user_version維持

`expo-camera`はテスト環境でmockしてください。

実機カメラがなくてもunit testが通る構成にしてください。

---

## 17. 実機確認

### Chrome 8104

- 権限前表示
- 権限許可
- preview
- back/front切替（利用可能な場合）
- 撮影
- review
- 撮り直し
- 採用
- Console errorなし

### Edge 8104

同じ内容。

### iPhone Expo Go

- QR接続
- カメラ権限
- 背面preview
- 前面切替
- 静止画撮影
- review
- 画面離脱後にカメラ使用ランプが消える
- captureへ戻ると再開

### 権限拒否

最低1環境で拒否状態を確認してください。

---

## 18. スクリーンショット

完了報告へ最低限添付:

1. Chrome 1280×720 カメラプレビューとガイド
2. Chrome 撮影後review
3. iPhone Expo Go カメラプレビュー
4. iPhone Expo Go review

実画像に個人情報や室内の不要な情報が写る場合は、ダーツボードだけを撮影してください。

---

## 19. 検証

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run format:check
npm.cmd test
npm.cmd run validate:data
npx.cmd expo export --platform web
```

Web:

```powershell
npm.cmd run web -- --port 8110 --clear
```

Phase 9が8104を使用中のため、Phase 10Aは**8110**を使用してください。

Expo Go:

```powershell
npm.cmd run start:lan
```

必要ならPhase 9側と同時起動しない時間帯にExpo Go確認をしてください。

確認:

- migration追加なし
- `PRAGMA user_version = 3`維持
- Database is lockedなし
- CameraView二重mountなし
- 未処理Promiseなし
- Console errorなし

---

## 20. docs

更新:

```text
README.md
docs/ROUTES.md
docs/ARCHITECTURE.md
docs/implementation/PHASE_10A_REPORT.md
```

レポート:

1. 実装範囲
2. Expo Camera version
3. app config
4. permission state
5. Web availability
6. CameraView lifecycle
7. capture
8. review
9. temporary session
10. guide overlay
11. Chrome
12. Edge
13. Expo Go
14. tests
15. DB変更なし
16. Phase 10Bへの引継ぎ
17. 既知制限

---

## 21. Git / PR

同じブランチへcommit / pushしてください。

```text
codex/phase-10a-camera-foundation
```

推奨commit:

```text
feat(camera): add camera capture foundation
```

Draft PR:

```text
Title:
Phase 10A: Camera capture foundation

Base:
main
```

mainへマージしないでください。

Phase 9がmainへマージされた後、Phase 10Aブランチへlatest mainを取り込み、Rating回帰を行います。

---

## 22. 完了報告

1. 実装概要
2. 並列作業
3. expo-camera version
4. package変更
5. app.json変更
6. permission状態
7. CameraView
8. lifecycle
9. back/front
10. 撮影
11. review
12. retake
13. accept
14. guide
15. Web結果
16. Chrome結果
17. Edge結果
18. Expo Go結果
19. 権限拒否結果
20. 全検証結果
21. テスト総数
22. migration有無
23. user_version
24. 変更ファイル
25. commit SHA
26. push結果
27. Draft PR
28. mergeable
29. 未追跡資料維持
30. Phase 10B候補

Phase 10Aで停止してください。
画像認識、スコア判定、OpenCV、MLモデル、ゲーム自動入力には進まないでください。
