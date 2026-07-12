param(
  [string]$Workspace = 'C:\制作データ\10_App\DartsApp',
  [string]$Repository = 'https://github.com/ShijimiWORKS-sudo/shijimiworks-DartsApp_Web.git'
)

$ErrorActionPreference = 'Stop'
$parent = Split-Path $Workspace -Parent
New-Item -ItemType Directory -Force -Path $parent | Out-Null

if (Test-Path (Join-Path $Workspace '.git')) {
  Write-Host "既存Git作業フォルダを使用します: $Workspace"
  Set-Location $Workspace
  git status
  git remote -v
  exit $LASTEXITCODE
}

if (Test-Path $Workspace) {
  $items = Get-ChildItem -Force $Workspace
  if ($items.Count -gt 0) {
    throw "作業先が空ではありません。既存ファイルを保護するため停止しました: $Workspace"
  }
} else {
  New-Item -ItemType Directory -Force -Path $Workspace | Out-Null
  Remove-Item $Workspace
}

git clone $Repository $Workspace
Set-Location $Workspace
git status
git remote -v
Write-Host "準備完了: $Workspace"
