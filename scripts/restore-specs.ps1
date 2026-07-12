param(
  [string]$RepositoryRoot = (Split-Path $PSScriptRoot -Parent)
)

$ErrorActionPreference = 'Stop'
$specDir = Join-Path $RepositoryRoot 'docs\specs'
$expected = @(
  'DartsApp_詳細設計書_v1.0.md',
  'DartsApp_DB設計書_v1.0.md',
  'DartsApp_DB_v1_schema.sql',
  'DartsApp_画面遷移設計書_v1.0.md',
  'DartsApp_Rating計算モジュール仕様書_v1.0.md'
)

$missing = @()
foreach ($name in $expected) {
  $path = Join-Path $specDir $name
  if (-not (Test-Path $path)) {
    $missing += $name
  }
}

if ($missing.Count -gt 0) {
  $list = $missing -join "`n- "
  throw @"
仕様書が不足しています。
DartsApp_Codex_Implementation_Package_v1.0.zip の中身を
C:\制作データ\10_App\DartsApp へ展開してから再実行してください。

不足ファイル:
- $list
"@
}

Write-Host "仕様書を確認しました: $specDir"
Get-ChildItem $specDir | Select-Object Name, Length
