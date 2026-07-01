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

## Current Focus: Wallet Recovery Race Patch

### Goal

Prevent a successful wallet-approved manager transaction from being shown as an app error when indexed recovery data arrives slightly after the first recovery check.

### Problem

The transaction can succeed onchain, but the wallet callback may return a generic no-digest error while the first recovery check has already resolved empty. The UI then keeps the generic error instead of making one fresh recovery attempt against updated manager state.

### Proposed Solution

For non-rejection wallet failures without a digest, run a fresh submitted-transaction recovery attempt before surfacing the failure. Keep the existing timeout and proof rules, and never invent or backfill a digest unless authoritative recovery proves it.

### Files To Change

- `src/features/trade/actions/usePredictTradeExecutionFlow.ts`
- `src/tests/unit/trade-execution-security.test.tsx`
- `src/tests/unit/manager-execution-flow.test.tsx`

### Step By Step Tasks

1. Add a fresh post-failure recovery attempt for generic no-digest wallet errors.
2. Reuse the same recovery path when recovery returns empty before the wallet callback fails.
3. Keep user-rejection behavior unchanged.
4. Update focused unit tests for late recovery, empty recovery, rejection, and manager deposit proof recording.
5. Run targeted tests plus lint, typecheck, build, diff check, and secret scan.

### Acceptance Criteria

- A generic no-digest wallet error can still resolve to success when fresh authoritative recovery finds the submitted digest.
- A user-rejected transaction remains a rejected failure and does not recover as success.
- Recovered digests continue through the existing success path for history and Proof Center state.
- The patch does not change PTB builders, wallet signing, config, protocol logic, or endpoints.

### Testing Plan

- `pnpm exec vitest run src/tests/unit/trade-execution-security.test.tsx src/tests/unit/manager-execution-flow.test.tsx src/tests/unit/proof-mode-page.test.tsx`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`
- `git diff --check`
- Targeted secret/auth scan over the final diff.

### Open Questions

- None. The previous transaction succeeded onchain; this patch improves future wallet-result recovery and demo clarity.
