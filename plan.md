# PredictPilot Plan

## Goal

Build PredictPilot as a demo-ready DeepBook Predict intelligence and execution terminal on Sui Testnet.

## Guiding Docs

Build according to `docs/CODEX_BUILD_TASKS.md`, `docs/MVP_SCOPE.md`, `docs/TECHNICAL_ARCHITECTURE.md`, `docs/DEEPBOOK_PREDICT_INTEGRATION_GUIDE.md`, `docs/PTB_COOKBOOK.md`, `docs/TESTING_STRATEGY.md`, and `docs/SECURITY_CHECKLIST.md`.

## First Build Phases

1. Phase 0: repo verification
2. Phase 1: app foundation
3. Phase 2: environment and config
4. Phase 3: types and schemas
5. Phase 4: Sui client and wallet integration
6. Phase 5: DeepBook Predict reads
7. Phase 6: PTB builders
8. Phase 7: preview and risk flows
9. Phase 8: UI screens
10. Phase 9: real execution flows
11. Phase 10: testing and demo polish

## Notes

Do not scaffold the app, install dependencies, implement product features, or build DeepBook Predict integration until the relevant phase is approved.

## Current Focus: Proof Center Refresh Feedback Patch

### Goal

Make `Refresh proof` visibly reload Proof Center evidence without implying that it can create or recover a missing digest.

### Problem

The current refresh action silently refetches evidence and no-proof summaries can show the epoch timestamp `1970-01-01T00:00:00.000Z`, which is confusing during demos.

### Proposed Solution

Track async refresh state in Proof Center, refetch manager summary, positions, and transaction history, report success or failure, and make no-proof summaries say `Generated at [L]: Not generated yet`.

### Files To Change

- `src/features/proof/ProofModePage.tsx`
- `src/features/proof/proof-summary.ts`
- `src/features/history/hooks/useTransactionHistory.ts`
- `src/tests/unit/proof-mode-page.test.tsx`
- `src/tests/unit/proof-summary.test.ts`
- `src/tests/unit/pnl-history-query-hooks.test.tsx`

### Step By Step Tasks

1. Add refresh state and user-facing success/error copy in Proof Center.
2. Make transaction history `refetch()` reject when any underlying history source fails.
3. Remove the epoch fallback from no-proof summary generation.
4. Update focused unit tests for refresh, digest, timestamp, and history failure behavior.
5. Run targeted tests plus format, lint, typecheck, build, audit, diff check, and secret scan.

### Acceptance Criteria

- `Refresh proof` shows `Refreshing proof...` while running.
- Successful refresh shows a last refreshed time and says evidence was reloaded.
- Failed refresh shows an accessible alert naming failed proof sources.
- No submitted digest still renders as `No submitted digest`.
- Refresh copy clearly states it cannot create a missing digest.
- No-proof summaries do not contain `1970`.

### Testing Plan

- `pnpm exec vitest run src/tests/unit/proof-summary.test.ts src/tests/unit/proof-mode-page.test.tsx src/tests/unit/pnl-history-query-hooks.test.tsx`
- `pnpm format:check`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`
- `pnpm audit --prod`
- `git diff --check`
- Targeted secret/auth scan over the final diff.

### Open Questions

- None. This fix does not add endpoints, wallet signing, PTB changes, or fake digest recovery.
