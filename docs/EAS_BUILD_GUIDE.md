# EAS Build Guide

DartsSupportAppをEAS BuildでiOS向けにビルドするための準備メモです。

## 前提

- Expo SDK 54
- Bundle ID: `com.shijimiworks.dartssupportapp`
- App version: `0.1.0`
- Apple Developer Programは未加入のため、現時点では本番ビルド実行やAppleログインは行いません。

## EAS CLI準備

グローバルインストールせずに使う場合:

```bash
npx eas-cli --version
```

グローバルに入れる場合:

```bash
npm install -g eas-cli
```

## 初回セットアップ

```bash
npx eas-cli login
npx eas-cli init
npx eas-cli build:configure
```

`eas init` 実行後、Expo側でprojectIdが発行されると `app.json` の `extra.eas.projectId` に追記される場合があります。現時点では架空のprojectIdは入れていません。

Appleログインや証明書設定の確認前に、Codex側でEAS Build本番実行は行いません。

## Preview Build

TestFlight前の内部確認用です。

```bash
npx eas-cli build --platform ios --profile preview
```

npm scriptsを使う場合:

```bash
npm run eas:build:preview
```

Apple Developer Program未加入の場合、iOSデバイス配布や証明書作成の段階で止まる可能性があります。

## Production Build

App Store Connect / TestFlight提出用です。

```bash
npx eas-cli build --platform ios --profile production
```

npm scriptsを使う場合:

```bash
npm run eas:build:production
```

`production` profileは `autoIncrement: true` を有効にしています。EAS Build実行時にiOS buildNumberが更新される可能性があります。

## Submit

```bash
npm run eas:submit:ios
```

App Store Connect API Key、Apple IDログイン、またはApple Developer Programの権限が必要です。

## 注意点

- Apple Team ID、App Store ConnectのID、EAS projectIdは実行後に確定するため、現時点では設定していません。
- `development` profileはdevelopment client向けです。Expo Goとは別物です。
- `preview` profileは内部配布確認用です。
- `production` profileはTestFlight提出を想定しています。
- DARTSLIVE / PHOENIX の公式ロゴ、公式画像、公式APIは使用していません。
