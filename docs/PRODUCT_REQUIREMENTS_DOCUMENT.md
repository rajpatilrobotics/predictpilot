# PredictPilot Product Requirements Document

## Document status and source of truth

PredictPilot is defined here as a **DeepBook Predict intelligence and execution terminal** built to compete in **Sui Overflow 2026**, specifically against the **DeepBook specialized track**, which the official hackathon site describes as a track for trading or liquidity applications powered by DeepBook’s onchain orderbook. The current official DeepBook Predict documentation describes Predict as an expiry-based protocol on Sui that lets users mint and redeem binary positions and vertical ranges against oracle-driven prices, while liquidity providers supply quote assets to a shared vault and receive `PLP` LP shares. This PRD therefore assumes that a competitive entry must demonstrate **real protocol-native execution and clear operator UX**, not just themed charts or a generic prediction-market shell. citeturn27view0turn17view0turn1view5

The public Sui Overflow 2026 materials are **not fully internally consistent** at the time of writing. The live site headline says **“May - August, 2026”** and **“Registration is open,”** while surfaced FAQ and timeline fragments still reference **pre-registration** and **2025 demo/submission dates**. Treat exact 2026 deadlines, handbook-only judging language, and any final submission mechanics as `TODO VERIFY` before locking the repo and video script. citeturn27view0turn25search1

As of the current official Testnet integration surface, PredictPilot should default to `Sui Testnet`, the public Predict server `https://predict-server.testnet.mystenlabs.com`, Predict package `0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138`, Predict registry `0x43af14fed5480c20ff77e2263d5f794c35b9fab7e2212903127062f4fe2a6e64`, Predict object `0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a`, current quote asset `0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC`, and `PLP` type `0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138::plp::PLP`. The docs explicitly say these values are pinned to branch `predict-testnet-4-16` and are provisional before Mainnet, so every environment file and demo wallet script must treat them as versioned configuration rather than timeless constants. citeturn18view0turn17view0

Context note: this draft could not directly inspect your local `Sui hack-2026(4).md`, `AGENTS.md`, `PROJECT_VISION.md`, or `MVP_SCOPE.md` from the available tool environment. Before freezing the final repo, reconcile this PRD against those local files and the latest handbook.

> `TODO VERIFY`
>
> - Exact Sui Overflow 2026 submission deadline, demo-day dates, and scoring language.
> - Any Predict package/object changes published after branch `predict-testnet-4-16`.
> - Whether the hackathon requires specific disclosure text, logo usage, or submission metadata beyond the public site.

## Product summary and strategic goals

**Product summary.** PredictPilot is a professional, terminal-style web application that helps users **understand**, **preview**, and **execute** DeepBook Predict strategies on Sui Testnet. It is not only a market browser. It is a decision-and-execution surface organized around the official Predict integration model: use the public Predict server for render-ready market, vault, portfolio, and history data; use Sui checkpoints or events when the UI needs lower-latency oracle freshness; and use direct onchain object reads immediately before or after wallet flows that require authoritative state. The product must make the protocol’s real operating model legible: one reusable `PredictManager` per user, internal position and range balances rather than standalone position objects, an `OracleSVI` lifecycle that controls tradeability, and a vault that takes the opposite side of trades while minting and burning `PLP` for LPs. citeturn17view0turn15view0turn15view1turn15view3turn7view0

**Hackathon-winning product thesis.** Sui Overflow winners consistently skew toward products that turn Sui-native primitives into clear user value instead of shipping thin wrappers. In 2025, the DeFi track rewarded products centered on vaults, capital efficiency, and composability, while the Explorations track awarded prediction-oriented products such as Skepsis and PredictPlay. In 2024, top or shortlisted DeFi and wallet projects emphasized routing, custody and execution UX, hedging, Telegram interfaces, and DeepBook-adjacent market-making and automation. PredictPilot should follow that pattern by combining real DeepBook Predict execution with operational clarity, fast trade understanding, and a polished demo narrative. citeturn23view3turn23view4turn24view3turn24view1turn24view2

**Core value proposition.** PredictPilot should answer three questions faster than the raw protocol surfaces do: **What market exists right now?** **What will this action cost or pay?** **What changed in my account and in the vault after I signed?** The product’s value is therefore not “another prediction market frontend.” Its value is a trusted execution layer over a protocol whose current docs already expose rich but fragmented surfaces: public market state, portfolio summaries, vault performance, price history, SVI history, and onchain transaction entry points for trading and liquidity. citeturn18view0turn30view0turn14view1

**Product goals.**

- Ship a live, wallet-signed, Testnet-capable DeepBook Predict app that proves real user flows end to end.
- Make DeepBook Predict understandable to judges in under five minutes.
- Show both sides of the protocol: trader flows and liquidity-provider flows.
- Use Sui-native UX patterns that respect shared objects, PTB composition, wallet confirmation, and object-state refresh.
- Produce a repo and demo that Codex can keep extending without inventing unsupported contract behavior.

**Non-goals.**

- Do not build a generic AMM prediction market.
- Do not build a pure analytics dashboard with no signed execution.
- Do not build a leveraged margin product in the MVP.
- Do not target Mainnet in the MVP.
- Do not introduce a custom oracle network, proprietary indexing stack, or autonomous bot trading loop unless the core app is already complete and stable.
- Do not fabricate “AI signals,” Greeks, or strategy scores unless the computation path is explicit and reproducible.

**What PredictPilot is.**

- A DeepBook Predict terminal.
- A market-intelligence and execution workspace.
- A judge-friendly explanation layer for `Predict`, `PredictManager`, `OracleSVI`, the vault, and `PLP`.
- A live Testnet app with verified protocol surfaces.

**What PredictPilot is not.**

- A meme prediction site.
- A fake-demo simulator.
- A custom derivatives engine.
- A passive dashboard disconnected from the wallet and protocol.

**North star metric.** A successful judge session is one in which a user can connect a wallet, confirm correct Testnet configuration, create or reuse a `PredictManager`, fund it with `DUSDC`, preview and execute a binary or range trade, and then see portfolio and history refresh correctly after the transaction.

**High-level success metrics.**

- All demo-critical flows pass on live Testnet using current verified package IDs.
- Every trade or LP action has a human-readable preview before signature.
- Every successful write visibly refreshes the relevant account, market, and vault state.
- No unsupported path is presented as if it were supported.
- All unverified protocol assumptions are labeled `TODO VERIFY`.

## Users, scope, and prioritized features

The product must hide genuine protocol complexity. Official docs make clear that each user should create one reusable `PredictManager`; positions and ranges are internal balances, not separate objects; oracle lifecycle state determines whether minting is allowed; and applications should split reads across the public server, event streams, and direct onchain reads as freshness needs change. PredictPilot’s scope must therefore center on helping users navigate those exact complexities rather than abstracting them away so fully that the DeepBook Predict nature of the product disappears. citeturn7view0turn15view1turn15view4turn14view2

**Target users and personas.**

- **Trader persona.** Wants to understand an active oracle, choose a strike or bounded range, preview cost and potential payout, and sign a trade confidently.
- **LP persona.** Wants to understand vault value, exposure posture, performance, and `PLP` entry/exit mechanics.
- **Judge persona.** Wants to see that the app is truly DeepBook-native, technically correct, strategically coherent, and polished.
- **Builder persona.** Wants a repo whose requirements clearly separate verified protocol facts from app-level product decisions.

**User problems.**

- The protocol’s state model is unfamiliar: one reusable manager, internal balances, shared objects, and lifecycle-sensitive oracles.
- Tradeability is not obvious from raw object existence; an oracle may exist but still be inactive or pending settlement.
- Prices, SVI parameters, quote balances, and vault state come from multiple surfaces with different freshness guarantees.
- Testnet values are provisional and package IDs can change.
- Even a successful transaction can look confusing unless the app refreshes both direct object state and indexed server state afterward. citeturn15view1turn18view0turn14view2turn13view2

**MVP requirements.** The MVP must prove **real DeepBook Predict intelligence and execution**. “Intelligence” means the user can interpret market state, oracle lifecycle, strike/range choices, and expected trade outcomes. “Execution” means the user can create or reuse the manager, fund it with the official quote asset, and complete at least one trade and one LP flow on Testnet.

**Must-have features.**

- Read-only market discovery using the official Predict server.
- Wallet connection with hard Testnet guardrails.
- Verified environment surface showing package/object IDs.
- Manager discovery and creation.
- `DUSDC` funding path into `PredictManager`.
- Binary position preview and execution.
- Binary position redeem flow.
- Range preview and execution.
- Range redeem flow.
- LP supply flow for `PLP`.
- LP withdraw flow with clear availability constraints.
- Portfolio summary, position summary, and PnL display.
- Trade and LP history.
- Explicit risk, expiry, and settlement-state messaging.
- Deterministic post-transaction refresh behavior.
- A judge-mode walkthrough with curated happy-path data.

**Should-have features.**

- Live oracle tape based on Sui event or checkpoint subscriptions.
- Saved workspace layout or watchlist.
- One-click demo account checklist for judges.
- Exportable transaction summary or shareable demo screenshots.
- Clear “what changed” diff after each confirmed transaction.

**Could-have features.**

- Strategy templates such as “up strike ladder,” “range around forward,” or “LP then hedge.”
- Optional explanatory overlays for SVI and strike selection.
- zkLogin, passkey, or sponsored/gasless onboarding only if fully tested on the final demo path.
- A simulation panel that uses the same verified preview surfaces and clearly labels itself as hypothetical.

**Do not build.**

- A separate AMM or custom matching engine.
- Margin, leverage, liquidation, or borrow logic.
- Autonomous execution without explicit user confirmation.
- Social feeds, gamified badges, or tokenomics unrelated to DeepBook Predict execution.
- Unverified “AI recommendation” features.
- Mainnet mode in the MVP.
- Any UI surface for `Registry` operator/admin entry points, because the official docs state those are governance and operator surfaces rather than normal app-integration surfaces. citeturn7view2

**Included user flows.**

1. Connect wallet, confirm Testnet, view verified deployment values.
2. Discover or reuse a `PredictManager`.
3. Acquire or hold `DUSDC`; deposit it into the manager.
4. Browse active oracles, strikes, ranges, and latest market state.
5. Preview and mint a binary position.
6. Preview and mint a range.
7. Redeem a live or settled position.
8. Redeem a range.
9. Supply `DUSDC` to the vault and receive `PLP`.
10. Withdraw liquidity with clear available-withdrawal messaging.
11. Refresh portfolio, vault, and history views after every write.

**Excluded user flows.**

- Protocol administration.
- Oracle operation, activation, settlement pushing, or compaction.
- Multi-quote-asset support beyond the verified current quote asset.
- Leveraged trading.
- Permissionless settlement redemption initiated by a third party as a user-facing primary flow, unless needed for a demo edge case.
- Mainnet deployment and production treasury handling.

**Judge-mode flow.** A scripted “judge mode” must move through the product in this order: market overview, active oracle selection, manager verification, `DUSDC` funding, previewed binary trade, refreshed portfolio and history, previewed range trade, refreshed state, LP supply, LP summary, LP withdraw preview, and final “why this wins DeepBook” recap.

**Scope boundaries by protocol surface.** The verified application entry points exposed by official docs and the official Predict repo are `create_manager()`, binary preview via `get_trade_amounts()`, binary `mint()` and `redeem()`, settled binary `redeem_permissionless()`, range preview via `get_range_trade_amounts()`, range `mint_range()` and `redeem_range()`, and LP `supply()` and `withdraw()`. The repo integration guide also points app builders to `predict::create_manager`, `predict::mint`, `predict::redeem`, `predict::mint_range`, `predict::redeem_range`, `predict::supply`, `predict::withdraw`, and a manager deposit flow implemented onchain in `predict_manager::deposit`. PredictPilot must scope itself around these verified surfaces and avoid inventing additional execution paths. citeturn30view0turn14view2turn14view3

## Functional requirements and acceptance criteria

The required read contract is already documented. The official Predict server exposes protocol and market state, vault and LP summaries, manager and PnL summaries, and history endpoints; live freshness can come from Sui events such as `oracle::OraclePricesUpdated`, `oracle::OracleSVIUpdated`, `oracle::OracleSettled`, and `oracle::OracleActivated`. The product must not use raw chain scans as its default rendering path, and it must assume the indexed server is **low-lag, not zero-lag**, after writes. citeturn18view0turn14view2turn13view2

**Functional requirements.**

- **Trading requirements.** The app must allow the user to select a valid binary market or vertical range, preview the current mint cost and redeem payout, and sign the corresponding transaction. `MarketKey` handling must map to oracle ID, expiry, strike, and direction; `RangeKey` handling must enforce `lower_strike < higher_strike`. Binary previews should use `get_trade_amounts()`; range previews should use `get_range_trade_amounts()` when available through verified bindings. Minting must be blocked when the oracle is not live. Redeems must support both live and settled logic as officially documented. citeturn16search1turn30view0turn7view1
- **Liquidity requirements.** The app must allow the user to preview and execute `supply()` and `withdraw()` flows against the shared vault, show resulting `PLP` share changes, and communicate that withdrawals depend on available amount after max-payout coverage. citeturn30view0turn15view3
- **Market analytics requirements.** The app must show active oracles, current oracle state, latest spot and forward data, latest indexed SVI surface snapshot, oracle lifecycle status, accepted quote assets, resolved ask bounds when available, strike-grid context, and recent trade history for the selected oracle. These views should come from the official market and history endpoints rather than ad hoc chain decoding. citeturn18view0turn17view0
- **Portfolio analytics requirements.** The app must show manager summary, deposited quote balances, binary position quantities, range quantities, and time-range PnL. Because positions and ranges are stored internally in the `PredictManager`, portfolio views must not pretend there are standalone position NFTs or separate position objects to browse. citeturn7view0turn15view0turn18view0
- **Vault and LP analytics requirements.** The app must show vault summary, current value, performance view, supply history, withdrawal history, and the user’s `PLP` state where applicable. It must make clear that the vault takes the opposite side of trades and that `PLP` represents a proportional claim on vault value subject to utilization and withdrawal constraints. citeturn16search5turn15view3turn18view0
- **Risk preview requirements.** Every trade screen must display tradeability status, expiry proximity, previewed cost and payout, and a settlement-state warning. Every LP screen must display current vault state and withdrawal-constraint messaging. PredictPilot should borrow the clarity norm seen in the official DeepBook Margin materials, which emphasize explicit risk awareness and mitigation rather than hiding operational risk from the user. citeturn15view2turn30view0turn10search2turn10search3
- **Transaction preview requirements.** Before signature, the app must present a human-readable summary of action type, target oracle, strike or range, quantity, quote asset, manager involved, and expected cost or payout. If any preview source is not verified for the specific flow, the UI must label the number as an estimate rather than a guarantee.
- **Transaction history requirements.** The app must surface position mints, position redeems, range mints, range redeems, LP supplies, LP withdrawals, and oracle-specific trade history with timestamps and clear status cues. citeturn18view0
- **Error handling requirements.** The product must report wrong network, missing manager, insufficient `DUSDC`, inactive or untradeable oracle, invalid range bounds, wallet rejection, transaction failure, stale config IDs, and indexed-server lag after a write. Error copy must say what the user should do next.
- **Loading state requirements.** Market pages, portfolio pages, previews, and post-transaction refresh paths must all have visible loading states. No core panel should look blank during active loading.
- **Empty state requirements.** The product must provide explicit empty states for no manager, no balance, no positions, no LP history, no oracle selected, no active markets returned, and no wallet connected.

**User stories and acceptance criteria.**

| ID | User story | Acceptance criteria |
|---|---|---|
| US-01 | As a user, I want to connect a wallet and know instantly whether I am on the supported network. | The app detects Wallet Standard wallets; the selected account is shown; any non-Testnet network blocks write actions; read-only browsing still works without a connected wallet. |
| US-02 | As a user, I want to create or reuse my `PredictManager`. | The app can discover an existing manager by owner or create a new one; after success, the manager ID is stored in app state; the manager summary view refreshes automatically. |
| US-03 | As a user, I want to fund my manager with `DUSDC`. | The app displays available `DUSDC`; deposit amount validation prevents invalid input; successful deposit updates manager balances and transaction history; zero-balance users see a useful setup state. |
| US-04 | As a trader, I want to understand the selected market before I trade. | The app shows oracle status, expiry, latest spot, forward, latest SVI snapshot, ask bounds if available, and relevant strike or range context; inactive or pending-settlement markets are clearly labeled. |
| US-05 | As a trader, I want to preview and mint a binary position. | I can choose strike, direction, and quantity; the app shows cost and expected payout preview; signing the transaction produces a success state or actionable failure; portfolio and history refresh after completion. |
| US-06 | As a trader, I want to redeem a binary position. | I can select an existing manager-held position; the app previews payout; live and settled paths are clearly distinguished; redeemed quantity and resulting manager balance refresh correctly. |
| US-07 | As a trader, I want to preview and trade vertical ranges. | I can choose lower and higher strikes with validation; the app previews range mint or redeem amounts; signed success changes the stored range quantity and portfolio summary. |
| US-08 | As an LP, I want to supply and withdraw liquidity. | I can preview a `DUSDC` supply into the vault and resulting `PLP`; I can preview withdrawal availability and constraints; successful actions update LP history and vault summary. |
| US-09 | As a user, I want a consolidated portfolio view. | The app shows manager balance, binary quantities, range quantities, and available PnL views; it never invents standalone position objects; empty portfolio states are informative rather than blank. |
| US-10 | As a user, I want to understand what happened after a transaction. | Each successful action displays a confirmation summary; directly affected state refreshes first; indexed views refresh next; lag or partial refresh is messaged explicitly. |
| US-11 | As a judge, I want a clean demo path. | A demo workspace or judge mode can guide me through one trader flow and one LP flow in a deterministic sequence; the UI highlights verified package IDs and network; all unsupported features are hidden or disabled. |
| US-12 | As a user, I want failures to be understandable. | Wrong network, missing balance, bad oracle status, invalid range, and wallet rejection errors each have unique copy and recovery guidance; failed transactions never silently mutate local state. |

## Technical, quality, and security requirements

Sui’s transaction and state model should shape the implementation directly. Sui state is object-based; objects are owned, versioned, or shared; and PTBs can compose multiple commands in one transaction, execute those commands in order, reuse results from prior commands, and apply effects atomically at the end. If any command fails, the whole PTB fails. PredictPilot must reflect that model in both its internal state handling and its user-facing execution UX. citeturn9view4turn9view0turn9view5

**Frontend requirements.**

- The UI must feel like a professional terminal, not a toy consumer app.
- Core panels must include: market list, market detail, trade form, LP form, portfolio summary, history, transaction preview, and configuration status.
- Every action path must be understandable without reading code or external docs.
- The product should prioritize dense clarity over decorative motion.
- Judge mode must have a single happy-path route with minimal cognitive branching.

**Backend requirements.**

- The backend may be a thin proxy/cache layer, but it must not become a custodial transaction service.
- Default reads should use the official Predict server for render-ready data.
- Direct chain reads should be reserved for confirmation-critical state around wallet flows.
- If an app-side RPC client is used, it should support deterministic read-after-write behavior and environment-based configuration.
- Public Sui fullnode endpoints should be treated as acceptable for testnet/demo use, not as a production-grade scaling plan, because official RPC guidance warns that public endpoints are rate-limited and unsuitable for high-traffic production apps. citeturn18view0turn26view0

**Wallet integration requirements.** The current official Sui app SDK is the **Sui dApp Kit**, with `@mysten/dapp-kit-core` and `@mysten/dapp-kit-react` as the current packages and `@mysten/dapp-kit` called out as legacy and JSON-RPC-only. PredictPilot must use the current dApp Kit stack, support Wallet Standard detection, and avoid introducing wallet-specific custom code unless the current official path cannot meet a verified requirement. citeturn9view2turn9view3

**DeepBook Predict integration requirements.**

- Default read backend: the official public Predict server.
- Default execution model: verified contract entry points only.
- Default object model: one reusable `PredictManager` per user.
- Default liquidity model: official shared vault plus `PLP`.
- Default protocol guardrails: respect oracle lifecycle, accepted quote assets, ask bounds, risk limits, and available-withdrawal checks surfaced by official reads.
- Registry admin and oracle-operator paths are out of scope for standard users. citeturn17view0turn18view0turn7view2

**PTB execution requirements.**

- Every write flow should prefer a single PTB that includes all logically related commands.
- Related object usage must stay within one atomic flow whenever possible.
- The UI must not encourage users to sign two concurrent transactions that touch the same mutable owned object.
- PTB summaries shown to users must list the action, affected manager, oracle, quote asset, quantity, and expected value movement.
- Any multi-step flow that would require loops or unsupported runtime logic must be redesigned rather than hand-waved, because PTBs are intentionally lightweight and do not support programming patterns like loops. citeturn9view0turn21view0

**dUSDC requirements.** The current verified quote asset for public Testnet integration is `DUSDC`, with type `0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC` and `6` decimals. PredictPilot must default to this asset for quote-denominated flows, label it as Testnet-only, and provide a setup hint that builders can request DeepBook Predict Testnet tokens, including `DUSDC`, through the official request form. citeturn18view0turn17view0

**PredictManager requirements.** The manager is a per-user shared account object that wraps a DeepBook `BalanceManager`, stores quote balances, and tracks positions internally. The app must not create a separate “position object” abstraction in its internal data model. The canonical user account surface is the `PredictManager`. citeturn7view0turn15view0

**OracleSVI requirements.** The product must explicitly model oracle lifecycle states as `Inactive`, `Active`, `Pending settlement`, and `Settled`. Minting must require a live oracle. Redeeming can use live or settled state. After settlement, price and SVI updates are rejected. These lifecycle constraints must be visible in the trade UI, not buried in a log. citeturn7view1turn15view1

**Vault and PLP requirements.** The product must treat the vault as a first-class panel, not an implementation footnote. Official docs state that the vault takes the opposite side of every Predict trade, tracks balances and liabilities, and mints/burns `PLP` during supply and withdrawal. LP UX must therefore surface vault state, `PLP` share implications, and withdrawal-availability constraints. citeturn16search5turn15view3

**Testnet configuration requirements.**

- Hard-fail any write path if package ID, object ID, or registry ID is missing.
- Show current verified config values in a dedicated status panel.
- Gate all execution behind a supported-network check.
- Keep all IDs in typed environment variables or generated config.
- Mark every protocol constant as provisional unless it is fetched or verified against the current official deployment docs.
- Add a startup validation mode that compares local config against the latest verified deployment sheet before demo day.

**Data freshness requirements.**

- Use the official Predict server for most page rendering.
- Use live Sui events only where second-level freshness materially improves UX.
- Use direct object reads before and after wallet flows that need authoritative state.
- Do not present low-lag indexed data as if it were instant ground truth.
- For critical confirmation screens, prefer onchain confirmation first, then refresh indexed views second. citeturn15view4turn14view2turn18view0

**Non-functional requirements.**

- The app must remain understandable under demo pressure.
- Market-to-signature flows must feel fast and deterministic.
- All copy must be precise, version-aware, and non-deceptive.
- The repo must be structured so that Codex can extend features without losing the line between verified protocol behavior and app-layer assumptions.
- If a custom Move package is added for any helper logic, it must follow Sui Move best practices for package structure, module organization, shared object design, naming, and documentation. citeturn20view0

**Testing requirements.** If any custom Move package is written, the repo must use `sui move test`, scenario tests for multi-transaction/shared-object behavior, and coverage tooling such as `sui move test --coverage`. The official Sui guidance also recommends `test_scenario` for multi-step flows and high coverage for test-critical modules. PredictPilot additionally needs frontend integration tests for wallet connection, manager flows, binary/range flows, LP flows, and post-write refresh behavior on Testnet. citeturn21view0turn22view0

**Security requirements.**

- No custodial private-key handling.
- No silent signing or background trading.
- No environment-dependent package IDs hidden from the UI.
- No user-facing action should invoke governance or operator-only registry flows.
- Let the wallet handle gas budget, gas price, and coin selection unless a verified reason requires otherwise.
- Avoid self-transfers and overcomplicated output handling if any custom Move code is introduced.
- Prefer pure composable functions in custom Move code, with explicit share functions for shared objects.
- Never sign concurrent transactions that touch the same mutable owned object. citeturn21view0turn20view0

**Implementation-quality requirement.** The official Predict repo’s integration quickstart recommends using `@mysten/codegen` for Move type parsing, typed decoding, PTB helpers, and generated call targets, and advises against hand-rolling BCS parsing or scattering raw string call targets throughout the app. PredictPilot should adopt that recommendation as the default implementation path. citeturn14view2

## Delivery, risks, and final checklist

**Demo requirements.**

1. Start with a clean environment panel showing supported network and verified deployment values.
2. Show one active oracle with clear lifecycle status, strike context, and current market state.
3. Create or reuse a `PredictManager`.
4. Show `DUSDC` funding into the manager.
5. Preview and mint a binary position.
6. Refresh account and market state.
7. Preview and mint or redeem a range.
8. Show portfolio and history updates.
9. Preview and execute LP supply.
10. Preview LP withdrawal constraints.
11. End with a concise explanation of why the product belongs in the DeepBook track and how it can extend beyond the hackathon.

**Submission requirements.**

- A `README.md` with setup, environment variables, verified deployment IDs, and demo steps.
- A clearly labeled Testnet-only disclaimer.
- A contract/config appendix listing all verified package IDs and object IDs.
- A short architecture diagram showing public server, event stream path, direct chain reads, wallet, and UI layers.
- A demo script aligned with the judge-mode flow.
- Screenshots or a short video proving at least one binary or range flow and one LP flow on Testnet.
- Clear `TODO VERIFY` closure before final video/export.

**Success metrics.**

- Demo-critical write flows succeed on current Testnet.
- At least one binary or range execution and one LP flow are completed live.
- Post-write state refresh is visible and trustworthy.
- Judges can understand `PredictManager`, `OracleSVI`, and `PLP` without consulting external docs.
- No screen suggests unsupported functionality.
- No unverified constant is hardcoded without disclosure.

**Product risks.**

- The product can drift into a generic “prediction dashboard” instead of a DeepBook execution terminal.
- The UI can become too educational and not actionable.
- The app can over-index on analytics and under-deliver on real execution.
- The LP flow can be treated as an afterthought, weakening DeepBook-track alignment.

**Technical risks.**

- DeepBook Predict docs explicitly say the current package IDs and object layouts are provisional before Mainnet.
- The indexed Predict server is useful but not instantaneous after writes.
- Public Sui RPC endpoints are rate-limited and unsuitable as a production-scale plan.
- Wallet behavior may vary across providers even with Wallet Standard support.
- Oracle lifecycle transitions can create demo edge cases if the selected market changes state mid-session. citeturn17view0turn18view0turn13view2turn26view0turn7view1

**Scope risks.**

- Building custom simulations, AI recommendations, or multi-oracle abstractions too early can delay core execution.
- Supporting more than the verified current quote asset can multiply edge cases without increasing hackathon value.
- Overbuilding design polish before transaction reliability can create a beautiful but weak demo.

**Dependency risks.**

- The 2026 public hackathon materials are partially inconsistent and may change.
- `DUSDC` access for demo wallets depends on Testnet token availability and setup discipline.
- Any post-doc deployment update could invalidate local config.
- If the handbook contains additional DeepBook-track requirements, those still need reconciliation. citeturn27view0turn25search1turn17view0

**Final PRD checklist.**

- [ ] The app is explicitly positioned as a DeepBook Predict terminal.
- [ ] DeepBook track alignment is obvious from the first screen.
- [ ] Package ID, object ID, registry ID, quote asset, and network are visible and version-aware.
- [ ] `PredictManager` creation or reuse works.
- [ ] `DUSDC` deposit flow works.
- [ ] Binary preview and execution work.
- [ ] Binary redeem works.
- [ ] Range preview and execution work.
- [ ] Range redeem works.
- [ ] LP supply preview and execution work.
- [ ] LP withdrawal preview and execution work.
- [ ] Portfolio, PnL, and history refresh correctly after writes.
- [ ] Oracle lifecycle is visible and respected.
- [ ] Errors, loading states, and empty states are implemented across all demo-critical screens.
- [ ] The app does not expose unverified governance/operator flows.
- [ ] A judge-mode walkthrough exists and is rehearsed.
- [ ] All remaining handbook or config ambiguities are labeled `TODO VERIFY` or closed before submission.

**Definition of done.** PredictPilot is done for hackathon submission when a fresh judge can open the app, verify the current Testnet deployment surface, understand the selected oracle, create or reuse a manager, fund it with `DUSDC`, complete at least one trade and one LP action through wallet-confirmed PTBs, and then observe correct portfolio, vault, and history updates—all without the repo or UI inventing unsupported Predict behavior.