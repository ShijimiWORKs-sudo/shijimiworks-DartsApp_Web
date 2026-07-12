param(
  [string]$RepositoryRoot = (Split-Path $PSScriptRoot -Parent)
)

$ErrorActionPreference = 'Stop'
$bundleDir = Join-Path $RepositoryRoot 'docs\specs-bundle'
$specDir = Join-Path $RepositoryRoot 'docs\specs'
$parts = Get-ChildItem -Path $bundleDir -Filter 'specs.zip.b64.part*' | Sort-Object Name

if ($parts.Count -eq 0) {
  throw "仕様書bundleが見つかりません: $bundleDir"
}

$base64 = ($parts | ForEach-Object { Get-Content -Raw -Encoding ASCII $_.FullName }) -join ''
$zipPath = Join-Path $env:TEMP 'DartsApp_specs.zip'
[IO.File]::WriteAllBytes($zipPath, [Convert]::FromBase64String($base64))

New-Item -ItemType Directory -Force -Path $specDir | Out-Null
Expand-Archive -Path $zipPath -DestinationPath $specDir -Force
Remove-Item $zipPath -Force

$expected = @(
  'DartsApp_詳細設計書_v1.0.md',
  'DartsApp_DB設計書_v1.0.md',
  'DartsApp_DB_v1_schema.sql',
  'DartsApp_画面遷移設計書_v1.0.md',
  'DartsApp_Rating計算モジュール仕様書_v1.0.md'
)

foreach ($name in $expected) {
  $path = Join-Path $specDir $name
  if (-not (Test-Path $path)) {
    throw "仕様書の展開に失敗しました: $path"
  }
}

Write-Host "仕様書を展開しました: $specDir"
Get-ChildItem $specDir | Select-Object Name, Length
