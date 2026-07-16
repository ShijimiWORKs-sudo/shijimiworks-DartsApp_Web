# Phase 9 Report: Rating Engine and Snapshot Updates

## Scope

Phase 9 implements the DartsApp Rating calculation body and Snapshot/Profile updates.

Implemented:

- Pure TypeScript Rating Engine v2
- Rating public types: Observation, `RatingUpdateInput`, `RatingUpdateOutput`
- PPD/MPR anchor interpolation
- Eligible MATCH window, source weights, stability adjustment, continuity bonus
- Initial Rating establishment by exactly 3 Eligible MATCH evaluations
- Standalone 01 update after establishment
- Standalone STANDARD CRICKET update after establishment
- Snapshot insert and Rating Profile update in one transaction
- `rating_recalculate` Outbox completion after successful apply/exclusion
- Account-level pending processing mutex
- Pending processing on DB startup, Home focus, Game Hub focus, and Rating status focus
- PC Home Rating card Confidence display
- `/account/rating` Rating detail route
- `/account/rating/history` Rating Snapshot history route
- 01 / STANDARD CRICKET / MATCH result screen Rating result display based on Evaluation and Snapshot
- COUNT-UP result screen Rating対象外 display
- Source revision recalculation with Evaluation invalidation, Snapshot invalidation, chronological replay, and Profile restoration
- Shared active Account resolution for Home, Account profile, Rating status, Rating detail, and Rating history
- Direct `/account/rating` and `/account/rating/history` access restores a registered local Account before showing unregistered copy
- MATCH 01 PPD and 3DA are stored and displayed as separate values
- MATCH Rating observations use weighted effective score / Rating darts across all 01 games
- Out-of-range Rating observations are excluded with `INVALID_PPD_RANGE` or `INVALID_MPR_RANGE`
- Natural MATCH 01 CHECKOUT games count the final checkout darts and do not duplicate turn scores through dart joins
- Development-only MATCH Rating diagnostics at `/dev/match-diagnostics/[matchId]` read the active SQLite database and expose raw rows, canonical stats, mismatches, JSON copy, and an explicit repair button

Not implemented in this phase:

- DartsSupportApp communication
- Cloud sync / API communication
- Sound effects
- Award videos
- Camera or realtime scoring

## Rating Specification

- `calculation_version = 2`
- Rating range: 1.0 to 18.0
- `rating_tenths` stores display rating x10
- `precise_rating_milli` stores precise rating x1000
- Calculation datetime is injected through `RatingApplicationService`
- The pure engine does not call `new Date()`

Initial Rating:

- Only Eligible MATCH evaluations count toward the first 3 observations
- Standalone games do not count toward initial establishment
- Standalone games completed before `established_at` are not used retroactively

After establishment:

- Standalone 01 updates only 01 Index
- Standalone CRICKET updates only Cricket Index
- Standalone games never update Match Index
- Single standalone update total Rating delta is capped to +/-0.2
- GUEST receives no Rating Profile, Evaluation, or Snapshot

## Persistence

No migration was added.

- Final migration sequence: 001, 002, 003
- `PRAGMA user_version = 3`
- `rating_evaluations` remains the source queue
- `rating_snapshots` stores applied Rating history rows
- `rating_profiles` mirrors the latest valid Snapshot

Transactional apply order:

1. Re-read Evaluation
2. Verify owner, candidate flag, status, latest revision
3. Load Observations
4. Run pure Rating Engine
5. Mark eligible or excluded
6. Save exclusions when needed
7. Insert Snapshot
8. Update Profile
9. Complete `rating_recalculate` Outbox

Source revision recalculation:

1. Select the latest Evaluation revision for the same source
2. Invalidate older Evaluation revisions
3. Invalidate valid Snapshots from the source timestamp onward
4. Restore Rating Profile from the previous valid Snapshot, or clear it to unmeasured before replay
5. Replay latest Evaluation revisions chronologically
6. Keep invalidated Snapshot rows as history while freeing the Evaluation unique key for replayed Snapshots
7. Align Rating Profile with the final replayed Snapshot

MATCH observation repair:

- Completed MATCH result loading can re-sync game and match result stats from raw turn/dart rows
- Legacy detection compares raw canonical turn/dart aggregation against `game_player_results`, `match_player_results`, latest `rating_evaluations`, and `rating_evaluation_games`
- Stored `extra_stats_json.schemaVersion` alone is not trusted when deciding whether MATCH 01 PPD is current
- Canonical completed-turn dart counts use `max(turns.dart_count, active dart rows)` so legacy rows with a missing final checkout dart can still restore Rating darts and MATCH total darts
- MATCH turn aggregation resolves status meaning before Rating stats: 01 `game_end` with `is_checkout = 1`, `end_remaining_score = 0`, or `completion_reason = checkout` is treated as checkout, while CRICKET `game_end` remains a counted normal MPR turn
- When `turns.dart_count` is used because it exceeds active dart rows, `extra_stats_json` stores `legacyDartCountFallbackUsed` and per-turn fallback details for audit/debugging
- If the stored Rating Evaluation no longer matches the canonical MATCH observation, a new `source_revision` is created
- The new revision is passed to Rating recalculation so old Evaluations/Snapshots are invalidated and Profile is rebuilt from the latest valid Snapshot
- Re-running the repair after canonical rows and latest Evaluation are aligned is idempotent and does not create another revision
- Existing Account and user data are not deleted

MATCH diagnostic / repair screen:

- `/dev/match-diagnostics/[matchId]` is not linked from production user navigation
- The screen reads the same SQLite connection used by the running app, including Web SQLite in the browser
- It displays MATCH rows, GAME rows, OWNER TURN rows, all DART rows, saved result rows, all Rating Evaluation revisions, Evaluation Games, Snapshots, and Rating Profile rows
- It computes canonical OWNER totals from raw TURN/DART rows and lists mismatches against saved `game_player_results`, `match_player_results`, `rating_evaluations`, `rating_evaluation_games`, Snapshot, and Profile state
- The diagnostic JSON copy excludes Account email/profile personal fields by not dumping Account rows
- The explicit repair button runs MATCH stats repair first, then Rating recalculation, reloads diagnostics, and treats remaining mismatches as failure
- `ensureRatingEvaluationCurrent` returns before/after summaries and logs `[MATCH repair before]` and `[MATCH repair after]` for browser console inspection

## UI

`/account/rating-status`, `/account/rating`, `/account/rating/history`, Home, and Game Hub now display updated Rating Profile values after pending processing:

- DartsApp Rating
- Confidence
- Measurement status
- Eligible MATCH count
- Standalone 01 / CRICKET counts
- 01 Index
- Cricket Index
- Match Index
- Last evaluated datetime

Game result screens now display Rating result status by source Evaluation:

- 01 result: applied / excluded / processing / not_target
- STANDARD CRICKET result: applied / excluded / processing / not_target
- MATCH result: applied / excluded / processing / not_target
- COUNT-UP result: always Rating対象外
- MATCH result stats display `01 PPD`, `01 3DA`, and `CR MPR` with labels matching the stored values

Active Account resolution:

- Waits for AppState loading and Game DB initialization before resolving Account
- Uses the same `resolveAccountBootstrap` path from Home, Account profile, Rating status, Rating detail, and Rating history
- Repairs `activeAccountId = null` by restoring the registered OWNER Account
- Repairs a stale `activeAccountId` by falling back to a registered OWNER Account
- Does not auto-select disabled or deleted Accounts for Rating ownership
- Shows unregistered copy only after Account resolution confirms that no registered Account exists

## Tests

Added coverage:

- PPD/MPR anchor lower bound, upper bound, exact match, interpolation
- Initial 3 MATCH establishment
- Initial standalone exclusion
- Standalone 01 updates only 01 Index
- Standalone total delta cap
- CRICKET zero-point natural clear exclusion
- pending MATCH evaluations apply to Snapshot/Profile
- `rating_recalculate` Outbox completes
- standalone 01 keeps Cricket/Match Index unchanged
- GUEST/owner mismatch excludes without Snapshot
- HOME Rating card Confidence and updated local Rating text
- Rating detail and history route presence
- Result screens use source Rating results
- Snapshot history lists latest valid rows
- Source result lookup returns applied and not_target
- Source revision recalculation invalidates older revisions and Snapshots
- Recalculation replays latest Evaluations and keeps Profile aligned with the final Snapshot
- Candidate-disabled latest revision is excluded and remaining sources are replayed
- Account bootstrap repairs null/stale `activeAccountId`
- Disabled Account is not auto-selected for Rating ownership
- Rating detail/history routes use shared active Account resolution
- Rating detail keeps the history button enabled for registered unmeasured Accounts
- Rating history distinguishes loading, no Account, and 0 Snapshot states
- MATCH PPD = effective score / Rating darts
- MATCH 3DA = PPD * 3
- MATCH 01 PPD is weighted across multiple 01 games by total effective score and total Rating darts
- BUST turns count zero effective score and actual darts
- 1-2 dart manual turn endings count as 3 Rating darts
- CHECKOUT turns count actual checkout darts
- Voided darts are not counted
- PPD > 60 and MPR > 9 are excluded before Snapshot/Profile updates
- MATCH result screen shows PPD and 3DA separately
- MATCH source revision repair creates a new revision when stored PPD is stale
- Natural 501 CHECKOUT in 9 darts stores `zero_one_ppd_milli = 55667` and `three_dart_average_milli = 167000`
- Rating Index conversion clamps above-anchor PPD to Index 18 without clamping the raw stored PPD
- Legacy MATCH repair rebuilds stale 60.00 PPD / 180.00 3DA summaries from raw 501-in-9 checkout turns, creates a new source revision, invalidates the old Snapshot, rebuilds Profile, and is idempotent on the second run
- Legacy MATCH repair covers `turns.dart_count = 3` with only 2 active DART rows, restoring 501-in-9 PPD to `55667`, 3DA to `167000`, and MATCH total darts to 18 in the service-level fixture
- Legacy MATCH repair covers a final 01 CHECKOUT TURN stored as `game_end`, ensuring the final 141-point turn is included in effective score and Rating darts
- MATCH result repair failures stay on the result screen with a generic retry message while logging the original error with `console.warn`
- MATCH diagnostics route exists, shows OWNER TURN rows, DART rows, saved Rating rows, JSON copy, explicit repair, before/after summaries, and source revision idempotency

Final test suite result during implementation:

- `npm.cmd test`: 270 passed
