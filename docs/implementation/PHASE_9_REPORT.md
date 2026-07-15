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

Not implemented in this phase:

- DartsSupportApp communication
- Cloud sync / API communication
- Sound effects
- Award videos
- Camera or realtime scoring
- Dedicated Rating history route

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

## UI

`/account/rating-status`, Home, and Game Hub now display updated Rating Profile values after pending processing:

- DartsApp Rating
- Confidence
- Measurement status
- Eligible MATCH count
- Standalone 01 / CRICKET counts
- 01 Index
- Cricket Index
- Match Index
- Last evaluated datetime

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

Final test suite result during implementation:

- `npm.cmd test`: 252 passed
