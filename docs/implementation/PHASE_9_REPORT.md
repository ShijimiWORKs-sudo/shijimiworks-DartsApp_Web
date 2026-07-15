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
- If the stored Rating Evaluation no longer matches the corrected MATCH observation, a new `source_revision` is created
- The new revision is passed to Rating recalculation so old Evaluations/Snapshots are invalidated and Profile is rebuilt from the latest valid Snapshot
- Existing Account and user data are not deleted

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

Final test suite result during implementation:

- `npm.cmd test`: 268 passed
