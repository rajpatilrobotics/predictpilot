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

## Current Focus: Proof/History Demo Completion Patch

### Goal

Make the live demo proof path truthful and complete for manager funding by showing chain-confirmed manager funding submissions in History and marking Proof Center verified when the manager summary refresh confirms the same manager.

### Problem

Manager deposit/withdraw transactions do not have a dedicated Predict Server history endpoint. The app currently waits for a matching indexed history row, so a successful manager deposit can remain `Pending Index` even after the digest is real and the manager balance refreshes.

### Proposed Solution

Keep indexed protocol history separate, but add a current-session manager funding lane backed by real chain digests from Proof Session. Proof Center should verify manager funding through chain confirmation plus refreshed manager summary, while trade and LP actions still require matching indexed history rows.

### Files To Change

- `src/features/proof/**`
- `src/features/history/**`
- `src/features/trade/payoff-visualizer.ts`
- `src/features/oracle/**`
- `src/features/markets/**`
- Focused tests under `src/tests/unit/**`

### Step By Step Tasks

1. Extend Proof Session to retain current-session submitted proofs.
2. Render manager funding submissions in History using chain digest plus local session context.
3. Update Proof Center verification rules for manager funding actions.
4. Replace judge-facing `TODO VERIFY` wording with clear unavailable-data copy.
5. Keep wallet signing, PTB builders, config, protocol integrations, and endpoints unchanged.
6. Add focused regression tests for proof session, History, Proof Center, and wording.
7. Run targeted tests plus lint, typecheck, build, diff check, and secret scan.

### Acceptance Criteria

- History shows the latest current-session manager funding digest without labeling it as an indexed server row.
- Proof Center marks manager funding verified when chain confirmation succeeds and manager summary for that manager is loaded.
- Trade and LP proof still require matching indexed history where those endpoints exist.
- No fake digest, fake server history, storage persistence, wallet signing rewrite, PTB edit, config edit, or new endpoint is introduced.
- Judge-facing proof/risk/oracle copy does not show raw `TODO VERIFY` labels.

### Testing Plan

- `pnpm exec vitest run src/tests/unit/proof-session-provider.test.tsx src/tests/unit/portfolio-history-pages.test.tsx src/tests/unit/proof-selectors.test.ts src/tests/unit/proof-mode-page.test.tsx src/tests/unit/tx-preview-ui.test.tsx src/tests/unit/oracle-pages.test.tsx src/tests/unit/market-intelligence-page.test.tsx`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`
- `git diff --check`
- Targeted secret/auth scan over the final diff.

### Open Questions

- None. Manager funding verification should be truthful demo proof, not new indexer work.
