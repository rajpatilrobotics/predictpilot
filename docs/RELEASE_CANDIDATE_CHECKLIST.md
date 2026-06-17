# PredictPilot Release Candidate Checklist

## Release Candidate Metadata

- Gate: PP-060 final release candidate gate
- Gate date: 2026-06-17
- Evaluated branch: `main`
- Evaluated application commit: `9bd42639a5be7bd5fe7ebc457a15843def47374e`
- Node version used locally: `v26.0.0`
- pnpm version used locally: `10.34.3`
- Package manager pin: `pnpm@10.34.3`
- Network posture: Sui Testnet only
- Product posture: real execution flows are implemented, but final public proof is not yet captured
- Final RC decision: `BLOCKED`

## Automated Gate Results

All automated local checks passed for this gate.

| Gate | Command | Result | Notes |
| --- | --- | --- | --- |
| Git status preflight | `git status --short --branch` | PASS | `main...origin/main` was clean before PP-060 documentation work. |
| Commit metadata | `git rev-parse HEAD` | PASS | Evaluated application commit: `9bd42639a5be7bd5fe7ebc457a15843def47374e`. |
| Toolchain metadata | `node --version && pnpm --version` | PASS | Node `v26.0.0`, pnpm `10.34.3`. |
| Dependency install | Not rerun locally | NOT RUN | Existing local dependencies were used. CI still runs `pnpm install --frozen-lockfile`. |
| Lint | `pnpm lint` | PASS | ESLint completed with `--max-warnings=0`. |
| TypeScript | `pnpm typecheck` | PASS | Strict project build completed. |
| Full Vitest suite | `pnpm test` | PASS | 66 test files, 402 tests passed. Node emitted a non-blocking localStorage experimental warning. |
| Unit tests | `pnpm test:unit` | PASS | 55 test files, 355 tests passed. Node emitted a non-blocking localStorage experimental warning. |
| Integration tests | `pnpm test:integration` | PASS | 2 test files, 4 tests passed. |
| PTB tests | `pnpm test:ptb` | PASS | 9 test files, 43 tests passed. |
| Playwright smoke | `pnpm test:e2e` | PASS | 10 browser tests passed. Local test output includes known non-blocking dApp Kit metadata fetch noise. |
| Production build | `pnpm build` | PASS | Vite build completed. Existing large chunk warning remains non-blocking. |
| Diff hygiene | `git diff --check` | PASS | No whitespace errors. |
| Secret/auth scan | local `find` plus text scan | PASS | No secret/auth artifact files found. Text hits were existing documentation warnings and redaction tests, not credentials. |

## Manual Proof Gate

These items block final hackathon submission readiness. Do not mark the project as final-submission ready until these are completed with real public-safe proof.

| Manual gate | Status | Required evidence |
| --- | --- | --- |
| Live deployed app URL | BLOCKED | Add the real public URL to `README.md`, `docs/submission/README.md`, and `docs/submission/final-form-copy.md`. |
| Deployed smoke test | BLOCKED | Run `E2E_BASE_URL=<live-url> pnpm test:e2e` after deployment. |
| Demo video URL | BLOCKED | Add the final video URL to the submission docs. |
| Primary oracle and market | BLOCKED | Select an active Testnet oracle/market and record it in the demo/submission docs. |
| Funded Testnet wallet | BLOCKED | Wallet must have SUI gas and current DeepBook Predict DUSDC. |
| Real binary mint digest | BLOCKED | Capture a real Sui Testnet digest from the app flow and record it in `docs/submission/proof/digests.md`. |
| Explorer proof screenshot | BLOCKED | Store public-safe explorer proof under `docs/submission/screenshots/`. |
| Portfolio/history refresh proof | BLOCKED | Capture the post-transaction refreshed portfolio or history state. |
| Optional LP proof | BLOCKED unless claimed | Required only if the final pitch/video claims a live vault LP action. |
| Official deadline/rules verification | BLOCKED | Re-check DeepSurge, the participant handbook, and final submission requirements on submission day. |

## Required Manual Rehearsal

Run this once a funded wallet and live deployment are available:

1. Open the deployed app URL.
2. Confirm the app visibly uses Sui Testnet.
3. Connect a supported Sui wallet.
4. Confirm the wallet is on Testnet and has SUI gas.
5. Confirm the wallet has current DeepBook Predict DUSDC.
6. Create or discover the wallet's `PredictManager`.
7. Deposit DUSDC into the manager if needed.
8. Select a verified active oracle and binary market.
9. Enter a small mint quantity.
10. Review risk preview and transaction preview.
11. Sign with the wallet.
12. Capture the returned digest in the app.
13. Open the digest in Sui Explorer on Testnet.
14. Confirm portfolio, manager, positions, or history refresh after confirmation.
15. Record the digest in `docs/submission/proof/digests.md`.
16. Save screenshots under `docs/submission/screenshots/`.

## Final Decision

`BLOCKED`

Reason: automated quality gates pass, but final submission readiness still requires a live deployment URL, selected active oracle/market, funded Testnet rehearsal, at least one real transaction digest, explorer proof, and portfolio/history refresh evidence.

This is an honest release-candidate gate. It must not be changed to `PASS` until the missing manual proof is captured from real Testnet execution.
