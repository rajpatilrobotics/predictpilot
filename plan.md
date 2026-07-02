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

## Current Focus: Manager Summary Loading Patch

### Goal

Make the live Manager page demo-safe by showing already-loaded manager account data instead of leaving stale loading copy on screen.

### Problem

The Predict server can return the manager summary and positions, but `/manager` may still show “Loading manager account data” and “Not loaded” style UI when a query flag remains loading or refetching around already-present data. This makes a real successful manager deposit look confusing during demo smoke testing.

### Proposed Solution

Use data-first render logic on the Manager page. Only show the account loading panel when summary or positions data is genuinely missing and still loading. Keep loaded balances usable for deposit and withdraw panels even if a query is refreshing in the background.

### Files To Change

- `src/features/manager/PredictManagerPage.tsx`
- `src/features/manager/hooks/usePredictManager.ts`
- `src/features/manager/lib/manager-select.ts`
- `src/lib/bigint-json.ts`
- `src/main.tsx`
- `src/tests/unit/bigint-json.test.ts`
- `src/tests/unit/predict-manager-page.test.tsx`
- `src/tests/unit/predict-manager-hook.test.tsx`
- `src/tests/unit/market-intelligence-page.test.tsx`
- `src/tests/unit/trade-test-helpers.ts`

### Step By Step Tasks

1. Inspect Manager page summary and positions query rendering.
2. Change loading checks so data present means the summary UI is considered loaded.
3. Keep indexed manager discovery render-safe by storing only `managerId` and `owner` in the hook state.
4. Install explicit BigInt JSON serialization for React dev tooling and browser diagnostics.
5. Keep wallet signing, PTB builders, config, and protocol integrations unchanged.
6. Add regression tests for data-present plus loading-flag state, discovery shape, and BigInt JSON serialization.
7. Run targeted tests plus lint, typecheck, build, diff check, and secret scan.

### Acceptance Criteria

- `/manager` shows loaded manager DUSDC and account value when summary data exists.
- The loading panel appears only while required account data is absent and still loading.
- Funding action panels do not remain blocked by stale loading flags when their balance data exists.
- Manager discovery does not put BigInt indexed-event fields into the live route state.
- React dev/browser tooling can stringify BigInt-backed query data without blocking Manager page updates.
- The patch does not change wallet signing, PTB builders, config, protocol logic, or endpoints.

### Testing Plan

- `pnpm exec vitest run src/tests/unit/predict-manager-page.test.tsx src/tests/unit/predict-manager-hook.test.tsx src/tests/unit/manager-select.test.ts src/tests/unit/bigint-json.test.ts`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`
- `git diff --check`
- Targeted secret/auth scan over the final diff.

### Open Questions

- None. Live chain/API checks already confirm the previous manager deposit succeeded; this patch fixes Manager page clarity for the next smoke test.
