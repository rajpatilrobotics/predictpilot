# CODEX_BUILD_TASKS

## Purpose and operating assumptions

This file is the execution backlog for Codex to build PredictPilot as a DeepBook Predict intelligence and execution terminal for the Sui Overflow 2026 DeepBook track. Codex should treat this file as the build order, not as optional notes. The 2026 hackathon site explicitly frames the DeepBook track as a place to build trading or liquidity applications powered by DeepBook, and previous Sui Overflow cycles were highly competitive, with 352 submissions in 2024 and 599 submissions in 2025, plus demo day judging. That means reliability, clear product proof, and real onchain execution matter more than feature sprawl. citeturn2search0turn17view0turn17view1

DeepBook Predict is documented as a Testnet integration surface. The protocol documentation and contract information explicitly say the current package IDs, object layouts, and entry points can change before Mainnet, so Codex must keep all deployment identifiers in config, verify all Move calls against the official docs or the `predict-testnet-4-16` repository branch, and mark anything uncertain as `TODO VERIFY` instead of guessing. citeturn0search7turn9view0turn12view0

PredictPilot must follow the official DeepBook Predict integration model. For rendering, use the public Predict server. For second-level oracle freshness, optionally use Sui checkpoint or event streaming. For confirmation-critical wallet flows, use direct onchain reads around the transaction. Do not build the frontend by decoding raw Move events everywhere. The official docs and repo README recommend this split directly. citeturn8search0turn8search1turn22view0

The currently documented public integration targets on Testnet are the Predict server base URL `https://predict-server.testnet.mystenlabs.com`, the Predict package `0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138`, the Predict object `0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a`, the Predict registry `0x43af14fed5480c20ff77e2263d5f794c35b9fab7e2212903127062f4fe2a6e64`, and the current quote asset `0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC`. These values must live in config only. citeturn9view0turn22view0

DeepBook Predict’s core model is specific and non-negotiable. `Predict` is the shared protocol object. `PredictManager` is the per-user account object and each user should create one and reuse it. `OracleSVI` is the market state per underlying and expiry. Binary positions and ranges are internal quantities stored inside the manager, not separate NFTs or standalone objects. LPs interact through `PLP` shares minted on vault supply and burned on vault withdrawal. PredictPilot must reflect that exact mental model in its data model, UI, and PTB builders. citeturn9view1turn9view2turn9view4turn22view0

Codex should use this file sequentially. Complete one task at a time, run the required checks, update local task status, and only then move to the next dependency-ready task. If a task depends on unverified function signatures, generated bindings, or transport details, Codex must stop the speculative implementation boundary at the adapter layer, add `TODO VERIFY`, and proceed only with verified read surfaces or local UI scaffolding. The docs themselves expose some Predict function names while also showing missing manifest source links, which is exactly why verification is mandatory before hardcoding call targets. citeturn10view0turn10view1turn9view3

## Codex execution rules

Build philosophy:

- Optimize for judge confidence in three to five minutes.
- Prefer real Testnet execution over mock-only UX.
- Prefer a narrow, reliable terminal over a broad, unstable product.
- Prefer typed adapters and verified config over fast but brittle hacks.
- Prefer one excellent demo path over many partially working paths.

Research-before-coding rules:

- Re-read the official DeepBook Predict docs before touching any `predict`, `predict_manager`, `oracle`, or `vault` integration.
- Re-check the `predict-testnet-4-16` repo branch before hardcoding any function target, event name, or object model detail. The repo branch clearly contains `sources`, `simulations`, and helper tests for the Predict package, so use it as the canonical code reference when docs are incomplete. citeturn12view0turn21view0
- Use the Predict server for page rendering surfaces like markets, vault summary, portfolio summary, positions summary, PnL, and history because that is the recommended integration path. The documented endpoints include `/status`, `/predicts/:predict_id/state`, `/predicts/:predict_id/oracles`, `/oracles/:oracle_id/state`, `/predicts/:predict_id/vault/summary`, `/predicts/:predict_id/vault/performance?range=ALL`, `/managers/:manager_id/summary`, `/managers/:manager_id/positions/summary`, `/managers/:manager_id/pnl?range=ALL`, and history endpoints for prices, SVI, trades, mints, redeems, supplies, and withdrawals. citeturn9view0turn22view0

Verification-before-implementation rules:

- `predict::create_manager`, `predict::mint`, `predict::redeem`, `predict::redeem_permissionless`, `predict::mint_range`, `predict::redeem_range`, `predict::supply`, and `predict::withdraw` are verified entry points from the docs and repo README. Use only these verified names unless a newer official source replaces them. citeturn10view1turn22view0
- `predict_manager::deposit` is explicitly referenced in the repo README. Any manager withdrawal function name is not fully spelled out in the README excerpt and should remain `TODO VERIFY` until checked in source or bindings. citeturn10view5turn22view0
- Oracle state and lifecycle must be checked before trade flows. Official docs state mints require a live oracle and that redeems can use live or settled oracle state. The docs also verify `activate()`, `update_prices()`, and `update_svi()` on the oracle side. citeturn9view3
- Treat package IDs and object IDs as config, never as literals scattered through components or hooks. Official docs explicitly say current deployment values are provisional on Testnet. citeturn0search7turn9view0

Anti-hallucination rules:

- Do not invent API endpoints beyond documented Predict server routes.
- Do not invent Move signatures, generic type parameters, event payloads, or object field names.
- Do not invent hackathon rules, judging rules, or submission requirements beyond what official sources state.
- Do not invent the existence of standalone position objects, range NFTs, or a generic bet-slip model. Predict stores quantities inside `PredictManager`. citeturn9view2turn22view0
- Do not assume the server is updated at the same instant as transaction confirmation. The repo README says server lag is low but not zero, so post-tx refresh must combine confirmation with explicit page refetch. citeturn22view0
- Do not assume SVI updates are as frequent as price updates.
- Do not assume an oracle is tradeable only because it exists. Check lifecycle state and freshness first. citeturn9view3turn22view0

Task priority system:

- `MUST`: required for a credible DeepBook track submission and core demo.
- `SHOULD`: important for polish, reliability, and judge trust.
- `COULD`: useful only after all MUST and SHOULD items pass.
- `DO NOT BUILD`: explicitly out of MVP and likely to hurt delivery.

Task dependency system:

- A task can start only when all listed dependencies are complete.
- If a dependency is `TODO VERIFY`, isolate the uncertainty behind an adapter, stub only the minimum boundary, and do not fake a fully working flow.
- UI-only tasks may proceed against typed mock data, but execution flows cannot be marked done until they complete against verified Testnet surfaces.

Definition of done for every task:

- Code exists at the specified paths.
- Lint, typecheck, and tests for that task pass.
- The task’s acceptance criteria are manually verified.
- No unverified protocol constant is hardcoded in feature code.
- Any remaining uncertainty is explicitly marked `TODO VERIFY` in code comments and docs.

## Build phases and repository shape

Default implementation choice: use the official `@mysten/create-dapp` React template as the starting baseline because it gives React, TypeScript, Vite, Tailwind, and dApp Kit preconfigured, which is the fastest verified path for a hackathon build. The current dApp Kit docs also show a Testnet gRPC client setup, `DAppKitProvider`, `ConnectButton`, and wallet hooks for current account, wallet, and network. citeturn18view0turn20view1

Use the current Sui TypeScript SDK package `@mysten/sui`. The SDK docs state it is ESM-only, and recommend a compatible TypeScript module resolution such as `Bundler`, `Node16`, or `NodeNext`. For PTBs, use the `Transaction` builder from `@mysten/sui/transactions`. Official PTB docs state PTBs compose multiple commands in a single transaction, and the builder can automatically derive gas budget via dry run unless overridden. citeturn18view2turn1search0turn13search1

For wallet UX, use the dApp Kit provider and wallet hooks. The current docs show `useDAppKit`, `useCurrentAccount`, `useCurrentWallet`, `useCurrentNetwork`, `useCurrentClient`, and `ConnectButton`, while the Connect Wallet action docs also confirm auto-connect is enabled by default. citeturn18view0turn18view1

For testing, use Vitest for unit and component tests, React Testing Library for DOM-level React component tests, and Playwright for E2E flows. Vitest’s docs confirm `.test.` and `.spec.` naming and a standard `vitest` script. Playwright’s docs confirm multi-browser E2E support, HTML reporting, retries, and a recommended GitHub Actions scaffold. Vitest’s own guidance explicitly describes the standard combination of Vitest for unit and component tests plus Playwright for full critical user paths. React Testing Library recommends tests that resemble how software is used. Zod should be used for runtime validation of untrusted server responses. citeturn19view1turn19view0turn19view2turn18view6turn18view5

If transaction simulation is needed for advanced preview or return-value inspection, use the current SDK transport method that corresponds to `simulateTransaction`, because the SDK migration docs show `devInspectTransactionBlock` moving to `client.core.simulateTransaction(...)`. Treat transport details as `TODO VERIFY` if the final app stack uses a different client surface. citeturn18view3

Recommended folder structure:

```text
docs/
src/
  app/
  components/
  config/
  features/
  hooks/
  integrations/
    deepbook-predict/
    deepbook-predict/tx/
  lib/
  stores/
  tests/
  types/
e2e/
```

Phase ordering:

- Phase 0: Repository foundation
- Phase 1: Environment and configuration
- Phase 2: Types, schemas, and API adapters
- Phase 3: Sui client and wallet integration
- Phase 4: DeepBook Predict read integration
- Phase 5: PTB transaction builders
- Phase 6: Transaction preview and risk preview
- Phase 7: Core screens
- Phase 8: Execution flows
- Phase 9: Portfolio, PnL, history, and PLP
- Phase 10: Testing and QA
- Phase 11: Demo mode and polish
- Phase 12: Deployment and submission
- Phase 13: Judge-verifiable winning layer

## Atomic task backlog

**Phase 0**

- **PP-001 | Bootstrap repo foundation**
  - Priority: MUST
  - Dependency: None
  - Objective: Create the base app scaffold with React, TypeScript, Vite, Tailwind, and dApp Kit compatibility.
  - Files: `package.json`, `pnpm-lock.yaml` or equivalent, `vite.config.ts`, `tsconfig.json`, `src/main.tsx`, `src/app/App.tsx`, `src/app/providers.tsx`
  - Implementation instructions: Start from the verified `create-dapp` stack shape, keep network scope to Testnet only, and add strict TypeScript settings from day one. citeturn18view0turn18view2
  - Acceptance criteria: App boots locally, typecheck passes, root app shell renders.
  - Required tests: `pnpm typecheck`, `pnpm lint`
  - Failure modes to avoid: starting with custom infra, Mainnet defaults, loose `any` typing
  - Definition of done: clean local boot plus committed scaffold with no broken imports

- **PP-002 | Create repository scripts and quality gates**
  - Priority: MUST
  - Dependency: PP-001
  - Objective: Standardize `dev`, `build`, `preview`, `lint`, `typecheck`, `test`, `test:run`, `test:e2e`, and `format` commands.
  - Files: `package.json`, `.editorconfig`, `.gitignore`, `.npmrc`, `README.md`
  - Implementation instructions: Use Vitest naming expectations and Playwright script conventions; add `type: "module"` because the Sui SDK is ESM-only. citeturn18view2turn19view1turn19view0
  - Acceptance criteria: All commands resolve successfully even if some return empty test suites initially.
  - Required tests: run each script once
  - Failure modes to avoid: mixed CJS and ESM config, missing CI scripts
  - Definition of done: one-command setup works for a fresh clone

- **PP-003 | Create folder taxonomy and barrel policy**
  - Priority: MUST
  - Dependency: PP-001
  - Objective: Establish stable directories for app shell, features, integrations, types, config, hooks, stores, tests, and docs.
  - Files: `src/app`, `src/components`, `src/features`, `src/integrations/deepbook-predict`, `src/integrations/deepbook-predict/tx`, `src/lib`, `src/hooks`, `src/stores`, `src/types`, `src/config`, `src/tests`, `e2e`, `docs`
  - Implementation instructions: Keep protocol-specific code under `src/integrations/deepbook-predict`, and keep UI logic in `src/features`.
  - Acceptance criteria: all agreed directories exist and imports resolve.
  - Required tests: lint plus `tsc --noEmit`
  - Failure modes to avoid: scattering protocol logic across components
  - Definition of done: directory tree matches this document

- **PP-004 | Add environment schema and config loader**
  - Priority: MUST
  - Dependency: PP-002
  - Objective: Centralize runtime config and reject invalid env at startup.
  - Files: `src/config/env.ts`, `.env.example`, `src/config/runtime.ts`
  - Implementation instructions: Validate env with Zod; include Testnet fullnode URL, Predict server URL, Predict package ID, Predict object ID, registry ID, explorer base URL, demo mode flag. citeturn18view5turn9view0
  - Acceptance criteria: invalid env crashes early with clear error; valid env loads typed config.
  - Required tests: unit tests for valid and invalid env parsing
  - Failure modes to avoid: silent fallback to stale package IDs
  - Definition of done: no feature imports raw `import.meta.env` directly

- **PP-005 | Add CI skeleton**
  - Priority: MUST
  - Dependency: PP-002
  - Objective: Create a GitHub Actions pipeline for lint, typecheck, unit tests, and Playwright smoke tests.
  - Files: `.github/workflows/ci.yml`
  - Implementation instructions: Keep initial job small and fast, then expand in later tasks. Playwright’s official scaffold recommends GitHub Actions support. citeturn19view0
  - Acceptance criteria: workflow validates on push and PR.
  - Required tests: local workflow lint via dry config check if available
  - Failure modes to avoid: CI depending on secrets for basic verification
  - Definition of done: repo has a non-broken CI workflow committed

**Phase 1**

- **PP-006 | Define core domain types**
  - Priority: MUST
  - Dependency: PP-004
  - Objective: Model Predict, PredictManager, OracleSVI, MarketKey, RangeKey, PLP, vault summary, portfolio summary, PnL, and history records.
  - Files: `src/types/predict.ts`, `src/types/oracle.ts`, `src/types/portfolio.ts`, `src/types/vault.ts`, `src/types/history.ts`
  - Implementation instructions: Reflect the official object model and internal-balance semantics, especially that positions and ranges live inside a manager, not as standalone objects. citeturn9view2turn22view0
  - Acceptance criteria: all shared types compile and are used by adapters
  - Required tests: compile-only plus schema fixture tests later
  - Failure modes to avoid: NFT-like position types, generic sportsbook models
  - Definition of done: feature code consumes these shared types

- **PP-007 | Create Zod schemas for Predict server responses**
  - Priority: MUST
  - Dependency: PP-006
  - Objective: Validate all external server payloads at runtime.
  - Files: `src/integrations/deepbook-predict/schemas.ts`
  - Implementation instructions: Add schemas for `/status`, predict state, oracle list, oracle state, ask bounds, vault summary, vault performance, manager summary, positions summary, pnl, and history routes. Use `.safeParse` boundaries around every network response. citeturn18view5turn22view0
  - Acceptance criteria: malformed payloads become typed adapter errors, not UI crashes.
  - Required tests: unit tests with valid and invalid fixtures
  - Failure modes to avoid: trusting server JSON blindly
  - Definition of done: no route adapter returns unvalidated untyped JSON

- **PP-008 | Build Predict server HTTP client**
  - Priority: MUST
  - Dependency: PP-004, PP-007
  - Objective: Centralize fetch, timeout, retry, and error mapping for the Predict server.
  - Files: `src/integrations/deepbook-predict/client.ts`, `src/lib/http.ts`
  - Implementation instructions: Support the documented endpoints only; start with read endpoints required by MVP. citeturn9view0turn22view0
  - Acceptance criteria: one reusable client handles status codes, parse failures, and timeouts.
  - Required tests: mocked fetch tests for success, timeout, 4xx, 5xx, invalid JSON
  - Failure modes to avoid: fetch logic duplicated in hooks
  - Definition of done: all Predict server calls go through this client

- **PP-009 | Implement API adapters for market and oracle reads**
  - Priority: MUST
  - Dependency: PP-008
  - Objective: Create typed functions for `getPredictState`, `getPredictOracles`, `getOracleState`, and `getAskBounds`.
  - Files: `src/integrations/deepbook-predict/api/markets.ts`, `src/integrations/deepbook-predict/api/oracles.ts`
  - Implementation instructions: Use the documented paths `/predicts/:predict_id/state`, `/predicts/:predict_id/oracles`, `/oracles/:oracle_id/state`, `/oracles/:oracle_id/ask-bounds`. citeturn9view0turn22view0
  - Acceptance criteria: adapters return stable app-native types.
  - Required tests: adapter tests with schema fixtures
  - Failure modes to avoid: leaking raw server fields into components
  - Definition of done: market reads are component-independent

- **PP-010 | Implement API adapters for vault, manager, PnL, and history**
  - Priority: MUST
  - Dependency: PP-008
  - Objective: Build typed functions for vault summary, performance, manager summary, positions summary, PnL, and transaction history feeds.
  - Files: `src/integrations/deepbook-predict/api/vault.ts`, `src/integrations/deepbook-predict/api/portfolio.ts`, `src/integrations/deepbook-predict/api/history.ts`
  - Implementation instructions: Use only documented endpoints such as `/predicts/:predict_id/vault/summary`, `/predicts/:predict_id/vault/performance?range=ALL`, `/managers/:manager_id/summary`, `/managers/:manager_id/positions/summary`, `/managers/:manager_id/pnl?range=ALL`, `/positions/minted`, `/positions/redeemed`, `/ranges/minted`, `/ranges/redeemed`, `/lp/supplies`, `/lp/withdrawals`, `/trades/:oracle_id`. citeturn22view0
  - Acceptance criteria: portfolio/pnl/history data can be loaded without UI-specific transformation.
  - Required tests: adapter tests with malformed and partial data
  - Failure modes to avoid: mixing UI formatting into API layer
  - Definition of done: portfolio routes can be consumed by hooks immediately

- **PP-011 | Build query key registry and caching policy**
  - Priority: MUST
  - Dependency: PP-009, PP-010
  - Objective: Standardize TanStack Query keys, stale times, and invalidation rules.
  - Files: `src/lib/query-keys.ts`, `src/lib/query-client.ts`
  - Implementation instructions: Use separate namespaces for market, oracle, manager, vault, pnl, and history. Set shorter staleness for oracle reads and longer for history.
  - Acceptance criteria: query keys are centralized and deterministic.
  - Required tests: unit tests for key generation
  - Failure modes to avoid: magic array keys across files
  - Definition of done: hooks import keys from one place only

- **PP-012 | Add data freshness and oracle freshness utilities**
  - Priority: MUST
  - Dependency: PP-006
  - Objective: Compute freshness badges, stale warnings, and tradeability state.
  - Files: `src/lib/freshness.ts`, `src/lib/oracle-status.ts`
  - Implementation instructions: Incorporate oracle timestamp, lifecycle state, and known low-lag versus zero-lag server behavior into UX state. Mints must require live oracle state. citeturn9view3turn22view0
  - Acceptance criteria: UI can distinguish fresh, delayed, stale, inactive, pending settlement, and settled states.
  - Required tests: edge-case tests around expiry and stale timestamps
  - Failure modes to avoid: offering mint on inactive or stale oracle
  - Definition of done: freshness logic is reusable across screens and previews

- **PP-013 | Add app error taxonomy and telemetry-safe logging**
  - Priority: SHOULD
  - Dependency: PP-008
  - Objective: Normalize transport, schema, wallet, RPC, simulation, and protocol errors for UI display.
  - Files: `src/lib/errors.ts`, `src/lib/logger.ts`
  - Implementation instructions: Keep messages judge-friendly and safe, no leaked secrets or raw stack traces in UI.
  - Acceptance criteria: all thrown errors map to typed user-facing variants.
  - Required tests: unit tests for error normalization
  - Failure modes to avoid: generic “something went wrong” everywhere
  - Definition of done: toasts and call sites can render specific messages

**Phase 2**

- **PP-014 | Configure Sui client and network selection**
  - Priority: MUST
  - Dependency: PP-004
  - Objective: Create the app’s Sui client configuration for Testnet only.
  - Files: `src/config/sui.ts`, `src/lib/sui-client.ts`
  - Implementation instructions: Use the verified Testnet gRPC client pattern from dApp Kit docs and expose one shared app client. citeturn18view0
  - Acceptance criteria: app client resolves network and fullnode config correctly.
  - Required tests: config tests
  - Failure modes to avoid: devnet/mainnet ambiguity
  - Definition of done: one source of truth for network config exists

- **PP-015 | Wire DApp Kit provider**
  - Priority: MUST
  - Dependency: PP-014
  - Objective: Install and initialize dApp Kit at the app root.
  - Files: `src/app/providers.tsx`, `src/config/dapp-kit.ts`
  - Implementation instructions: Register networks, create the client, and wrap the app with `DAppKitProvider`. citeturn18view0
  - Acceptance criteria: wallet hooks work in child components.
  - Required tests: root render test
  - Failure modes to avoid: duplicate providers, provider order bugs
  - Definition of done: all wallet hooks resolve without runtime errors

- **PP-016 | Build wallet connection and account status module**
  - Priority: MUST
  - Dependency: PP-015
  - Objective: Implement the top-bar wallet UX with connect, address, network, and disconnect states.
  - Files: `src/features/wallet/WalletPanel.tsx`, `src/features/wallet/useWalletStatus.ts`, `src/components/topbar/WalletButton.tsx`
  - Implementation instructions: Use `ConnectButton` or a custom wrapper around verified dApp Kit hooks. Show current account, wallet name, and network. citeturn18view0turn18view1
  - Acceptance criteria: connect flow works and state restores on reload if wallet supports auto-connect.
  - Required tests: component test for disconnected and connected states
  - Failure modes to avoid: hidden network state, wallet-only jargon
  - Definition of done: judge can clearly see connected wallet and network

- **PP-017 | Add wrong-network and testnet guards**
  - Priority: MUST
  - Dependency: PP-016
  - Objective: Prevent unsupported network execution and surface a clear Testnet banner.
  - Files: `src/features/wallet/NetworkGuard.tsx`, `src/components/banners/TestnetBanner.tsx`
  - Implementation instructions: Hard fail execution actions when not on Testnet; visible warning must always exist in wallet-connected state.
  - Acceptance criteria: action buttons disable on wrong network and explain why.
  - Required tests: component tests for network mismatch
  - Failure modes to avoid: accidental mainnet assumptions
  - Definition of done: trading UI cannot proceed on unsupported network

- **PP-018 | Add explorer link and digest utilities**
  - Priority: SHOULD
  - Dependency: PP-014
  - Objective: Make transaction digest proof visible and clickable.
  - Files: `src/lib/explorer.ts`, `src/components/tx/TxDigestLink.tsx`
  - Implementation instructions: Generate links for object IDs, package IDs, and transaction digests from config.
  - Acceptance criteria: every executed transaction can surface a digest link in UI.
  - Required tests: URL generation tests
  - Failure modes to avoid: hardcoded explorer hosts in components
  - Definition of done: digest evidence is reusable across flows

- **PP-019 | Implement authoritative object read helpers**
  - Priority: MUST
  - Dependency: PP-014, PP-006
  - Objective: Create the direct onchain read layer used immediately before and after wallet flows.
  - Files: `src/integrations/deepbook-predict/onchain/objects.ts`
  - Implementation instructions: Support at least reads for current manager object, target oracle state, and user quote coin selection; this follows the documented “direct on-chain reads for confirmation-critical state” pattern. citeturn8search0turn22view0
  - Acceptance criteria: execution flows can request authoritative object state before submit.
  - Required tests: integration-style mocked client tests
  - Failure modes to avoid: using onchain reads as the main list backend
  - Definition of done: PTB flows have a dedicated read helper layer

- **PP-020 | Implement transaction execution service**
  - Priority: MUST
  - Dependency: PP-015, PP-019
  - Objective: Centralize wallet signing, execution, digest extraction, and standardized success/error output.
  - Files: `src/lib/tx-executor.ts`, `src/types/tx.ts`
  - Implementation instructions: Use the verified dApp Kit sign-and-execute surface initially. Add a transport abstraction so read-after-write handling can evolve later if separate signing and execution is required for consistency. The Sui cheat sheet notes same-node submission/read patterns matter for read-after-write consistency. citeturn20view1turn13search7
  - Acceptance criteria: one service returns success digest, failure reason, and affected object hints.
  - Required tests: mocked DApp Kit execution tests
  - Failure modes to avoid: every modal talking to wallet APIs directly
  - Definition of done: all execute buttons call this service

- **PP-021 | Document testnet funding and operator prerequisites**
  - Priority: MUST
  - Dependency: PP-004
  - Objective: Make setup for SUI gas and dUSDC explicit so Codex does not pretend funding problems are app bugs.
  - Files: `docs/ENVIRONMENT_SETUP.md`, `src/config/prereqs.ts`
  - Implementation instructions: Note that SUI gas must exist on Testnet and that the current enabled quote asset is dUSDC; if acquisition flow is external, mark it clearly as prerequisite, not in-app magic. citeturn9view0turn22view0
  - Acceptance criteria: setup doc explains what must exist before real transactions.
  - Required tests: none beyond doc review
  - Failure modes to avoid: hidden assumptions about prefunded accounts
  - Definition of done: demo setup prerequisites are explicit

**Phase 3**

- **PP-022 | Add Predict deployment config module**
  - Priority: MUST
  - Dependency: PP-004
  - Objective: Create a protocol config registry used by all features.
  - Files: `src/config/predict.ts`
  - Implementation instructions: Store server URL, package ID, registry ID, Predict object ID, quote asset type, and supported endpoints in one module, with comments noting Testnet provisional status. citeturn9view0turn0search7
  - Acceptance criteria: no other file hardcodes Predict deployment values.
  - Required tests: config snapshot/unit tests
  - Failure modes to avoid: stale IDs spread across hooks and components
  - Definition of done: grep finds one authoritative location only

- **PP-023 | Implement market intelligence query hooks**
  - Priority: MUST
  - Dependency: PP-009, PP-011, PP-022
  - Objective: Build hooks for market lists, selected market state, and current oracle view.
  - Files: `src/features/markets/hooks/usePredictState.ts`, `src/features/markets/hooks/usePredictOracles.ts`, `src/features/markets/hooks/useOracleState.ts`
  - Implementation instructions: Use server routes for default rendering as documented. citeturn22view0
  - Acceptance criteria: dashboard and market pages can load purely from hooks.
  - Required tests: hook tests with success and error states
  - Failure modes to avoid: component-local fetches
  - Definition of done: hooks expose stable status and data contracts

- **PP-024 | Implement ask-bounds and market-key helpers**
  - Priority: MUST
  - Dependency: PP-009, PP-006
  - Objective: Turn oracle and market config into tradeable UI inputs.
  - Files: `src/features/markets/lib/market-keys.ts`, `src/features/markets/hooks/useAskBounds.ts`
  - Implementation instructions: Build helpers for binary strike selection and range lower/higher strike validation with explicit handling for ask bounds. Ask bounds are a documented config surface. citeturn9view0turn10view2
  - Acceptance criteria: selected strike inputs always resolve to valid keys or explicit validation errors.
  - Required tests: unit tests for strike mapping and range validation
  - Failure modes to avoid: freeform invalid strike input reaching PTB builder
  - Definition of done: strategy builder can only produce valid key candidates

- **PP-025 | Implement manager discovery and ownership hooks**
  - Priority: MUST
  - Dependency: PP-010, PP-019
  - Objective: Find the user’s existing `PredictManager` or guide them to create one.
  - Files: `src/features/manager/hooks/usePredictManager.ts`, `src/features/manager/lib/manager-select.ts`
  - Implementation instructions: Prefer indexed manager discovery for page load, then confirm directly onchain before wallet actions if needed. Official guidance says each user should create one manager and reuse it. citeturn9view2turn22view0
  - Acceptance criteria: app knows whether the active wallet already has a usable manager.
  - Required tests: hook tests for no manager, one manager, ambiguous results
  - Failure modes to avoid: auto-creating duplicate managers silently
  - Definition of done: manager presence is a first-class app state

- **PP-026 | Implement vault and PLP read hooks**
  - Priority: MUST
  - Dependency: PP-010
  - Objective: Expose vault value, balances, utilization context, and PLP performance data.
  - Files: `src/features/vault/hooks/useVaultSummary.ts`, `src/features/vault/hooks/useVaultPerformance.ts`
  - Implementation instructions: Use documented vault endpoints and the official PLP model. citeturn9view4turn22view0
  - Acceptance criteria: vault page can render summary and performance series.
  - Required tests: hook tests with empty and populated charts
  - Failure modes to avoid: treating PLP as a generic farm token
  - Definition of done: vault page has live read data

- **PP-027 | Implement portfolio and positions summary hooks**
  - Priority: MUST
  - Dependency: PP-010, PP-025
  - Objective: Load manager summary, positions summary, and normalized holdings.
  - Files: `src/features/portfolio/hooks/useManagerSummary.ts`, `src/features/portfolio/hooks/usePositionsSummary.ts`
  - Implementation instructions: Normalize server responses into binary and range groups by oracle and expiry.
  - Acceptance criteria: portfolio UI can show holdings without manual transformation in components.
  - Required tests: adapter and hook tests
  - Failure modes to avoid: mixing live wallet balances with manager balances
  - Definition of done: portfolio cards derive from shared normalized selectors

- **PP-028 | Implement PnL and transaction history hooks**
  - Priority: MUST
  - Dependency: PP-010, PP-025
  - Objective: Load PnL series and activity history for the active manager.
  - Files: `src/features/portfolio/hooks/usePnl.ts`, `src/features/history/hooks/useTransactionHistory.ts`
  - Implementation instructions: Use manager PnL server endpoint and union history feeds for mints, redeems, supplies, and withdrawals.
  - Acceptance criteria: PnL and history pages can render independently.
  - Required tests: hook tests for empty and populated histories
  - Failure modes to avoid: local-only optimistic history with no server truth
  - Definition of done: history updates can be invalidated after each write

- **PP-029 | Add optional live oracle tape subscription**
  - Priority: SHOULD
  - Dependency: PP-014, PP-023
  - Objective: Improve market-detail freshness for judges without rewriting the app around raw events.
  - Files: `src/features/oracle/hooks/useLiveOracleTape.ts`
  - Implementation instructions: Subscribe only for freshness increments on market detail UI. Watch official event names such as `oracle::OraclePricesUpdated`, `oracle::OracleSVIUpdated`, `oracle::OracleSettled`, and `oracle::OracleActivated`, and keep the server as the primary history source. citeturn22view0
  - Acceptance criteria: market detail can overlay fresher oracle state while preserving server-backed rendering.
  - Required tests: mocked subscription tests
  - Failure modes to avoid: event-only app architecture
  - Definition of done: optional live tape can be toggled on without breaking base reads

**Phase 4**

- **PP-030 | Decide and implement generated bindings strategy**
  - Priority: SHOULD
  - Dependency: PP-022
  - Objective: Use generated Move bindings where verified, or fall back to a thin wrapper layer if codegen cannot be completed quickly.
  - Files: `src/integrations/deepbook-predict/generated/*` or `src/integrations/deepbook-predict/targets.ts`
  - Implementation instructions: The official README recommends `@mysten/codegen` as the default integration path for parsing, typed decoding, PTB helpers, and call targets. If generated code is not ready, create one typed target registry with `TODO VERIFY` on any unresolved signature details. citeturn22view0
  - Acceptance criteria: transaction builders import targets from one module only.
  - Required tests: compile tests
  - Failure modes to avoid: raw `package::module::function` strings sprinkled across features
  - Definition of done: PTB construction has one verified target source

- **PP-031 | Implement create-manager PTB builder**
  - Priority: MUST
  - Dependency: PP-020, PP-030
  - Objective: Build the PTB for `predict::create_manager`.
  - Files: `src/integrations/deepbook-predict/tx/create-manager.ts`
  - Implementation instructions: Use the verified entry point `predict::create_manager`; return a structured preview model before execute. citeturn10view0turn22view0
  - Acceptance criteria: builder produces a valid transaction and preview object.
  - Required tests: unit tests plus dry-run or simulation test if transport supports it
  - Failure modes to avoid: auto-executing without preview
  - Definition of done: user can create a manager from UI with confirmed digest

- **PP-032 | Implement manager deposit PTB builder**
  - Priority: MUST
  - Dependency: PP-020, PP-030, PP-025
  - Objective: Build the manager funding transaction.
  - Files: `src/integrations/deepbook-predict/tx/deposit-manager.ts`
  - Implementation instructions: Use `predict_manager::deposit` only if signature is verified from source or bindings; otherwise keep return type and UX scaffold with `TODO VERIFY` on unresolved type arguments. Official README confirms the deposit flow lives in `predict_manager::deposit`. citeturn22view0
  - Acceptance criteria: builder either executes correctly on verified Testnet signature or is explicitly blocked behind `TODO VERIFY`.
  - Required tests: unit tests for input validation, simulation test if possible
  - Failure modes to avoid: guessing the deposit signature
  - Definition of done: no silent fake funding path remains

- **PP-033 | Implement manager withdraw PTB builder**
  - Priority: SHOULD
  - Dependency: PP-032
  - Objective: Build the manager quote-asset withdrawal transaction.
  - Files: `src/integrations/deepbook-predict/tx/withdraw-manager.ts`
  - Implementation instructions: Function name remains `TODO VERIFY` unless source or generated bindings confirm it. Official docs confirm the manager owner can withdraw quote assets, but the exact call target is not fully verified in the excerpt. citeturn10view5
  - Acceptance criteria: either verified working implementation or clearly blocked `TODO VERIFY` boundary
  - Required tests: unit validation tests, simulation test if verified
  - Failure modes to avoid: invented module function name
  - Definition of done: uncertainty status is explicit in code and docs

- **PP-034 | Implement binary trade preview service**
  - Priority: MUST
  - Dependency: PP-024, PP-030
  - Objective: Calculate or fetch binary mint and redeem preview surfaces before signing.
  - Files: `src/integrations/deepbook-predict/tx/preview-binary.ts`, `src/features/trade/lib/binary-preview.ts`
  - Implementation instructions: Use the verified preview function name `get_trade_amounts()` only if builder/source verification confirms exact usage. Pair preview with local validation around oracle freshness, manager funding, and strike validity. citeturn10view0turn10view1
  - Acceptance criteria: UI can show quantity, estimated cost or payout, and warning states before execution.
  - Required tests: edge tests for invalid quantity, stale oracle, missing manager
  - Failure modes to avoid: price preview shown without freshness context
  - Definition of done: binary preview modal works without signing

- **PP-035 | Implement binary mint and redeem PTB builders**
  - Priority: MUST
  - Dependency: PP-034
  - Objective: Build `predict::mint<Quote>` and `predict::redeem<Quote>` flows.
  - Files: `src/integrations/deepbook-predict/tx/mint-binary.ts`, `src/integrations/deepbook-predict/tx/redeem-binary.ts`
  - Implementation instructions: Use only verified entry points and build a typed input object carrying `Predict`, `PredictManager`, `OracleSVI`, `MarketKey`, quantity, and clock requirements. Official repo README describes those exact flow requirements. citeturn22view0
  - Acceptance criteria: one click path exists from preview to signed execution to digest receipt.
  - Required tests: PTB builder tests, one real Testnet smoke scenario when setup is available
  - Failure modes to avoid: missing clock input, hidden generic quote type, no post-submit invalidation
  - Definition of done: binary mint and redeem can be demoed end to end

- **PP-036 | Implement range trade preview service**
  - Priority: MUST
  - Dependency: PP-024, PP-030
  - Objective: Build preview support for vertical range mint and redeem.
  - Files: `src/integrations/deepbook-predict/tx/preview-range.ts`, `src/features/trade/lib/range-preview.ts`
  - Implementation instructions: Use `get_range_trade_amounts()` if verified, enforce `lowerStrike < higherStrike`, and surface ask-bound and expiry warnings. citeturn10view2
  - Acceptance criteria: range preview works for valid, invalid, and edge inputs.
  - Required tests: unit tests for range validation and preview status
  - Failure modes to avoid: reversed strikes, same-strike range, preview without lifecycle check
  - Definition of done: range preview modal is execution-ready

- **PP-037 | Implement range mint and redeem PTB builders**
  - Priority: MUST
  - Dependency: PP-036
  - Objective: Build `predict::mint_range<Quote>` and `predict::redeem_range<Quote>` flows.
  - Files: `src/integrations/deepbook-predict/tx/mint-range.ts`, `src/integrations/deepbook-predict/tx/redeem-range.ts`
  - Implementation instructions: Use only verified entry points and `RangeKey`-based inputs; official repo README confirms range positions are keyed by oracle, expiry, lower strike, and higher strike. citeturn10view1turn22view0
  - Acceptance criteria: range trades can be previewed, signed, executed, and reflected in portfolio.
  - Required tests: PTB builder tests and one real Testnet scenario if funded
  - Failure modes to avoid: ad hoc strike serialization logic in components
  - Definition of done: range flows are functionally parallel to binary flows

- **PP-038 | Implement vault supply and withdraw PTB builders**
  - Priority: MUST
  - Dependency: PP-030, PP-026
  - Objective: Build `predict::supply<Quote>` and `predict::withdraw<Quote>` execution paths.
  - Files: `src/integrations/deepbook-predict/tx/supply-vault.ts`, `src/integrations/deepbook-predict/tx/withdraw-vault.ts`
  - Implementation instructions: Use verified entry points only, and show PLP mint/burn consequences in preview. Official docs and repo README verify these entry points and the supply/withdraw vault model. citeturn10view3turn10view4turn9view4turn22view0
  - Acceptance criteria: LP flow executes on Testnet and returns digest plus updated PLP state.
  - Required tests: unit plus real smoke path when funded
  - Failure modes to avoid: treating withdrawals as always available despite coverage constraints
  - Definition of done: vault supply and withdraw are both demoable

- **PP-039 | Add PTB simulation and preview adapter**
  - Priority: MUST
  - Dependency: PP-031 through PP-038
  - Objective: Support transaction preview, return-value inspection if available, and pre-submit sanity checks.
  - Files: `src/integrations/deepbook-predict/tx/simulate.ts`, `src/features/tx/lib/tx-preview.ts`
  - Implementation instructions: If current client surface supports `simulateTransaction`, use it behind one adapter. Otherwise rely on local preview plus wallet dry-run behavior and mark transport gap `TODO VERIFY`. Official docs show PTB dry-run gas derivation and SDK migration to `simulateTransaction`. citeturn13search1turn18view3
  - Acceptance criteria: transaction preview modal shows decoded intent, expected effect, and potential warnings before signing.
  - Required tests: mocked simulation adapter tests
  - Failure modes to avoid: pretending a raw PTB JSON dump is a user-facing preview
  - Definition of done: all write flows can call one preview adapter

**Phase 5**

- **PP-040 | Build global layout, navigation, and route shell**
  - Priority: MUST
  - Dependency: PP-003, PP-016
  - Objective: Create the terminal shell with sidebar, top bar, route outlet, wallet area, and testnet indicators.
  - Files: `src/app/router.tsx`, `src/app/AppShell.tsx`, `src/components/layout/*`
  - Implementation instructions: Match the wireframes, keep the feel as an execution terminal, not a simple betting site.
  - Acceptance criteria: all core routes load inside one consistent shell.
  - Required tests: shell render test
  - Failure modes to avoid: isolated pages with duplicated providers
  - Definition of done: route shell supports all feature screens

- **PP-041 | Build dashboard screen**
  - Priority: MUST
  - Dependency: PP-023, PP-026
  - Objective: Show judge-fast overview of market status, oracle freshness, portfolio snapshot, and vault snapshot.
  - Files: `src/features/dashboard/DashboardPage.tsx`
  - Implementation instructions: Pull from Predict state, selected oracle set, manager summary, and vault summary. Use the public server for render-ready state. citeturn22view0
  - Acceptance criteria: dashboard loads meaningful data within one screen.
  - Required tests: component tests for loading, empty, error, success
  - Failure modes to avoid: vanity metric dashboard with no execution context
  - Definition of done: dashboard can serve as demo landing screen

- **PP-042 | Build market intelligence screen**
  - Priority: MUST
  - Dependency: PP-023, PP-024, PP-029
  - Objective: Present active oracles, expiry, ask bounds, freshness, and market selection.
  - Files: `src/features/markets/MarketIntelligencePage.tsx`
  - Implementation instructions: Include filters by underlying and expiry where supported by available data.
  - Acceptance criteria: judge can find a tradeable market quickly.
  - Required tests: component tests
  - Failure modes to avoid: generic list with no oracle context
  - Definition of done: screen leads naturally into market detail and execution

- **PP-043 | Build market detail and strategy builder**
  - Priority: MUST
  - Dependency: PP-034, PP-036
  - Objective: Combine oracle state, strike selection, quantity input, binary/range selector, preview entry, and warnings.
  - Files: `src/features/trade/MarketDetailPage.tsx`, `src/features/trade/StrategyBuilder.tsx`
  - Implementation instructions: Show binary and range modes explicitly, surface ask bounds and expiry, and block invalid modes early.
  - Acceptance criteria: user can prepare a binary or range action without signing.
  - Required tests: interaction tests with Testing Library
  - Failure modes to avoid: one undifferentiated form for every trade type
  - Definition of done: strategy builder is the main execution launcher

- **PP-044 | Build SVI surface explorer and oracle status screen**
  - Priority: SHOULD
  - Dependency: PP-023, PP-029
  - Objective: Make `OracleSVI` visible as a serious market state source rather than hidden machinery.
  - Files: `src/features/oracle/OracleStatusPage.tsx`, `src/features/oracle/SVISurfacePage.tsx`
  - Implementation instructions: Include spot, forward, expiry, parameter freshness, lifecycle state, and settlement view if available from server or live tape.
  - Acceptance criteria: judge can understand oracle freshness and state transitions visually.
  - Required tests: component tests for live, stale, settled states
  - Failure modes to avoid: decorative chart with no verified meaning
  - Definition of done: oracle page strengthens technical credibility

- **PP-045 | Build PredictManager screen**
  - Priority: MUST
  - Dependency: PP-025, PP-031, PP-032, PP-033
  - Objective: Show manager existence, balances, positions summary, and deposit or withdraw actions.
  - Files: `src/features/manager/PredictManagerPage.tsx`
  - Implementation instructions: This screen should make the “one manager per user” model obvious. citeturn9view2turn22view0
  - Acceptance criteria: user can create a manager and inspect manager balances from one place.
  - Required tests: component tests plus mocked mutation tests
  - Failure modes to avoid: hiding manager model from user and judge
  - Definition of done: manager lifecycle is visible and explicit

- **PP-046 | Build portfolio, PnL, and history screens**
  - Priority: MUST
  - Dependency: PP-027, PP-028
  - Objective: Show current holdings, PnL time series, and activity history after transactions.
  - Files: `src/features/portfolio/PortfolioPage.tsx`, `src/features/portfolio/PnlPage.tsx`, `src/features/history/HistoryPage.tsx`
  - Implementation instructions: Keep transaction digest links present where possible and group activity by action type.
  - Acceptance criteria: portfolio and history visibly update after writes.
  - Required tests: component and hook tests
  - Failure modes to avoid: static metrics disconnected from execution
  - Definition of done: post-trade proof is visible in app UI

- **PP-047 | Build vault and PLP screen**
  - Priority: MUST
  - Dependency: PP-026, PP-038
  - Objective: Show supply and withdrawal actions, PLP holdings, and vault performance context.
  - Files: `src/features/vault/VaultPage.tsx`
  - Implementation instructions: Present PLP as LP share ownership, not as a reward token. The official docs describe `PLP` as the LP share coin minted when users supply vault liquidity. citeturn9view4turn22view0
  - Acceptance criteria: LP flow is clear and separate from trade flow.
  - Required tests: component tests
  - Failure modes to avoid: mixing trade and LP actions into one unclear workflow
  - Definition of done: vault flow is independently demoable

- **PP-048 | Build risk preview and transaction preview surfaces**
  - Priority: MUST
  - Dependency: PP-034, PP-036, PP-039
  - Objective: Ensure every write action shows a pre-sign review layer.
  - Files: `src/features/tx/RiskPreview.tsx`, `src/features/tx/TransactionPreview.tsx`, `src/components/modals/ExecutionModal.tsx`
  - Implementation instructions: Surface oracle freshness, ask bounds, expiry, manager balance availability, selected action, quote asset, estimated cost or payout, and digest output after success.
  - Acceptance criteria: no direct execute path bypasses preview modal.
  - Required tests: component interaction tests
  - Failure modes to avoid: single-click signing with no context
  - Definition of done: all write buttons route through shared preview UX

- **PP-049 | Implement UX state coverage and responsive polish**
  - Priority: MUST
  - Dependency: PP-040 through PP-048
  - Objective: Add loading, empty, error, success, mobile, keyboard, and accessibility states across screens.
  - Files: `src/components/states/*`, `src/styles/*`, page files above
  - Implementation instructions: Follow wireframes and Testing Library accessibility-first testing approach.
  - Acceptance criteria: every page and modal has explicit loading, empty, error, and success behavior.
  - Required tests: component tests and Playwright viewport checks
  - Failure modes to avoid: blank screens, spinner-only pages, inaccessible controls
  - Definition of done: UI quality is demo-safe on desktop and acceptable on mobile

**Phase 6**

- **PP-050 | Wire binary mint end-to-end flow**
  - Priority: MUST
  - Dependency: PP-035, PP-043, PP-048
  - Objective: Connect strategy builder to binary mint preview, wallet signing, digest receipt, and post-tx refresh.
  - Files: `src/features/trade/actions/useBinaryMintFlow.ts`
  - Implementation instructions: Use authoritative reads before submit where needed, then refresh affected manager and server-backed pages after confirmation. citeturn22view0turn13search7
  - Acceptance criteria: funded Testnet account can mint a binary position successfully.
  - Required tests: one Playwright scenario plus one manual Testnet rehearsal
  - Failure modes to avoid: success toast without actual portfolio refresh
  - Definition of done: binary mint is working in the app, not just in unit tests

- **PP-051 | Wire binary redeem end-to-end flow**
  - Priority: MUST
  - Dependency: PP-035, PP-046, PP-048
  - Objective: Connect portfolio or market detail to binary redeem preview and execution.
  - Files: `src/features/trade/actions/useBinaryRedeemFlow.ts`
  - Implementation instructions: Include settled-position permissionless path only if portfolio UX truly needs it and the signature is verified; otherwise keep it out of MVP execution UI.
  - Acceptance criteria: redeem updates manager balances and history.
  - Required tests: Playwright scenario and manual Testnet run
  - Failure modes to avoid: redeeming unavailable quantity, stale holdings UI
  - Definition of done: binary redeem is demo-safe

- **PP-052 | Wire range mint and redeem end-to-end flows**
  - Priority: MUST
  - Dependency: PP-037, PP-043, PP-048
  - Objective: Deliver one complete range flow path.
  - Files: `src/features/trade/actions/useRangeMintFlow.ts`, `src/features/trade/actions/useRangeRedeemFlow.ts`
  - Implementation instructions: If time is limited, prioritize range mint plus preview and keep full redeem as second priority, but do not fake completion.
  - Acceptance criteria: at least one real range transaction path works on Testnet, full status clearly documented.
  - Required tests: Playwright scenario for available range path
  - Failure modes to avoid: claiming full range support when only preview exists
  - Definition of done: real status is visible in docs and UI

- **PP-053 | Wire vault supply and withdraw end-to-end flows**
  - Priority: MUST
  - Dependency: PP-038, PP-047, PP-048
  - Objective: Complete LP entry and exit execution.
  - Files: `src/features/vault/actions/useVaultSupplyFlow.ts`, `src/features/vault/actions/useVaultWithdrawFlow.ts`
  - Implementation instructions: Refresh vault summary, PLP view, and history after success.
  - Acceptance criteria: user can supply and later withdraw with digest proof.
  - Required tests: Playwright or manual Testnet smoke path
  - Failure modes to avoid: LP actions without vault state invalidation
  - Definition of done: LP path is independently working

- **PP-054 | Add consistent post-transaction refresh orchestration**
  - Priority: MUST
  - Dependency: PP-050 through PP-053
  - Objective: Standardize invalidation and direct confirmation reads after every successful write.
  - Files: `src/lib/post-tx-refresh.ts`
  - Implementation instructions: Refresh directly affected onchain objects if needed, then invalidate server-backed queries, because official guidance says server lag is low but not zero. citeturn22view0
  - Acceptance criteria: no successful transaction leaves stale portfolio, history, or vault UI on current page.
  - Required tests: integration tests for invalidation order
  - Failure modes to avoid: digest success with unchanged dashboard
  - Definition of done: all write flows share one refresh strategy

- **PP-055 | Build full automated test layers**
  - Priority: MUST
  - Dependency: PP-001 through PP-054
  - Objective: Implement the test plan from `TESTING_STRATEGY.md`.
  - Files: `src/tests/**/*.test.ts`, `src/tests/**/*.spec.tsx`, `e2e/**/*.spec.ts`, `playwright.config.ts`, `vitest.config.ts`
  - Implementation instructions: Use Vitest for units, React Testing Library for components, and Playwright for E2E. TanStack Query hooks should be tested with isolated query clients and mocked network calls. citeturn19view1turn19view2turn18view6turn18view4
  - Acceptance criteria: core read hooks, PTB builders, preview logic, wallet guards, and main flows have coverage.
  - Required tests: the tests themselves are the requirement
  - Failure modes to avoid: relying only on manual clicking
  - Definition of done: repo has meaningful automated regression protection

- **PP-056 | Add demo mode without hiding real execution**
  - Priority: SHOULD
  - Dependency: PP-041 through PP-054
  - Objective: Provide a safe demo fallback for unfunded or degraded environments while keeping real Testnet paths visible.
  - Files: `src/features/demo/DemoModeProvider.tsx`, `src/config/feature-flags.ts`
  - Implementation instructions: Demo mode can preload curated market, oracle, and portfolio fixtures, but execution buttons must clearly say when they are simulated versus live.
  - Acceptance criteria: judges can still navigate a useful UI if infrastructure is degraded.
  - Required tests: component tests and one Playwright demo mode flow
  - Failure modes to avoid: “demo mode” that conceals a non-working real app
  - Definition of done: fallback mode exists and is honest

- **PP-057 | Add security and abuse hardening**
  - Priority: MUST
  - Dependency: PP-048, PP-055
  - Objective: Prevent unsafe input, stale signed actions, and accidental credential exposure.
  - Files: `src/lib/security.ts`, `docs/SECURITY_CHECKLIST.md`
  - Implementation instructions: Validate all server responses with Zod, never handle private keys directly, time-box previews, re-check critical state before signing, and avoid concurrent user flows that can race each other.
  - Acceptance criteria: no secrets in client bundle, no raw unsafe server data render path, action guards exist.
  - Required tests: unit tests for guard functions
  - Failure modes to avoid: local storage of sensitive wallet material, blind retry loops, stale-preview execution
  - Definition of done: security checklist passes for MVP

- **PP-058 | Prepare deployment and environment runbook**
  - Priority: SHOULD
  - Dependency: PP-005, PP-055
  - Objective: Make the app deployable on a static host with clear env instructions.
  - Files: `docs/DEPLOYMENT_RUNBOOK.md`, `README.md`, hosting config files as needed
  - Implementation instructions: Keep hosting simple, prefer static frontend deployment with client-side calls to Testnet and Predict server.
  - Acceptance criteria: clean production build and deployed preview environment exist.
  - Required tests: `pnpm build`, smoke test against deployed URL
  - Failure modes to avoid: unnecessary custom backend during hackathon week
  - Definition of done: one public demo URL can be shared

- **PP-059 | Build documentation and submission package**
  - Priority: MUST
  - Dependency: PP-058
  - Objective: Generate the final repo-facing docs required for handoff and submission.
  - Files: `README.md`, `DEMO_SCRIPT.md`, `CODEX_BUILD_TASKS.md`, `MASTER_CODEX_PROMPT.md`, `SUBMISSION_CHECKLIST.md`
  - Implementation instructions: README must explain what PredictPilot is, how to run it, what is live on Testnet, and what remains `TODO VERIFY`.
  - Acceptance criteria: a new reviewer can understand setup, architecture, and demo flow from docs alone.
  - Required tests: doc review plus setup replay on fresh machine
  - Failure modes to avoid: README that promises unsupported features
  - Definition of done: docs match actual implementation status
  - PP-059 status note: submission-package scaffolding should include proof digest tracking, screenshot folders, final form copy, and explicit `TODO VERIFY` placeholders for live URL, demo video, final oracle/market, and funded Testnet proof. Do not replace those placeholders with invented proof.

- **PP-060 | Run final release candidate gate**
  - Priority: MUST
  - Dependency: PP-001 through PP-059
  - Objective: Enforce a single final quality gate before submission.
  - Files: `docs/RELEASE_CANDIDATE_CHECKLIST.md`
  - Implementation instructions: Require passing lint, typecheck, unit tests, smoke E2E, at least one real binary trade path, visible digest proof, portfolio refresh proof, and final demo rehearsal.
  - Acceptance criteria: every MUST task is complete or explicitly downgraded with rationale; no hidden broken flow remains.
  - Required tests: full CI + manual release checklist
  - Failure modes to avoid: shipping with known broken core flow
  - Definition of done: repo is ready for final hackathon submission

**Phase 13**

- **PP-061 | Build Proof Mode**
  - Priority: MUST
  - Dependency: PP-048, PP-054, PP-060
  - Objective: Add a dedicated proof cockpit that lets a judge verify wallet, Testnet, manager, dUSDC, selected oracle, PTB simulation, latest digest, explorer link, portfolio refresh, and history refresh in 60 to 90 seconds.
  - Files: `src/features/proof/`, route shell integration, proof-specific tests
  - Implementation instructions: Separate proof sources as `Wallet`, `Chain`, `Predict server`, and `Local`; show `Blocked`, `Ready`, `Ready but Not Submitted`, `Pending Index`, `Verified`, and `Failed` without collapsing chain confirmation and indexed refresh into one boolean. Any digest shown in Proof Mode must come from a confirmed execution result, a strict wallet-return recovery match, or a matching indexed history row, never from arbitrary local text.
  - Acceptance criteria: `/proof` shows a top verdict, readiness checklist, execution proof, reconciliation status, digest/explorer card when available, and honest stale/indexing states.
  - Required tests: unit/component tests plus Playwright route smoke
  - Failure modes to avoid: fake proof, claiming a digest is verified before chain confirmation, or treating delayed Predict-server history as transaction failure.
  - Definition of done: a judge can open Proof Mode and understand exactly what is real, pending, blocked, or unproven.

- **PP-062 | Add Demo Proof Recorder and copy summary**
  - Priority: MUST
  - Dependency: PP-061
  - Objective: Add a copyable proof summary for screenshots, video narration, and submission proof notes.
  - Files: `src/features/proof/`, proof utilities, proof-specific tests
  - Implementation instructions: Generate a plain-text summary with network, wallet, action, manager, oracle, quantity, digest, explorer link, portfolio refresh, history refresh, and source labels. Never include raw transaction bytes, signed payloads, wallet auth state, cookies, stack traces, private metadata, or unbounded local/session data.
  - Acceptance criteria: Copy proof works for verified and pending-index states and clearly labels missing or pending data.
  - Required tests: unit tests for summary output and component tests for copy behavior
  - Failure modes to avoid: copied proof that omits pending states or represents local/session data as chain proof.
  - Definition of done: the copied proof summary can be pasted directly into submission notes without manual cleanup.

- **PP-063 | Add Best Market Finder**
  - Priority: MUST
  - Dependency: PP-042, PP-061
  - Objective: Surface a small set of judge-friendly demo markets from the large oracle list.
  - Files: `src/features/markets/`, market ranking utilities, market page tests
  - Implementation instructions: Rank markets conservatively by active lifecycle, freshness, BTC/demo suitability, non-expired timing, strike validity, tradeability, and ask-bounds availability. Unknown fields must produce lower confidence, not invented certainty.
  - Acceptance criteria: Markets page exposes `Best Demo Markets` and an `Open Best Strategy` path without hiding the full oracle list.
  - Required tests: ranking unit tests, markets component tests, Playwright smoke
  - Failure modes to avoid: recommending expired, inactive, stale, or unsupported markets as best choices.
  - Definition of done: a judge can reach a credible strategy candidate without manually searching thousands of oracles.

- **PP-064 | Add payoff and risk visualizer**
  - Priority: SHOULD
  - Dependency: PP-043, PP-048, PP-061
  - Objective: Explain binary and range payoff semantics before signing.
  - Files: `src/features/trade/`, risk visualizer tests
  - Implementation instructions: For binary trades, show UP/DOWN win conditions and simulated cost/payout when available. For range trades, show the `(lower, higher]` settlement band. Never fabricate pricing when simulation or estimator data is missing.
  - Acceptance criteria: Strategy Builder and Proof Mode can show readable payoff/risk cards for selected binary or range inputs.
  - Required tests: unit tests for display models and component tests for missing-data states
  - Failure modes to avoid: presenting approximate payoff math as protocol-authoritative.
  - Definition of done: a non-expert judge can explain what the selected trade wins or loses on.

- **PP-065 | Add Oracle Health Audit**
  - Priority: SHOULD
  - Dependency: PP-012, PP-024, PP-044, PP-061
  - Objective: Turn oracle lifecycle, freshness, ask bounds, expiry, and strike validity into a practical health checklist.
  - Files: `src/features/oracle/`, health audit utilities, oracle tests
  - Implementation instructions: Provide a tradeability score or label based on verified fields only; unknown or missing data must be visible and conservative.
  - Acceptance criteria: Market detail, Oracle Status, and Proof Mode can show active/stale/settled/ask-bounds/strike-validity checks consistently.
  - Required tests: utility tests plus Oracle Status component tests
  - Failure modes to avoid: overbuilding unverified SVI math or hiding missing ask-bounds/risk payloads.
  - Definition of done: selected-oracle readiness is understandable without reading raw JSON or external docs.

- **PP-066 | Add Strategy Receipt and Proof Card**
  - Priority: SHOULD
  - Dependency: PP-061, PP-064, PP-065
  - Objective: Create a concise card for the selected or executed strategy that can be used in UI, screenshots, and demo narration.
  - Files: `src/features/proof/`, `src/features/trade/`, receipt tests
  - Implementation instructions: Show action, market, oracle ID, manager ID, strike/range, quantity, warnings, digest, explorer link, and refresh states. Reuse Proof Mode source labels.
  - Acceptance criteria: Strategy Receipt appears before signing without a digest and after execution with digest/explorer proof when available.
  - Required tests: component tests for pre-sign, post-sign, and pending-index receipts
  - Failure modes to avoid: showing fake digests, hiding warnings, or implying execution before wallet approval.
  - Definition of done: a single card can explain the strategy and proof state in a screenshot.

- **PP-067 | Add Judge Demo Path**
  - Priority: SHOULD
  - Dependency: PP-056, PP-061, PP-062, PP-063
  - Objective: Add a guided path that takes judges from best market selection through proof verification with minimal branching.
  - Files: `src/features/demo/`, proof/demo integration tests
  - Implementation instructions: Guide through Best Market, Oracle Health, Strategy Preview, PTB Preview, Wallet Signature, Digest, Portfolio, History, and Proof Mode. Demo fixtures must remain labeled as offline and never replace live proof.
  - Acceptance criteria: `Start Judge Demo` provides a clear path for both live-ready and offline/demo states.
  - Required tests: component tests and Playwright smoke for the guided path
  - Failure modes to avoid: using demo mode to imply live transaction proof or hiding required wallet/funding prerequisites.
  - Definition of done: the product can be demonstrated coherently even if indexing lags or live dUSDC is unavailable.

## MUST, SHOULD, COULD, and DO NOT BUILD

MUST HAVE tasks:

- PP-001 through PP-012
- PP-014 through PP-017
- PP-019 through PP-028
- PP-031
- PP-032 if fully verified, otherwise explicit `TODO VERIFY` plus blocked UI state
- PP-034 through PP-041
- PP-043
- PP-045 through PP-050
- PP-051
- PP-052 with at least one honest real range path
- PP-053 through PP-055
- PP-057
- PP-059
- PP-060
- PP-061
- PP-062
- PP-063

SHOULD HAVE tasks:

- PP-013
- PP-018
- PP-029
- PP-030
- PP-033 if verified
- PP-044
- PP-056
- PP-058
- PP-064
- PP-065
- PP-066
- PP-067

COULD HAVE tasks:

- richer live oracle tape visuals in PP-029
- advanced chart overlays on SVI page in PP-044
- more than one wallet UX variant in PP-016
- extra cross-browser polish beyond core Playwright coverage
- generated bindings if PP-030 can be finished cleanly

DO NOT BUILD tasks:

- separate onchain position NFTs or separate onchain range objects
- a generic sportsbook or casino UX
- a fake analytics dashboard with no transaction flow
- a new custom backend or indexer before MVP completion
- unrelated DeepBook v3 spot trading surfaces that distract from Predict
- DeepBook Margin integration in MVP unless directly required and verified
- Mainnet support during hackathon delivery
- social features, chat, comments, leaderboards, referrals, or gamification
- wallet custody, embedded private key handling, or secret management in frontend
- protocol admin tooling for registry or oracle operator functions
- invented endpoints, invented function names, or invented hackathon requirements

Common bugs Codex must prevent:

- stale package IDs or old Testnet config mixed with current deployment values
- using direct chain scans as the primary render backend instead of the Predict server
- letting users mint without a live oracle or visible freshness check
- assuming positions are standalone objects
- not invalidating manager, portfolio, and history after writes
- no digest proof shown after success
- no wrong-network guard
- range keys built from invalid or reversed strikes
- treating dUSDC wallet balance as identical to manager balance
- hiding `TODO VERIFY` under “coming soon” language
- optimistic UI that claims success before confirmed execution

## Final Codex execution checklist

Use this exact finish-line checklist before stopping:

- Predict server integration uses documented routes only. citeturn9view0turn22view0
- Current Testnet deployment values live in `src/config/predict.ts` only. citeturn9view0turn0search7
- App uses the official Predict integration model: server for rendering, optional live stream for freshness, direct onchain reads around wallet flows. citeturn8search0turn22view0
- Wallet flow uses dApp Kit provider and hooks, with Testnet network guard. citeturn18view0turn18view1
- PTB builders use verified call targets only, or mark unresolved ones `TODO VERIFY`. citeturn10view1turn22view0
- Binary mint works on real Testnet.
- Binary redeem works on real Testnet.
- At least one range path is real and honestly represented.
- Vault supply and withdraw work on real Testnet or are clearly marked with verified current status.
- Every write flow shows risk preview and transaction preview before signing.
- Every success state shows transaction digest proof.
- Portfolio, PnL, and history refresh after write confirmation.
- Loading, empty, error, and success states exist for every screen.
- Demo mode, if enabled, never hides whether an action is live or simulated.
- Automated tests exist across unit, component, and E2E layers using Vitest, Testing Library, and Playwright. citeturn19view1turn18view6turn19view0turn19view2
- README and submission docs describe exactly what is implemented, what is verified, and what remains `TODO VERIFY`.
- No MUST task is silently skipped.
- If any unresolved protocol detail remains, it is isolated behind an adapter and clearly documented.

When all checklist items pass, Codex can treat PredictPilot as submission-ready.
