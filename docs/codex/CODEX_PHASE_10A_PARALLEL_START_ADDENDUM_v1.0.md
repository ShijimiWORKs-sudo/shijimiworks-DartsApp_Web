# Phase 10A 並列開始追補指示

この文書は`CODEX_PHASE_10A_CAMERA_FOUNDATION_v1.0.md`の「作業開始」より優先します。

Phase 9の作業フォルダ・ブランチ・Web SQLiteを保持したまま、Phase 10Aを別worktreeで実施してください。

## 既存Phase 9

```text
作業フォルダ:
C:\制作データ\10_App\DartsApp

ブランチ:
codex/phase-9-rating-engine

Web port:
8104
```

既存フォルダではbranch switch、stash、resetを行わないでください。

## Phase 10A worktree

```text
作業フォルダ:
C:\制作データ\10_App\DartsApp-Phase10A

ブランチ:
codex/phase-10a-camera-foundation

Web port:
8110
```

## 作成手順

最初に既存Phase 9側で状態確認だけ行います。

```powershell
cd "C:\制作データ\10_App\DartsApp"
git status --short
git branch --show-current
git fetch origin
```

`git branch --show-current`が`codex/phase-9-rating-engine`であることを確認してください。

Phase 10A worktreeが未作成の場合:

```powershell
git worktree add "C:\制作データ\10_App\DartsApp-Phase10A" codex/phase-10a-camera-foundation
```

worktreeが既に存在する場合:

```powershell
git worktree list
cd "C:\制作データ\10_App\DartsApp-Phase10A"
git branch --show-current
git pull --ff-only origin codex/phase-10a-camera-foundation
```

Phase 10Aの全作業・install・test・commit・pushは、必ず次で行ってください。

```powershell
cd "C:\制作データ\10_App\DartsApp-Phase10A"
```

禁止:

- Phase 9フォルダで`git switch codex/phase-10a-camera-foundation`
- Phase 9フォルダの未追跡資料変更
- Phase 9の8104停止を前提とする作業
- 2つのworktreeで同一branchをcheckout
- worktree間のnode_modulesコピー

## server

Phase 9:

```text
http://localhost:8104
```

Phase 10A:

```powershell
npm.cmd run web -- --port 8110 --clear
```

```text
http://localhost:8110
```

Expo GoのLAN port 8099は同時利用できないため、Expo Go実機確認だけはPhase 9サーバーを停止する時間帯に実施するか、Phase 10Aで別portを明示してください。

## 完了後

Phase 10Aは`codex/phase-10a-camera-foundation`へpushし、mainへのDraft PRを作成してください。

Phase 9をmainへマージするまでPhase 10Aはmainへマージしないでください。
