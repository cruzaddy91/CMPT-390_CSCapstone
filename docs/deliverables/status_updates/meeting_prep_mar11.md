# Meeting Prep - Mar 11

## Since last sprint (late Feb -> now)

- Finished MVP core loop end to end: coach creates and assigns programs, athlete logs workouts and PRs, history persists via API.
- Added program completion tracking and Sinclair analytics endpoint integration.
- Added local self-host path for demos and setup reliability.
- Completed UI facelift and architecture/topology presentation materials.

## Tough bugs we had to squash

- API base URL mismatch early on during frontend and backend integration.
- JWT header attachment issues on protected requests.
- CORS origin mismatch during local integration.
- Payload mismatch between coach form and backend serializer contract.
- DisallowedHost in smoke tests.
- Local host script dependency/env startup issues.

## Learning points and pivots

- Biggest pivot: moved from localStorage-first flows to API-first persistence.
  - LocalStorage looked fast at first but broke continuity across sessions and devices.
  - API persistence gave us one source of truth and cleaner coach-athlete data sync.
  - This changed our frontend from mock state handling to real backend contracts.
- Added stricter payload and permission checks earlier in the cycle to reduce regressions.
  - Small payload mismatches caused repeated failures, so we validated fields earlier.
  - Role checks were tightened to avoid coach-athlete access leaks.
  - This reduced rework when we expanded endpoint coverage.
- Started treating smoke tests and deployment checks as sprint gates, not end-of-sprint cleanup.
  - We now run core flow checks before calling a sprint task done.
  - Host and deploy checks catch config issues sooner.
  - This made sprint progress more stable and reduced last-minute surprises.

## Where we are now

- Functionally in beta-readiness mode with core flows stable.
- Current work is polish, reliability, and clear demo communication.

## Immediate next steps

- Run the full demo path daily: login -> coach assign -> athlete log -> PR -> Sinclair.
- Close remaining blockers fast and keep known-issues list current.
- Finalize deployment confidence and prep for user-facing demo feedback.

