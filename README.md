# DartsApp Web Repository Bootstrap

このリポジトリは、既存のDartsSupportApp MVPを基礎にDartsAppのゲーム機能を実装するための新しい作業先です。

現時点では、Codex実装指示書とローカル準備スクリプトを登録しています。詳細仕様書一式は、同時に作成した`DartsApp_Codex_Implementation_Package_v1.0.zip`をローカル作業フォルダへ展開して使用します。

## GitHub登録済みファイル

- `docs/codex/CODEX_MASTER_INSTRUCTION_v1.0.md`
- `scripts/setup-local-workspace.ps1`
- `scripts/restore-specs.ps1`

## ローカル作業先

```text
C:\制作データ\10_App\DartsApp
```

## 準備手順

1. このリポジトリを上記フォルダへcloneします。
2. `DartsApp_Codex_Implementation_Package_v1.0.zip`内のファイルを同じフォルダへ展開します。
3. 次を実行して仕様書の存在を確認します。

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\restore-specs.ps1
```

4. Codexへ`docs/codex/CODEX_MASTER_INSTRUCTION_v1.0.md`を渡します。

Codexは既存MVP参照元`ShijimiWORKs-sudo/shijimiworks-dartssuportapp`を読取り用remoteとして取得し、実装先の本リポジトリだけへcommit・pushします。
