# Phase 6: Two-Player MATCH Vertical Slice

## Scope

Phase 6 adds the local SQLite vertical slice for a two-player MATCH.

- GAME 1: 501 or 701 zero-one
- GAME 2: STANDARD CRICKET
- GAME 3: CHOICE only when the MATCH is 1-1
- CHOICE zero-one uses the same start score as GAME 1
- First player to 2 wins becomes the MATCH winner

No migration 004 was added. The database remains at `PRAGMA user_version = 3`.

## Implemented

- MATCH domain types and pure scoring/state helpers
- `MatchGameService` for start, load, dart input, undo/redo, turn confirmation, manual winner, pause, resume, abort, next game, CHOICE, and completion
- MATCH screens:
  - `/game/match/settings`
  - `/game/match/[matchId]`
  - `/game/match/[matchId]/choice`
  - `/game/match/[matchId]/result`
- Game Hub MATCH start, active resume, recent result display
- MATCH button variant with fixed purple background `#7C3AED` and white text
- Common Account contract MATCH mapper and `match_completed` local-only outbox boundary
- OWNER-only pending Rating Evaluation v2 candidate for completed MATCH
- `rating_evaluation_games` rows for completed MATCH games
- `rating_recalculate` outbox event

## Important Rules

- GAME 2 first thrower is the player who did not throw first in GAME 1.
- GAME 3 is never created automatically; it is created only after CHOICE.
- MATCH is completed only after a player reaches 2 wins.
- 2-player CRICKET does not naturally complete when all targets are closed at 0 points.
- CRICKET round limit winner is decided by score, closed target count, then marks total.
- Exact 15R ties require manual winner selection.
- Undo marks dart rows as `voided`; dart rows and domain events are not physically deleted.
- Redo candidates are retained only in the current screen session memory.

## Out of Scope

- Rating calculation body
- Rating Snapshot update
- DartsSupportApp communication
- Supabase, API communication, Apple Login, Google Login
- Sound effects and award videos
- MATCH cloud sync

## Tests

Added focused coverage for:

- MATCH phase and game sequencing
- 2-0, 1-1 CHOICE, and 2-1 completion derivation
- GAME 3 zero-one reusing GAME 1 start score
- Two-player zero-one round limit and manual tie
- Two-player CRICKET over-mark scoring
- CRICKET 0-point all-closed no natural win
- CRICKET 15R score/close/marks/manual comparison
- MATCH service start, active uniqueness, pause/resume/abort
- OWNER-only Rating Evaluation candidate
- CommonOutbox `local_only`
- Undo/redo preserving voided dart rows

Latest full local test run: 182 tests passed.
