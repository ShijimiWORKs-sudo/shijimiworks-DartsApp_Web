# DartsApp Web Repository Bootstrap

このリポジトリは、既存のDartsSupportApp MVPを基礎にDartsAppのゲーム機能を実装するための新しい作業先です。

現時点では、実装開始前の仕様書・Codex指示書・ローカル準備スクリプトを収録しています。

## 重要ファイル

- `docs/codex/CODEX_MASTER_INSTRUCTION_v1.0.md`
- `docs/specs/DartsApp_詳細設計書_v1.0.md`
- `docs/specs/DartsApp_DB設計書_v1.0.md`
- `docs/specs/DartsApp_DB_v1_schema.sql`
- `docs/specs/DartsApp_画面遷移設計書_v1.0.md`
- `docs/specs/DartsApp_Rating計算モジュール仕様書_v1.0.md`
- `scripts/setup-local-workspace.ps1`

## ローカル作業先

承認済みのローカル作業フォルダ:

```text
C:\制作データ\10_App\DartsApp
```

PowerShell準備スクリプト:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\setup-local-workspace.ps1
```

Codexへは`docs/codex/CODEX_MASTER_INSTRUCTION_v1.0.md`を渡してください。
