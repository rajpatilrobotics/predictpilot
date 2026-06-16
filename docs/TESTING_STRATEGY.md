# TESTING_STRATEGY

## Purpose and principles

PredictPilot needs a testing strategy that maximizes one thing above all else: reliable, judge-visible execution on Sui Testnet for DeepBook Predict. DeepBook Predict is currently documented as a Testnet integration surface, with provisional package IDs, object layouts, and entry points tied to the `predict-testnet-4-16` branch. The protocol supports binary positions, vertical ranges, a per-user `PredictManager`, an `OracleSVI` market object, and a shared vault with `PLP` shares. That means PredictPilot cannot rely on generic DeFi frontend testing alone. It must test the exact read model, PTB build model, wallet signing flow, and post-transaction refresh behavior that DeepBook Predict expects. citeturn6view0turn6view4turn13view0

The official integration model is also explicit about data responsibilities: render markets, history, portfolios, and vault summaries from the public Predict server; use Sui checkpoint or event streams for freshness; and use direct onchain reads around wallet flows that require authoritative state. This split is the core testing principle for PredictPilot. If the app or the tests confuse those layers, the demo will either look stale or fail at sign time. citeturn6view1turn13view0

Sui Overflow 2026 continues to position itself as Sui’s flagship global hackathon, with focused tracks, a DeepBook specialized prize pool, and a history of thousands of registrants and hundreds of project submissions across editions. PredictPilot therefore needs a test plan that optimizes for a short judge session, not for abstract theoretical coverage. A few flawless end to end flows matter more than a huge amount of shallow unit coverage. citeturn2view0turn22view0turn28view0

### Testing strategy overview

This document defines the full testing approach for PredictPilot across local development, CI, manual QA, and final hackathon demo rehearsal. It covers configuration, API adapters, PTB construction, wallet integration, real testnet execution, frontend reliability, portfolio analytics, and failure handling.

### Testing goals

- Prove that PredictPilot can connect a Sui wallet, read DeepBook Predict state, build accurate PTBs, preview risk and transaction details, and execute real testnet flows.
- Catch failures before wallet signing, especially wrong network, stale oracle state, missing `PredictManager`, insufficient `dUSDC`, invalid ask bounds, or unsupported trade parameters.
- Guarantee that the UI updates correctly after writes, including manager balances, positions, ranges, `PLP`, PnL, and transaction history.
- Make the highest value demo path repeatable in under five minutes.
- Keep contract surface assumptions centralized, typed, and easy to update when Testnet deployment values change.

### Testing non goals

- Full protocol level verification of DeepBook Predict itself. The protocol already has its own package structure, test helpers, and official docs. PredictPilot should trust the official contract surface and verify its own integration correctness, not attempt to re-prove protocol economics from scratch. citeturn12view0turn6view4
- Mainnet hardening for production volume.
- Margin or Spot composition flows that are outside the PredictPilot MVP.
- Stress testing custom indexers or self-hosted RPC infrastructure.
- Automated hardware wallet coverage beyond a narrow manual smoke pass.

### Hackathon winning testing philosophy

PredictPilot should use a sharp pyramid:

| Layer | Purpose |
|---|---|
| Unit | Fast checks for config, schemas, pure functions, PTB input shaping, risk math, formatting |
| Integration | App adapters, hooks, query flows, mock server behavior, onchain read composition |
| PTB validation | Build, dry-run, and pre-sign checks against real testnet state |
| E2E | Judge-critical flows in a real browser |
| Manual demo rehearsal | Final wallet, funding, and backup verification |

This is deliberate. Sui PTBs and DeepBook Predict flows are only truly trustworthy when the app can build a transaction from current onchain state and submit it through a real wallet. Sui’s PTB docs emphasize constructing transactions with the `Transaction` builder and letting the wallet handle the final build and execution path, while DeepBook Predict’s docs explicitly separate indexed rendering from authority-critical onchain reads. citeturn8search1turn6view1turn13view0

### Critical demo reliability requirements

For the final judge demo, all of the following must be true:

- The app opens directly on Testnet and visibly shows the current network.
- Wallet connection works on first attempt, or a backup wallet can be used immediately.
- The current Predict deployment config points to the current public Testnet targets and does not silently use old package IDs.
- `dUSDC` balance and `PredictManager` status become visible before any trade flow begins.
- Trade flows always show risk preview and transaction preview before the wallet prompt.
- Failed execution never leaves the user guessing. The UI must show a useful reason and a recovery step.
- After a successful transaction, the UI must refresh authoritative onchain state first, then refresh indexed server views, because the server is low-lag but not zero-lag. citeturn6view4turn13view0turn18view4

### Source of truth testing model

| Data surface | Use in app | Use in tests |
|---|---|---|
| Predict server | Markets, history, portfolio summary, vault UI | API adapter tests, schema tests, fallback tests |
| Sui event or checkpoint stream | Oracle freshness, live tape | freshness and subscription tests |
| Direct onchain reads | pre-sign validation, manager state, oracle authority state, post-transaction confirmation | PTB tests, transaction preview tests, post-write consistency checks |

DeepBook Predict’s official design and repository README both recommend this exact split. PredictPilot tests should enforce it so Codex cannot accidentally route everything through one slow or unreliable surface. citeturn6view1turn13view0

### Recommended testing stack

The recommended stack for PredictPilot is:

- Vitest for unit tests and fast integration tests.
- React Testing Library for component and hook tests.
- Vitest Browser Mode only for browser-specific units that fail or become misleading in jsdom.
- MSW for Predict server adapter tests and fallback behavior.
- Zod for runtime schema validation of untrusted server responses.
- Playwright for real browser E2E, judge-path runs, and responsive checks.
- Sui TypeScript SDK plus real Sui Testnet for PTB build and execution validation.
- GitHub Actions for deterministic CI on non-wallet layers.
- Manual QA for the final wallet signing path and backup-wallet rehearsal. citeturn18view1turn18view5turn26search4turn20search0turn18view3turn18view2turn18view6

## Environments and test infrastructure

### Current official integration targets

As of the current official DeepBook Predict contract information, the public Testnet integration targets are:

```env
PREDICT_NETWORK=testnet
PREDICT_PUBLIC_SERVER_URL=https://predict-server.testnet.mystenlabs.com
PREDICT_PACKAGE_ID=0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138
PREDICT_REGISTRY_ID=0x43af14fed5480c20ff77e2263d5f794c35b9fab7e2212903127062f4fe2a6e64
PREDICT_OBJECT_ID=0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a
PREDICT_QUOTE_TYPE=0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC
SUI_TESTNET_GRPC_URL=https://fullnode.testnet.sui.io:443
```

These values are official for the current Testnet docs, but the docs also say they are provisional and can change before Mainnet. PredictPilot tests must therefore load them from typed config, never hardcode them inside test bodies, and fail loudly when any required value is missing. citeturn6view4turn18view4turn6view0

### Configuration testing

Configuration tests must verify:

- required env values exist
- string fields that must be Sui object IDs or package IDs match a strict hex pattern
- URLs use HTTPS
- network is `testnet`
- quote type string is non-empty and names `DUSDC`
- unsupported or stale configs fail at startup, not mid-demo

Use a single `configSchema` with Zod and validate at app boot with `.safeParse()`. Zod’s documented `safeParse()` result style is ideal here because it returns either typed data or a structured error object without forcing `try/catch`. citeturn18view3

Recommended local file:

```ts
// src/config/schema.ts
import * as z from 'zod';

export const configSchema = z.object({
  PREDICT_NETWORK: z.literal('testnet'),
  PREDICT_PUBLIC_SERVER_URL: z.string().url(),
  PREDICT_PACKAGE_ID: z.string().regex(/^0x[a-fA-F0-9]+$/),
  PREDICT_OBJECT_ID: z.string().regex(/^0x[a-fA-F0-9]+$/),
  PREDICT_REGISTRY_ID: z.string().regex(/^0x[a-fA-F0-9]+$/),
  PREDICT_QUOTE_TYPE: z.string().min(1),
  SUI_TESTNET_GRPC_URL: z.string().url(),
});
```

### Environment variable testing

Create `tests/unit/config/env.test.ts` with cases such as:

- `rejects missing predict object id`
- `rejects non https predict server url`
- `rejects non testnet network`
- `rejects malformed dusdc quote type`
- `accepts current official testnet config`

### Source transport testing

Sui’s current docs recommend gRPC or GraphQL, and state that JSON-RPC is deprecated with migration required by July 2026. The current dApp Kit React quickstart uses `SuiGrpcClient` for Testnet. PredictPilot should therefore test the same transport class or abstraction it uses in the app and should not introduce a test-only JSON-RPC path that production never uses. citeturn14view0turn18view4

### Test environments

PredictPilot should maintain four explicit environments:

- **local unit**: no wallet, no chain, mostly pure logic and mocked adapters
- **local integration**: mocked Predict server plus mocked wallet bridge, real React tree
- **testnet PTB**: real config and read-only chain calls, dry-run or pre-sign validation
- **testnet execution**: real wallet and real signed transactions

Only the last one can certify the demo.

### Test data strategy

Use three buckets of test data:

- **static fixtures** for formatting, decoding, chart transforms, empty/error/loading states
- **recorded server payloads** for stable contract-aware UI tests, versioned by endpoint and date
- **live testnet reads** for PTB build, oracle status, balance assertions, and final smoke runs

Do not build permanent tests that depend on specific live oracle IDs unless the relevant screen or feature explicitly reads the current active oracles list first. The Predict server and protocol docs both recommend starting from current predict state and current oracle lists, not assuming a pre-known oracle. citeturn13view0

### Mock data strategy

Use mocks only for layers where they improve determinism:

- Predict server responses
- stale server responses
- transient 500s and 429s
- malformed payloads that trigger Zod failures
- no manager found
- no wallet connected
- wrong network

Use MSW with domain-based handlers and per-test overrides. MSW’s current docs support request interception in Node and browser contexts and allow runtime handler overrides with `server.use()`. citeturn20search4turn20search3turn20search5

### Testnet wallet strategy

PredictPilot should keep:

- one primary funded demo wallet
- one secondary funded backup wallet
- one emergency brand-new wallet with pre-tested connection path

Manual wallet testing should focus on Wallet Standard wallets discovered by dApp Kit. Sui’s wallet docs state that Wallet Standard wallets are auto-detected by dApp Kit without wallet-specific code, and the Connect UI can list them automatically. Hardware wallet signing is supported but should stay manual-only for this hackathon. citeturn19view0turn18view4

### Testnet funding strategy

DeepBook Predict’s docs state that builders can request Testnet tokens, including `DUSDC`, through the official Testnet token request form. PredictPilot should request enough `DUSDC` ahead of time, distribute to primary and backup demo wallets, and verify balances the day of the demo. citeturn6view0

Recommended manual funding policy:

- primary wallet: enough `DUSDC` for full demo, plus extra for one recovery run
- backup wallet: enough `DUSDC` for one full demo
- supplier wallet, if separate: enough `DUSDC` for vault `supply` and optional withdrawal
- SUI gas coin reserve on every wallet, tested the same day

## DeepBook Predict domain coverage

### DeepBook Predict integration testing

DeepBook Predict is an expiry-based protocol on Sui with current Testnet docs and a branch-specific source of truth. PredictPilot integration tests should verify that the app can locate the current `Predict` object, read current oracles, identify accepted quote assets, and map server data to UI-safe domain models. Predict server endpoints documented in the official repo README include predict state, oracle state, vault summary, manager summary, PnL, positions summary, and history feeds. citeturn6view0turn13view0

Core integration tests:

- `loads predict state from public server`
- `loads active oracle list from current predict object`
- `maps ask-bounds endpoint into ui trading constraints`
- `falls back to onchain reads for authority critical pre-sign checks`
- `rejects stale or malformed config before any request is made`

### API adapter testing

The official Predict server surface documented in the repo includes:

- `GET /status`
- `GET /predicts/:predict_id/state`
- `GET /predicts/:predict_id/oracles`
- `GET /oracles/:oracle_id/state`
- `GET /predicts/:predict_id/vault/summary`
- `GET /predicts/:predict_id/vault/performance?range=ALL`
- `GET /managers`
- `GET /managers/:manager_id/summary`
- `GET /managers/:manager_id/positions/summary`
- `GET /managers/:manager_id/pnl?range=ALL`
- history endpoints for prices, svi, mints, redeems, supplies, withdrawals, and trades
- config endpoints including quote assets and ask bounds citeturn13view0

Adapter test requirements:

- every endpoint has a typed adapter function
- every adapter decodes through Zod
- every adapter exposes structured error kinds, such as `NETWORK`, `BAD_SCHEMA`, `NOT_FOUND`, `STALE_DATA`
- adapters never leak raw backend payloads into UI components

### API schema validation testing

For each adapter:

- valid payload parses
- missing required field fails with `BAD_SCHEMA`
- unexpected enum or status fails with `BAD_SCHEMA`
- numeric strings and numbers normalize consistently, if the app intentionally supports both
- null or missing freshness timestamps trigger stale-state UI rather than a silent crash

### Sui PTB testing

Sui documents PTBs as the way to compose multiple commands in a single transaction, and recommends constructing them with the `Transaction` builder. The SDK can derive gas budget via dry-run, and wallet-facing apps should pass the transaction object rather than hand-building bytes in app code. PredictPilot PTB tests should therefore validate construction shape, object dependencies, and pre-execution simulation before any real signing path. citeturn8search1

PTB tests should cover:

- required shared objects and owned objects are present
- no object is accidentally used both as gas and as an input
- generic quote type is the configured `DUSDC` type
- `Clock` usage is correct where needed
- invalid object IDs fail before sign prompt
- simulation errors become readable transaction preview messages

### Transaction builder testing

The official Predict repo README lists the current crucial entry points for app integrations:

- `predict::create_manager`
- `predict::mint`
- `predict::redeem`
- `predict::mint_range`
- `predict::redeem_range`
- `predict::supply`
- `predict::withdraw`

It also documents the relevant manager deposit flow through `predict_manager::deposit`. PredictPilot should wrap these calls in local builder functions and test those wrappers directly, not scatter contract strings through UI code. citeturn13view0

Required builder tests:

- `buildCreateManagerTx returns non empty transaction`
- `buildDepositDusdcTx requires manager and coin inputs`
- `buildMintBinaryTx requires predict manager oracle market key quantity and clock`
- `buildRedeemBinaryTx rejects when quantity is zero`
- `buildMintRangeTx rejects lower>=higher`
- `buildSupplyVaultTx requires quote asset amount`
- `buildWithdrawVaultTx requires plp amount or share amount TODO VERIFY chosen UX representation`

### Wallet integration testing

Sui’s wallet docs say Wallet Standard wallets are auto-discovered by dApp Kit. The dApp Kit quickstart shows `DAppKitProvider`, `ConnectButton`, `useCurrentAccount`, `useCurrentWallet`, and transaction execution via `useDAppKit`. Auto-connect is enabled by default in dApp Kit’s connect action docs. PredictPilot should test both first-connect and restored-session behavior. citeturn19view0turn18view4turn19view1

Wallet tests must cover:

- no wallet connected state
- connect modal opens
- connect succeeds
- disconnect clears trading state
- auto-connect restores prior session
- account switch refreshes manager lookup
- wrong network warning blocks action CTAs
- hardware wallet path is marked manual-only but does not break UI copy or transaction preparation

### dUSDC testing

DeepBook Predict’s current quote asset is documented as `DUSDC`, and builders can request Testnet tokens for integration testing. PredictPilot must treat `DUSDC` as the only tradeable quote asset unless official docs change. citeturn6view4turn6view0

`dUSDC` tests:

- balance loads from wallet/account state and any manager state needed by UX
- zero balance state shows funding guidance
- deposit preview computes deducted wallet amount and credited manager amount
- withdraw preview computes deducted manager amount and returned wallet amount
- insufficient balance blocks submit and shows specific copy
- post-deposit and post-withdraw UI reflect updated values after confirmation

### PredictManager testing

Official docs describe `PredictManager` as a per-user shared account object that wraps a DeepBook `BalanceManager`, stores quote balances, and tracks positions internally. Each user should create one manager and reuse it. Positions and vertical ranges are not standalone objects. citeturn17view0turn13view0

Required tests:

- manager lookup by owner succeeds
- no manager state routes user to create-manager flow
- create-manager flow builds correct PTB
- successful creation stores current manager reference in app state
- existing manager is reused on next session
- positions and ranges are read from manager summary, never searched as separate objects

### OracleSVI testing

Official docs define `OracleSVI` as the market state for one underlying and one expiry, containing spot, forward, SVI params, activation state, last update timestamp, and settlement price after expiry. The lifecycle is active before expiry, pending settlement at expiry, and settled after the first post-expiry price update. Mints require a live oracle. Redeems can use quoteable live or settled state. citeturn7search5turn6view1

Required oracle tests:

- active oracle displays latest spot, forward, and SVI data
- inactive oracle blocks minting
- stale oracle freshness threshold shows prominent warning
- settled oracle allows redeem path but blocks mint
- ask bounds display loads alongside oracle state
- settlement copy appears when oracle is no longer live

### Data freshness testing

The Predict design recommends using the public server for render-ready data, event streams for second-level updates, and onchain reads for write-critical state. PredictPilot should explicitly label freshness in tests:

- server freshness badge
- oracle timestamp age
- last successful refresh time
- currently refreshing state
- fallback mode when live stream fails citeturn6view1turn13view0

Required tests:

- stale server data badge appears when age exceeds threshold
- stale oracle warning appears with action disabled for mint
- refresh action retries correctly
- live stream loss falls back to polling or last-known render without crashing
- trade preview always uses freshest authoritative data available before sign

### Oracle freshness testing

Define local app thresholds, for example:

- green: fresh enough for trading
- amber: close to stale, allow view, block or warn on submit depending on operation
- red: stale, block mint, allow only passive views or settled redeem paths

Because the official docs do not prescribe exact UI thresholds, the thresholds are an app decision and should be centralized in config as `TODO VERIFY` product constants.

### Risk preview testing

Predict pricing and risk are driven by oracle fair prices, spreads, utilization adjustments, ask bounds, and vault exposure checks. The docs state that global and per-oracle ask bounds can prevent mints outside configured limits, and the vault asserts total exposure stays within `max_total_exposure_pct` of vault balance. citeturn6view1

PredictPilot risk preview tests must cover:

- quantity zero or negative
- lower strike greater than or equal to upper strike for ranges
- missing manager
- insufficient manager quote balance
- stale oracle
- ask price outside bounds
- high utilization or vault risk warnings, if surfaced by the server or derived inputs
- redeem quantity greater than owned quantity
- withdraw request larger than available manager or vault-withdrawable amount

### Transaction preview testing

Transaction preview is the line before the user commits. It should show:

- intended action
- network
- account
- quote asset type
- amount
- manager id
- oracle id
- expiry and strike or range
- expected position or share delta
- warnings
- expected post-transaction refresh targets

Required tests:

- preview renders for every supported operation
- preview is blocked when dry-run or validation fails
- preview stores enough information for post-sign success to update the right queries
- wallet prompt is never opened if preview prerequisites fail

### Binary mint testing

Official flow information shows `predict::mint<Quote>` uses `Predict`, `PredictManager`, `OracleSVI`, `MarketKey`, `quantity`, and `Clock`; it debits quote balance, increases manager long quantity, and emits `PositionMinted`. citeturn13view0

Required tests:

- binary mint preview loads
- mint blocked when oracle not live
- mint blocked on insufficient `dUSDC`
- mint blocked on invalid strike or direction input
- mint execution succeeds on testnet
- position quantity increases after execution
- manager quote balance decreases after execution
- transaction history shows minted event after indexing lag clears

### Binary redeem testing

The official repo documents `predict::redeem<Quote>` and `predict::redeem_permissionless<Quote>` for settled positions, with behavior that decreases manager quantity and pays out quote asset into the manager. citeturn13view0

Required tests:

- redeem preview loads from owned quantity
- redeem blocked when selected quantity exceeds owned quantity
- partial redeem updates remaining quantity correctly
- settled redeem path works
- live redeem path TODO VERIFY depending on current oracle state and UI routing
- manager quote balance increases after redeem
- history and portfolio refresh after lag window

### Range mint testing

Official flow for `predict::mint_range<Quote>` uses `Predict`, `PredictManager`, `OracleSVI`, `RangeKey`, `quantity`, and `Clock`, then debits quote and increases range quantity. citeturn13view0

Required tests:

- lower and upper strike displayed and validated
- lower < upper required
- preview computes resulting range exposure
- execution succeeds on testnet
- manager range quantity increases after success
- manager quote balance decreases after success

### Range redeem testing

Official flow for `predict::redeem_range<Quote>` decreases range quantity and pays quote asset into the manager. citeturn13view0

Required tests:

- range holdings list is readable and selectable
- redeem preview shows owned quantity and selected quantity
- over-redeem blocked
- execution succeeds on testnet
- manager range quantity decreases and quote balance updates

### Vault and PLP testing

DeepBook Predict docs say the vault takes the opposite side of every trade and LPs interact through `predict::supply` and `predict::withdraw`, which mint and burn `PLP` shares. `PLP` represents a proportional claim on vault value, subject to vault utilization and withdrawal constraints. citeturn6view1turn7search8turn13view0

Vault tests must cover:

- vault summary loads
- performance series loads
- `PLP` balance loads
- supply preview loads
- withdraw preview loads
- unavailable withdrawal amount is blocked with explanation
- supply and withdraw update vault summary and wallet state

### Vault supply testing

Official behavior for `predict::supply<Quote>` transfers quote into the vault, mints `PLP`, and emits `Supplied`. citeturn13view0

Required tests:

- supply preview shows amount in and estimated `PLP` shares out
- insufficient `dUSDC` blocks submit
- supply execution succeeds on testnet
- `PLP` balance appears or increases
- vault value summary refreshes

### Vault withdraw testing

Official behavior for `predict::withdraw<Quote>` burns `PLP`, returns quote from the vault, and emits `Withdrawn`. Docs also note withdrawals only succeed when value is available after covering max payout. citeturn6view1turn13view0

Required tests:

- withdraw preview shows shares in and quote out
- over-withdraw blocked
- constrained liquidity warning appears when withdrawal cannot be satisfied
- withdraw execution succeeds on testnet
- `PLP` balance decreases
- quote balance updates correctly

### Portfolio analytics testing

The server docs expose manager summary, positions summary, and PnL endpoints, and the design docs recommend using the server for portfolio rendering. PredictPilot portfolio tests should verify successful aggregation across binary positions, range positions, and LP exposure. citeturn13view0turn6view1

Required tests:

- empty portfolio renders gracefully
- non-empty portfolio groups holdings by active, settled, LP, and historical
- after mint, new position appears
- after redeem, quantity decreases or row disappears when zero
- after supply, LP section updates
- after withdraw, LP section updates

### PnL testing

Use `GET /managers/:manager_id/pnl?range=ALL` as the default indexed source if available, and label any derived frontend-only approximations clearly. citeturn13view0

Required tests:

- pnl endpoint success displays chart/table
- no pnl data renders empty state
- malformed pnl payload fails safely
- date range switch updates data
- post-transaction refresh eventually updates pnl panel

### Transaction history testing

The official surface includes history endpoints for positions minted, positions redeemed, ranges minted, ranges redeemed, LP supplies, LP withdrawals, and per-oracle trades. citeturn13view0

Required tests:

- history page loads recent actions
- filters work by action type
- newly confirmed transaction appears after index lag
- if history endpoint fails, the app shows fallback copy and at least the recent digest from local success state

## Frontend reliability and user experience testing

### Frontend component testing

Component tests should focus on high-value trading UI primitives:

- wallet status badge
- network badge
- `dUSDC` balance card
- manager status card
- oracle freshness pill
- market selector
- strike selector
- range selector
- risk preview panel
- transaction preview panel
- portfolio table
- pnl chart container
- transaction history table
- toast system
- error banners

Use React Testing Library because it encourages testing the DOM the way users interact with it, not component internals. Prefer role, label, and text queries. Use `data-testid` only for highly dense trading cells where semantic queries become too ambiguous. citeturn26search4turn26search0turn26search10

### Hook testing

Test hooks for:

- current config load
- current wallet/account/network
- manager discovery
- oracle state fetch
- market list fetch
- portfolio summary fetch
- transaction preview generation
- post-transaction refresh orchestration

For TanStack Query hooks, create a fresh `QueryClient` and wrapper per test or clear it between tests. The official docs warn that sharing a client across tests without cleanup can cause cross-test influence, and recommend turning retries off in tests to avoid timeout-heavy failure cases. citeturn25view1turn25view2

### State management testing

Whatever local state strategy PredictPilot uses, likely React state plus TanStack Query plus small local stores, should be tested for:

- selected oracle reset when market universe changes
- manager id reset when account changes
- preview state reset after success
- stale preview rejected if inputs change after generation
- transaction success state not leaking into next action

### Loading state testing

Required loading states:

- initial app boot
- wallet detection
- markets list load
- oracle detail load
- manager lookup
- transaction preview generation
- history refresh
- portfolio refresh
- post-transaction synchronization

Loading tests should ensure:

- no layout collapse
- action buttons disabled when required
- spinners do not trap focus
- repeated clicks do not produce duplicate requests

### Empty state testing

Required empty states:

- no wallet connected
- no manager found
- zero `dUSDC`
- zero positions
- zero `PLP`
- no history
- no active oracle
- no data returned for chart range

Every empty state should include an action path, such as connect wallet, create manager, request Testnet tokens, refresh, or switch market.

### Error state testing

Required error state classes:

- config error
- wallet connection denied
- wrong network
- Predict server unavailable
- server schema mismatch
- oracle stale
- preview build failure
- wallet reject
- onchain execution failure
- post-transaction refresh failure

### Success state testing

Success states should verify:

- digest shown
- short success copy present
- relevant cards refresh
- local pending banners clear
- history row eventually appears
- “view on explorer” link TODO VERIFY if explorer URL pattern is part of app config

### Accessibility testing

Accessibility work should include both automated and manual checks. Axe is designed for automated accessibility testing and Deque’s rule docs note that automated checks still need manual checks as well. PredictPilot should run automated checks on core pages and then do manual keyboard and screen-reader-oriented smoke passes. citeturn27search0turn27search2turn27search3

Required accessibility checks:

- all buttons have discernible names
- all inputs have labels
- risk warnings and error alerts use accessible roles
- color is not the only signal for stale or dangerous states
- tables remain navigable
- modals trap focus and restore focus on close
- wallet dialogs and toasts do not break reading order
- keyboard-only journey can complete a preview flow

Recommended tooling:

- `@axe-core/playwright` for E2E scans
- optional `jest-axe` or equivalent in component tests, TODO VERIFY exact package choice
- semantic queries in Testing Library

### Responsive UI testing

PredictPilot is a terminal-like product, but it still needs responsive reliability for judge laptops and smaller browser windows.

Required responsive widths:

- 1440px and above
- 1280px
- 1024px
- 768px
- 390px or similar mobile width

Required checks:

- connect button visible
- network warning visible
- preview panels accessible
- tables horizontally scroll without clipping critical values
- `risk preview` and `transaction preview` remain readable
- no modal exceeds viewport height without internal scroll

### Security testing

PredictPilot’s frontend security focus is narrow and practical:

- no private key handling in app code
- no raw secrets bundled into client
- all untrusted server payloads pass through schema validation
- all object IDs and addresses are treated as untrusted input
- transaction preview must present the exact action before sign
- repeated click protection prevents accidental duplicate submissions
- URL query params cannot silently trigger signing flows

Sui wallet docs emphasize self-custody, where the private key remains under the user’s control and wallets authorize transactions on the user’s behalf. PredictPilot should respect that boundary completely. citeturn19view0

### Regression testing

Maintain a permanent suite for the judge-critical path:

- app boot
- wallet connect
- manager discover or create
- deposit preview
- binary mint preview
- binary mint success
- portfolio refresh
- history refresh

Any bug found during rehearsal must become a regression test before the next build.

### Smoke testing

Every deployed preview build should run a smoke suite that checks:

- app shell boots
- public server reachable
- config loads
- wallet modal opens
- at least one current oracle row renders
- preview UI can be opened without signing

### End to end testing

Use Playwright for E2E because it is built for browser testing with auto-wait and web-first assertions, which are critical for reducing flakiness in async trading interfaces. citeturn18view2turn18view6

PredictPilot E2E categories:

- shell and network
- wallet and account
- market selection
- preview-only flows
- mock-signed success flows for CI
- manual real-wallet sign flows for final rehearsal

## Manual QA and demo operations

### Manual QA checklist

Before each serious demo run, verify:

- current Testnet config matches official docs
- primary wallet connects
- backup wallet connects
- `dUSDC` visible
- gas balance visible
- current manager exists, or create-manager path works
- at least one active oracle is visible
- oracle freshness is green or acceptable
- binary mint preview works
- binary mint execution works
- portfolio refresh works
- history refresh works
- vault summary loads
- optional supply preview works
- optional supply execution works
- one forced failure path still shows a helpful error

### Demo rehearsal checklist

Run this exact order:

1. hard refresh app
2. confirm network badge says Testnet
3. connect primary wallet
4. verify manager and balances
5. open one active oracle
6. open binary mint preview
7. sign a small trade
8. show digest and success toast
9. show portfolio update
10. show history update
11. optionally show vault page and `PLP`
12. disconnect and reconnect backup wallet as contingency rehearsal

### Failure mode testing

Failure modes that must be rehearsed manually:

- wallet rejects transaction
- wrong network selected
- no active manager
- no `dUSDC`
- stale oracle
- server unavailable
- transaction succeeds onchain but server takes time to reflect it
- wallet extension temporarily missing after refresh
- backup wallet account mismatch

### Demo mode testing

If PredictPilot includes a demo mode, it must never fake the final claim of real execution. Required tests:

- demo mode labels are explicit
- demo mode can populate UI if server data is unavailable
- switching out of demo mode restores live server and chain reads
- real signed transaction flow always shows true digest and live state
- demo mode does not suppress network badge or testnet disclaimer

### Common bugs Codex must prevent

- hardcoded old package ids in tests
- positions treated like standalone objects instead of manager balances
- assuming the Predict server is zero-lag after writes
- allowing mint on stale or inactive oracle
- allowing range with invalid strike ordering
- losing selected manager after account switch
- duplicate transactions from double-click
- query cache leaking across tests
- wallet mocks that do not behave like Wallet Standard wallets
- silent schema drift when server payload changes
- brittle E2E selectors tied to CSS or chart internals
- asserting exact live oracle IDs in tests
- using the wrong object as gas and trade input in PTBs

## Codex implementation details

### Required test file structure

```text
tests/
  unit/
    config/
      env.test.ts
      deployment-targets.test.ts
    schemas/
      predict-state.schema.test.ts
      oracle-state.schema.test.ts
      manager-summary.schema.test.ts
      pnl.schema.test.ts
      history.schema.test.ts
    domain/
      ask-bounds.test.ts
      oracle-freshness.test.ts
      risk-preview.test.ts
      transaction-preview.test.ts
      portfolio-normalization.test.ts
      pnl-normalization.test.ts
    ptb/
      build-create-manager.test.ts
      build-deposit-dusdc.test.ts
      build-withdraw-dusdc.test.ts
      build-binary-mint.test.ts
      build-binary-redeem.test.ts
      build-range-mint.test.ts
      build-range-redeem.test.ts
      build-vault-supply.test.ts
      build-vault-withdraw.test.ts

  integration/
    api/
      predict-server.adapters.test.ts
      predict-server.failures.test.ts
    hooks/
      usePredictState.test.tsx
      useOracleState.test.tsx
      usePredictManager.test.tsx
      usePortfolioSummary.test.tsx
      useTransactionPreview.test.tsx
    components/
      wallet-status-card.test.tsx
      network-warning.test.tsx
      manager-status-card.test.tsx
      oracle-status-panel.test.tsx
      risk-preview-panel.test.tsx
      transaction-preview-panel.test.tsx
      portfolio-table.test.tsx
      pnl-panel.test.tsx
      history-table.test.tsx
    states/
      loading-states.test.tsx
      empty-states.test.tsx
      error-states.test.tsx
      success-states.test.tsx
    accessibility/
      core-pages.a11y.test.tsx

  e2e/
    smoke/
      app-shell.spec.ts
      wallet-connect-ui.spec.ts
    judge-path/
      create-or-find-manager.spec.ts
      binary-mint-preview.spec.ts
      binary-mint-success.spec.ts
      portfolio-refresh.spec.ts
      history-refresh.spec.ts
    vault/
      vault-summary.spec.ts
      supply-preview.spec.ts
    responsive/
      desktop.spec.ts
      tablet.spec.ts
      mobile.spec.ts

  live/
    testnet/
      config-live.test.ts
      predict-state-live.test.ts
      oracle-live.test.ts
      manager-live.test.ts
      ptb-dryrun-binary-mint.test.ts
      ptb-dryrun-range-mint.test.ts
      ptb-dryrun-supply.test.ts

src/
  test/
    fixtures/
    factories/
    mocks/
      handlers/
      server.ts
    utils/
      render.tsx
      createQueryClient.ts
      createWalletMock.ts
      createLiveConfig.ts
```

### Frontend component testing guidance

Use a custom `renderWithProviders()` helper that includes:

- `DAppKitProvider` or a local wallet test harness
- `QueryClientProvider`
- router provider
- theme provider
- feature flags if used

React Testing Library docs recommend custom render helpers to reduce repeated setup, and TanStack Query docs recommend isolated `QueryClient` instances per test. citeturn26search3turn25view1

### Recommended test commands

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:unit": "vitest run tests/unit",
    "test:integration": "vitest run tests/integration",
    "test:browser": "vitest --browser=chromium",
    "test:e2e": "playwright test",
    "test:e2e:headed": "playwright test --headed",
    "test:smoke": "playwright test e2e/smoke",
    "test:judge": "playwright test e2e/judge-path",
    "test:live": "vitest run tests/live/testnet",
    "test:a11y": "playwright test --grep @a11y",
    "test:ci": "pnpm test:unit && pnpm test:integration && pnpm test:e2e",
    "qa:demo": "pnpm test:smoke && pnpm test:judge"
  }
}
```

### CI testing pipeline

CI should not attempt real wallet signing. Instead, use this pipeline:

1. install dependencies
2. lint and typecheck
3. run unit tests
4. run integration tests with MSW
5. run Playwright smoke and preview-only E2E
6. run accessibility scan on core pages
7. publish test report artifacts

Nightly or manual pipeline:

1. run `tests/live/testnet`
2. verify current official config still works
3. optional preview PTB dry-runs against live testnet state
4. send failure alert to repository issues or notifications TODO VERIFY preferred method

### Example test case names

Use explicit names:

- `shows wrong network warning when wallet chain is not testnet`
- `disables mint submit when oracle freshness is stale`
- `reuses existing predict manager for connected account`
- `parses manager positions summary from predict server`
- `shows useful fallback when pnl endpoint returns 500`
- `builds binary mint transaction with predict manager oracle market key and clock`
- `refreshes portfolio after successful binary mint`
- `renders transaction digest after wallet execution success`
- `keeps history page usable while server indexer catches up`

### Local TypeScript pseudocode for live test helper

```ts
// local application test utility, not protocol code
export async function assertPreviewCanProceed(input: PreviewInput) {
  const config = loadTypedConfig();
  const chain = createSuiClient(config);
  const server = createPredictServerClient(config);

  const [predictState, oracleState, managerSummary] = await Promise.all([
    server.getPredictState(config.PREDICT_OBJECT_ID),
    server.getOracleState(input.oracleId),
    server.getManagerSummary(input.managerId),
  ]);

  const risk = computeRiskPreview({
    predictState,
    oracleState,
    managerSummary,
    input,
  });

  if (!risk.canProceed) {
    return { ok: false, reason: risk.reason };
  }

  const tx = buildBinaryMintTx({
    config,
    input,
    oracleState,
  });

  const simulation = await dryRunOrDevInspect(tx); // TODO VERIFY concrete implementation by installed SDK version
  return normalizeSimulationResult(simulation);
}
```

### Required test scenarios

The following scenarios are mandatory and must exist as named tests, either automated or explicitly manual-only:

- app loads on testnet
- wallet connects successfully
- wrong network warning appears
- `dUSDC` balance is shown
- `PredictManager` is discovered
- `PredictManager` creation flow works
- `dUSDC` deposit preview works
- `dUSDC` deposit execution works
- `dUSDC` withdraw preview works
- `dUSDC` withdraw execution works
- `OracleSVI` data loads
- stale oracle warning appears
- ask bounds are shown
- binary mint preview works
- binary mint execution works
- binary redeem preview works
- binary redeem execution works
- range mint preview works
- range mint execution works
- range redeem preview works
- range redeem execution works
- vault summary loads
- `PLP` balance loads
- vault supply preview works
- vault supply execution works
- vault withdraw preview works
- vault withdraw execution works
- portfolio updates after transaction
- transaction history updates after transaction
- risk preview catches invalid or dangerous inputs
- transaction preview shows PTB details before signing
- failed transaction shows useful error
- API failure shows fallback UI
- demo mode works without hiding real testnet execution

### Acceptance criteria

PredictPilot passes this testing strategy when all of the following are true:

- all config and schema tests pass
- all judge-path PTB builders pass local validation tests
- all adapter and hook tests pass with retries disabled and isolated query clients
- smoke E2E passes on every preview build
- live testnet dry-run suite passes against the current official deployment config
- manual wallet signing rehearsal succeeds on at least two wallets
- at least one full binary mint flow is demonstrated end to end on real testnet
- portfolio and history refresh correctly after the transaction
- one intentional failure case is demonstrated cleanly and recoverably
- all Testnet-specific config values remain centralized and replaceable
- all uncertain protocol details are explicitly marked `TODO VERIFY` rather than guessed

### Final testing checklist

Use this as the final pre-submission list:

- [ ] current official Predict Testnet config loaded from typed env
- [ ] package id, predict object id, registry id, and quote type not hardcoded in test bodies
- [ ] wallet connection path tested on primary and backup wallet
- [ ] wrong network path tested
- [ ] `dUSDC` funding verified
- [ ] `PredictManager` exists for primary wallet
- [ ] create-manager fallback path works
- [ ] binary mint preview works
- [ ] binary mint execution works
- [ ] binary redeem path tested
- [ ] range path tested
- [ ] vault summary and `PLP` path tested
- [ ] supply and withdraw preview tested
- [ ] portfolio refresh tested
- [ ] pnl panel tested
- [ ] transaction history tested
- [ ] stale oracle warning tested
- [ ] ask-bounds display tested
- [ ] error banner copy tested
- [ ] success toast and digest display tested
- [ ] loading, empty, and error states tested on all core screens
- [ ] keyboard-only smoke pass completed
- [ ] automated accessibility scan completed
- [ ] responsive smoke pass completed
- [ ] CI green on unit, integration, smoke E2E
- [ ] live testnet smoke pass completed on the day of demo
- [ ] backup wallet and backup browser ready
- [ ] demo mode, if present, clearly labeled and never confused with real execution
- [ ] all unverified protocol specifics marked `TODO VERIFY`

### Final guidance for Codex

Build tests in the same order judges will experience the product:

1. shell and wallet
2. manager and `dUSDC`
3. oracle and market intelligence
4. risk preview and transaction preview
5. binary mint success
6. portfolio and history refresh
7. optional vault and `PLP`

Do not chase 100% line coverage if it weakens real integration confidence. For PredictPilot, the winning signal is this: a judge can see a real Sui Testnet wallet, a real DeepBook Predict market, a clear risk preview, a clear transaction preview, a signed execution, a digest, and an updated portfolio in one smooth sequence. That is the bar this strategy is designed to enforce. citeturn16view0turn6view1turn13view0