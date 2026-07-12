# TestFlight Prep

DartsSupportAppをTestFlightへ進める前の準備メモです。

## Apple Developer Program

iOS配布ビルド、TestFlight、App Store Connectの利用にはApple Developer Programへの加入が必要です。

## App Store Connect

新規アプリ作成時の候補:

- App name: `DartsSupportApp`
- Bundle ID: `com.shijimiworks.dartssupportapp`
- SKU案: `dartssupportapp-ios-001`
- Primary language: Japanese
- Category案: Sports
- Secondary Category案: Health & Fitness または Productivity

## 年齢レーティング

練習支援、記録、一般的なフォーム相談を扱います。医療的な診断や治療を目的としないことをメタデータにも明記してください。

## TestFlight

- 内部テスター: App Store Connect内のチームメンバー向け
- 外部テスター: Beta App Reviewが必要になる可能性あり
- 初回提出前にPrivacy / Terms / Creditsの内容を確認

## スクリーンショット候補

- 初期設定
- ホーム
- 今日の練習
- 練習詳細
- 記録入力
- 分析
- フォーム相談
- 相談履歴
- 資料ライブラリ
- お気に入り

## URL準備

TestFlightやApp Store Connectで以下のURLが必要になる可能性があります。

- Privacy Policy URL: 未定
- Support URL: 未定
- Marketing URL: 任意
- Terms URL: 任意

v0.1.0時点ではアプリ内に `/legal/privacy`、`/legal/terms`、`/legal/credits` を用意しています。公開配布前にWeb公開用URLを準備してください。
