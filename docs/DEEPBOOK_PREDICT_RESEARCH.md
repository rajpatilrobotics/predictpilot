# DEEPBOOK_PREDICT_RESEARCH

## Research summary

This dossier is based on the official Sui DeepBook Predict documentation, the official `MystenLabs/deepbookv3` repository, and the exact `predict-testnet-4-16` branch that the docs identify as the current public integration target. As of June 2026, DeepBook Predict is documented as a **testnet integration surface**, and the official docs explicitly warn that package IDs, object layouts, and entry points can change before any mainnet deployment. For exact function names and event structs, the repository source is more authoritative than the docs pages because several docs pages currently fail to render embedded source snippets and instead point back to the repo paths. citeturn7view0turn6search1turn15view0turn8view0turn8view1turn8view2

For PredictPilot, the most important verified conclusion is that DeepBook Predict is **not** a generic order-book API and **not** a position-NFT model. It is a protocol centered on a shared `Predict` object, per-user shared `PredictManager` accounts, `OracleSVI` objects for underlying-plus-expiry market state, and a shared `Vault` that takes the other side of trades while minting `PLP` for LPs. Binary positions and vertical ranges are tracked as quantities inside the manager, keyed by `MarketKey` and `RangeKey`, not as standalone tradable objects. citeturn7view1turn8view1turn8view2

The official builder surface for a hackathon project now includes four things that matter operationally: the docs site, the public testnet Predict server, the `deepbookv3` repository branch pinned by the docs, and at least one recent official Sui workshop video specifically titled **“Sui Overflow 2026 Workshop: How to Trade on DeepBook Predict”** on the Sui YouTube channel. The Sui developer portal also points builders toward the developer forum, workshops, and hackathon resources. citeturn37search0turn15view0turn42search0turn43search7

**Verified facts in this document** are presented as protocol behavior, deployment identifiers, documented API surfaces, or exact source-level function and event names. **Recommendations for PredictPilot** are marked as implementation guidance or inference where they go beyond hard protocol facts. Any item that was not explicitly verified from official sources is marked `TODO VERIFY`. citeturn6search1turn15view0

## Verified integration surface

DeepBook Predict’s current official public integration target is Sui **Testnet**. The docs publish a single official Predict package, a single registry ID, a single root `Predict` object ID, a public testnet server, one currently documented quote asset type, and the `PLP` coin type. The same page states that these values come from the `predict-testnet-4-16` branch and should be treated as provisional until mainnet launch. citeturn37search0turn15view0

| Item | Verified value | Integration meaning |
|---|---|---|
| Network | `Testnet` | PredictPilot should target testnet-first execution only |
| Public server | `https://predict-server.testnet.mystenlabs.com` | Render-ready market, vault, portfolio, and history API |
| Predict package | `0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138` | Package ID for Move calls and event filters |
| Predict registry | `0x43af14fed5480c20ff77e2263d5f794c35b9fab7e2212903127062f4fe2a6e64` | Shared registry object for deploy/operator surfaces |
| Predict object | `0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a` | Root shared object used by public trading and LP flows |
| Current quote asset type | `0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC` | Testnet collateral asset for public integration |
| DUSDC currency ID | `0xf3000dff421833d4bb8ed58fac146d691a3aaba2785aa1989af65a7089ca3e9c` | Currency metadata identifier |
| DUSDC decimals | `6` | UI formatting for deposits, balances, LP flows, and payouts |
| PLP coin type | `0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138::plp::PLP` | LP share token type returned by `supply()` |
| Source branch | `predict-testnet-4-16` | The repo branch to pin for all source validation |

The table above is taken from the official contract-information page and the official GitHub branch page. citeturn37search0turn15view0

Only two static shared-object IDs are explicitly published in the official docs today: the **registry** and the root **Predict** object. Oracle IDs are not published as a static list on the docs page; instead, the registry tracks oracle IDs by `OracleSVICap`, and the public server documents `/predicts/:predict_id/oracles` for runtime discovery. PredictPilot should therefore treat oracle IDs as **runtime data**, not hardcoded constants. citeturn22view4turn37search0

The official public server surface is documented as follows. citeturn37search0

| Scope | Documented endpoints |
|---|---|
| Protocol and market state | `GET /status`, `GET /predicts/:predict_id/state`, `GET /predicts/:predict_id/oracles`, `GET /oracles/:oracle_id/state`, `GET /predicts/:predict_id/quote-assets`, `GET /oracles/:oracle_id/ask-bounds` |
| Vault and LP data | `GET /predicts/:predict_id/vault/summary`, `GET /predicts/:predict_id/vault/performance?range=ALL`, `GET /lp/supplies`, `GET /lp/withdrawals` |
| Manager and portfolio data | `GET /managers`, `GET /managers/:manager_id/summary`, `GET /managers/:manager_id/positions/summary`, `GET /managers/:manager_id/pnl?range=ALL` |
| History data | `GET /oracles/:oracle_id/prices`, `GET /oracles/:oracle_id/prices/latest`, `GET /oracles/:oracle_id/svi`, `GET /oracles/:oracle_id/svi/latest`, `GET /positions/minted`, `GET /positions/redeemed`, `GET /ranges/minted`, `GET /ranges/redeemed`, `GET /trades/:oracle_id` |

No public server endpoint for **trade preview quotes** was documented on the official endpoint list that I reviewed. PredictPilot should assume that quote previews come either from on-chain preview functions or from its own local quoting logic until a server-side quote route is officially verified. `TODO VERIFY`: whether the public server exposes any undocumented preview or simulation endpoints. citeturn37search0turn18view1turn34view0

For lower-latency market freshness, the docs explicitly recommend filtering Sui events by the current Predict package and watching the oracle event types `oracle::OraclePricesUpdated`, `oracle::OracleSVIUpdated`, `oracle::OracleSettled`, and `oracle::OracleActivated`. The docs also recommend using the server for historical pagination and the live stream for freshness. citeturn37search0

The official docs also state that builders can request DeepBook Predict testnet tokens, including DUSDC and other assets, via a token request form. That is important for hackathon execution planning because PredictPilot should not assume faucet availability is enough for end-to-end testing. citeturn7view0

Mainnet readiness remains limited in the official materials I reviewed: the docs repeatedly frame the current deployment as provisional and say identifiers will change at mainnet launch, but they do **not** publish a mainnet package ID or mainnet object IDs. The correct mainnet position for PredictPilot is therefore: **testnet only unless and until official mainnet identifiers are published.** citeturn7view0turn37search0

## Protocol object model

At the design level, DeepBook Predict revolves around four main onchain components: `Predict`, `PredictManager`, `OracleSVI`, and `Vault`. The docs describe `Predict` as the top-level shared object that owns pricing config, risk config, the quote-asset allowlist, oracle strike grids, withdrawal-limiter config, vault state, and the `PLP` treasury cap. They describe `PredictManager` as a per-user shared account that wraps a DeepBook `BalanceManager` and stores deposited quote balances plus the user’s binary and range quantities. They describe `OracleSVI` as the market-state object for one underlying and one expiry, and `Vault` as the shared liquidity and exposure engine that issues `PLP`. citeturn7view1

The following object map is the verified mental model PredictPilot should use. citeturn7view1turn22view4turn24view0turn24view5

| Object / type | What it stores or represents | What PredictPilot should assume |
|---|---|---|
| `Predict` | Root shared protocol object; pricing, risk, quote assets, strike grids, vault, limiter, `PLP` treasury cap | Every public trade and LP action goes through this object |
| `PredictManager` | Per-user shared account; owner, inner `BalanceManager`, deposit/withdraw caps, binary quantities, range quantities | One manager per user; reuse it across all flows |
| `OracleSVI` | Underlying + expiry market state; spot, forward, SVI params, timestamps, lifecycle, settlement | Market truth for pricing, tradeability, and settlement |
| `Vault` | Accepted asset balances, total balance, per-oracle strike matrices, settled-oracle compact state, total MTM, total max payout | LP and protocol risk engine, opposite side of trades |
| `PLP` | LP share coin | Returned by `supply()`, burned by `withdraw()` |
| `Registry` | Tracks `predict_id` and oracle IDs by cap; exposes admin/setup entry points | Useful primarily for deployment/operator surfaces, not normal trading UX |
| `MarketKey` | Binary position key | `(oracle_id, expiry, strike, is_up)` |
| `RangeKey` | Vertical range key | `(oracle_id, expiry, lower_strike, higher_strike)` |

The verified source confirms that `PredictManager` is a shared object with fields for `owner`, an inner `BalanceManager`, `deposit_cap`, `withdraw_cap`, a `positions` table keyed by `MarketKey`, and a `range_positions` table keyed by `RangeKey`. The manager exposes owner-only `deposit<T>` and `withdraw<T>` public functions, read helpers like `position`, `range_position`, and `balance<T>`, and a package-level `deposit_permissionless<T>` used for protocol payouts. PredictPilot must therefore model the manager as an internal account object, not as a wallet mirror or as a set of independent position objects. citeturn18view4turn18view5turn19view0turn19view1

The docs and source agree that **binary positions and ranges are not standalone onchain objects**. Binary positions are stored internally using `MarketKey`; ranges are stored internally using `RangeKey`. This is one of the most important anti-hallucination rules for PredictPilot. If Codex starts looking for “position objects,” it is already building the wrong integration model. citeturn7view1turn8view1turn8view2

`MarketKey` is used for binary directional positions. The key components are `oracle_id`, `expiry`, `strike`, and `is_up`; helper constructors include `up()`, `down()`, and `new()`. `RangeKey` is used for vertical ranges, with `oracle_id`, `expiry`, `lower_strike`, and `higher_strike`. The docs explicitly note that `RangeKey::new()` aborts if `lower_strike` is not less than `higher_strike`. citeturn8view2

The registry is a separate shared object that tracks the root Predict object ID and the oracle IDs created by each `OracleSVICap`. In the source, `create_predict<Quote>()` writes the root `predict_id` once, `create_oracle_cap()` mints an oracle capability, and `create_oracle()` records oracle IDs by cap while also registering the strike grid inside the predict object. The docs are explicit that these are mostly operator/governance surfaces and that normal apps usually do not call them directly. citeturn41search17turn22view4turn21view2

The `Vault` source shows that the vault stores concrete asset balances by type in a `Bag`, a shared quote-denominated `balance`, per-oracle strike matrices, settled-oracle compact state, `total_mtm`, and `total_max_payout`. Its public read helpers include `balance`, `asset_balance<T>`, `total_mtm`, `vault_value`, and `total_max_payout`. `vault_value` is explicitly defined as `balance - total_mtm`, with a check that MTM cannot exceed the vault balance. citeturn24view0turn24view2turn24view4

`PLP` is a coin type defined inside the Predict package. The source initializes it through the Sui coin registry with symbol `PLP`, name `Predict LP`, and a description stating that it represents shares in the DeepBook Predict vault. The coin uses 6 decimals. citeturn24view5

From the Sui object-model side, PredictPilot should remember that Sui transactions operate on **live objects**, which include owned objects plus shared and immutable objects. Shared objects are consensus-managed and versioned by scheduling; immutable/shared object usage patterns differ from address-owned coin objects. That matters here because the root `Predict`, each `PredictManager`, and each `OracleSVI` are shared objects, while DUSDC coins and PLP coins are regular coin objects that move in and out of those shared-account and vault flows. citeturn39search7turn39search2turn39search11

## Pricing, lifecycle, and risk

`OracleSVI` goes through four verified lifecycle states: inactive, active, pending settlement, and settled. In the docs, “pending settlement” begins after expiry but before the first post-expiry price push; in the source, `status()` returns `STATUS_PENDING_SETTLEMENT` whenever the clock is at or past expiry and the oracle is not yet settled. The first post-expiry `update_prices()` call freezes the settlement price, deactivates the oracle, and emits `OracleSettled`. PredictPilot should therefore treat expiry alone as **not yet settled**; settlement happens on the next qualifying price push. citeturn7view1turn20view2turn20view5turn35view1

The source defines `SVIParams` as `a`, `b`, signed `rho`, signed `m`, and `sigma`, and `PriceData` as `spot` and `forward`. The docs/comments say these values are scaled by `FLOAT_SCALING (1e9)`. The oracle comments also label spot/forward updates as high frequency, around one second, and SVI updates as lower frequency, around 10–20 seconds. That scaling and update cadence are crucial for PredictPilot’s data adapters: UI display formatting for prices must not be confused with quote-asset decimals, and live market freshness should prioritize oracle event updates over periodic polling wherever possible. citeturn32view4turn20view2turn20view1

For binary pricing, the source says live-oracle UP pricing comes from SVI via `N(d2)`, with the internal formula:
`k = ln(strike / forward)`,
`w(k) = a + b * (rho * (k - m) + sqrt((k - m)^2 + sigma^2))`,
`d2 = -((k + w(k)/2) / sqrt(w(k)))`.
When settled, `compute_price()` returns exactly `1.0` for UP if `settlement_price > strike` and `0` otherwise. The source also defines the live binary parity invariant as `UP + DN = 1`. PredictPilot should therefore describe binary markets as **option-style conditional payout curves**, not as arbitrary user-voted probabilities. citeturn35view1turn36view0

The source-level pricing bridge between fair price and tradeable quotes lives inside `trade_prices()` and `range_trade_prices()`. For binaries, the code computes the fair UP price from the oracle, derives a protocol spread from fair price plus utilization state, then returns post-spread `(ask, bid)`. For settled binaries, ask and bid collapse to the same fair outcome price. For ranges, the source states that the fair range price is `up(lower) - up(higher)`, and that the settled range evaluates to `1.0` if settlement lands in the half-open band `(lower, higher]`; otherwise it settles to `0`. This is one of the strongest reasons PredictPilot must not fake “range pricing” with simple midpoint logic. citeturn35view0turn36view0

Tradeability and pause semantics are also source-verifiable. `mint<Quote>()` and `mint_range<Quote>()` check both manager ownership and `!predict.trading_paused`, and they require a live oracle. `redeem<Quote>()` and `redeem_range<Quote>()` require a quoteable oracle state, and the docs explicitly say redeems can quote against live or settled oracle state. The source additionally exposes `redeem_permissionless<Quote>()` for **settled binary positions**, but I did **not** verify a range-specific permissionless redeem function in the reviewed sources. `TODO VERIFY` if a future package version adds one. citeturn17view1turn34view0turn17view0turn7view1

Ask-bound controls are explicit. The registry exposes admin entry points `set_min_ask_price`, `set_max_ask_price`, `set_oracle_ask_bounds`, and `clear_oracle_ask_bounds`. The `Predict` source resolves the effective ask bounds as the intersection of the global bounds and any per-oracle override, and `assert_mintable_ask()` aborts if the post-spread ask is outside those bounds. That means PredictPilot must never treat price previews as valid solely because the fair price looks sensible; mintability depends on **resolved ask bounds after spread**. citeturn22view4turn35view0

Risk control centers on the vault. The docs say the protocol inserts the new liability into the vault **before** pricing the mint, so the trader pays for the post-trade state they create. The source then enforces total exposure via `assert_total_exposure(vault, max_total_pct)`, which checks `total_mtm <= balance * max_total_exposure_pct`. PredictPilot should surface this as “vault risk budget,” not as a cosmetic config. Some mints that are theoretically priceable can still fail because they push total MTM past the configured exposure cap. citeturn7view1turn25view2turn17view1turn34view0

The source also shows how settlement compaction works. Once an oracle is settled, `compact_settled_oracle()` can convert dense strike-matrix exposure into compact settled state, and later settled redemptions debit that compact state through `redeem_settled_position()`. This matters for analytics and demo expectations: after settlement, the vault may no longer expose the original dense strike matrix for that oracle, even though the protocol still supports payout redemption. citeturn17view4turn25view0turn25view1

## Execution and liquidity flows

The public execution surface verified from the docs and source is: `create_manager`, `get_trade_amounts`, `mint`, `redeem`, `redeem_permissionless`, `get_range_trade_amounts`, `mint_range`, `redeem_range`, `supply`, `withdraw`, and `compact_settled_oracle`. PredictPilot should build around these exact public entry points and avoid inventing additional public trade methods. citeturn18view0turn8view0turn17view2turn17view3turn17view4

The single most important asset-flow distinction is that **trading** and **LPing** do not use DUSDC the same way. Binary and range mints consume value from the user’s `PredictManager`; LP supply takes a direct `Coin<Quote>` and returns `Coin<PLP>`. Binary and range redeems deposit payout back into the manager, while LP withdraw burns `PLP` and returns a `Coin<Quote>` directly. PredictPilot must represent these as two different execution paths in both UI and transaction-building code. citeturn18view4turn17view1turn17view0turn34view0turn17view3turn30view3

| Flow | Asset input | Verified destination / effect |
|---|---|---|
| Manager funding | `Coin<DUSDC>` | Deposited into `PredictManager` balance via `deposit<T>` |
| Binary mint | Manager balance | Manager balance decreases; binary quantity increases |
| Binary redeem | Position quantity in manager | Payout deposited back into manager |
| Settled binary permissionless redeem | Position quantity in manager | Anyone can execute; payout still lands in owner’s manager |
| Range mint | Manager balance | Manager balance decreases; range quantity increases |
| Range redeem | Range quantity in manager | Payout deposited back into manager |
| LP supply | Direct `Coin<DUSDC>` | Vault balance increases; caller receives `Coin<PLP>` |
| LP withdraw | Direct `Coin<PLP>` | `PLP` burned; caller receives `Coin<DUSDC>` if available |

The table above is directly implied by the verified source entry points. citeturn18view4turn17view1turn17view0turn34view0turn17view3turn30view3

The verified mint flow for a binary position is: create-or-find manager; ensure the manager is funded with an accepted quote asset; compute preview amounts with `get_trade_amounts`; call `mint<Quote>(predict, manager, oracle, key, quantity, clock, ctx)`; let the protocol add the new liability to the vault, quote against post-trade state, enforce ask bounds and risk, and finally increase the position quantity inside the manager. The redeem flow is the mirror image: the manager quantity is reduced, vault exposure is removed or compacted, payout is dispensed from the vault, and the payout is deposited back into the manager. citeturn7view0turn18view1turn17view1turn7view1turn18view1

The verified range flow is analogous but directionless. `get_range_trade_amounts()` previews `(mint_cost, redeem_payout)` for a `RangeKey`; `mint_range<Quote>()` inserts bounded range exposure into the vault and charges the manager; `redeem_range<Quote>()` removes the range exposure or redeems compact settled state and deposits the payout into the manager. The source explicitly notes that bull-call and bear-put ranges with the same strikes price identically because direction is **not** part of `RangeKey`. citeturn34view0turn29view3turn34view2turn34view3

The LP flow is also verified end to end. `supply<Quote>()` accepts a direct quote-asset coin, records the deposit in the vault, records the deposit in the withdrawal limiter, and mints `PLP`. The first supplier receives shares 1:1 with amount; later suppliers receive shares proportional to deposit relative to current vault value. `withdraw<Quote>()` burns `PLP`, computes the requested quote amount from current vault value, checks that the amount does not exceed the currently available balance after max-payout coverage, consumes withdrawal-limiter capacity, and returns the requested quote asset. citeturn17view3turn30view2turn30view3turn7view1

The source contains two subtle but important outflow rules. First, redeems can use any quote asset with concrete vault balance even if that quote asset is disabled for **new inflows**. Second, LP withdraw is based on currently available balance after max-payout coverage, not on gross vault balance alone, and it is further subject to the rate limiter. PredictPilot should therefore present “available to withdraw now” as its own explicit metric and avoid implying that all vault value is liquid at all times. citeturn17view0turn30view3

For first-time users, a practical PredictPilot recommendation is to treat **manager creation** as its own confirmed setup step. The verified public function `create_manager(ctx)` returns only the new manager ID, while every later trading flow expects a real shared `PredictManager` object input. Combined with the docs’ recommended “create or find a manager, then deposit, then trade” flow, the safest hackathon behavior is: create once, confirm once, discover the manager ID, then reuse that manager in later PTBs. This is an implementation inference, but it is grounded in the published function shape and documented flow. citeturn18view0turn7view0

## Data, PTB, wallet, and implementation guidance

The official data-freshness model for PredictPilot should follow the docs exactly: use the public Predict server for page rendering, market lists, vault summaries, portfolio summaries, and history; use Sui checkpoint or event streaming for second-level oracle freshness; and use direct onchain object reads immediately before or after wallet-critical flows that require authoritative state. The docs explicitly warn against building the primary UI around raw chain scans because the indexed server already exposes the render-ready surfaces you need. citeturn7view0turn7view1turn37search0

That implies the following frontend data requirements for PredictPilot: markets and oracle lists should come from `/predicts/:predict_id/oracles` and related server state; manager summaries, position summaries, and PnL should come from `/managers/:manager_id/...` once the manager ID is known; vault panels should use `/predicts/:predict_id/vault/...`; histories should come from the documented history routes; and live-tape elements should subscribe to the oracle events the docs recommend. Wallet-critical confirmation flows should still refresh the actual manager object, relevant oracle object, and coin objects onchain. citeturn37search0turn7view0

A thin backend is optional, not required by the official protocol surface I reviewed. The official docs and server are already designed for render-ready UI data, and the Sui docs plus dApp Kit support direct client-side wallet execution. For a hackathon MVP, the most defensible architecture is therefore **server-first frontend reads plus direct wallet PTBs**, with a thin backend only if PredictPilot needs caching, analytics aggregation, or proxying around rate limits. That last sentence is an implementation recommendation, not an official protocol rule. citeturn7view0turn38view2turn38view4

For transaction building, the current official Sui PTB docs still use the `Transaction` class from `@mysten/sui/transactions`. The docs also note that if you need a specific gas coin, you should resolve that coin explicitly and, if necessary, split a gas coin first. For multiple transactions from the same address, the Sui SDK exposes `SerialTransactionExecutor` and `ParallelTransactionExecutor` specifically to avoid versioning and gas-object reuse errors. Those helpers are highly relevant to PredictPilot if the app sequences create/deposit/trade flows or fires multiple wallet actions quickly. citeturn38view0turn38view1

PredictPilot’s PTB layer should therefore be organized around **typed transaction-builder modules**, one per verified public action: manager creation, manager deposit, manager withdraw, binary mint, binary redeem, range mint, range redeem, LP supply, and LP withdraw. Because shared object scheduling and versioning matter on Sui, the app should avoid concurrently reusing the same mutable `PredictManager` or the same gas coin across multiple inflight transactions unless it is using the official executors designed for that purpose. citeturn39search2turn38view1turn7view1

On wallet integration, the official stack today is the Sui Wallet Standard plus the new dApp Kit packages. The Wallet Standard is the discovery and authorization layer used by browser wallets, and its docs emphasize a persistent authorization model where `connect()` is used to prompt for account authorization when needed. The current dApp Kit docs present `@mysten/dapp-kit-core` and `@mysten/dapp-kit-react` as the modern packages, and the React quickstart shows `createDAppKit` plus `SuiGrpcClient` configured for testnet. citeturn38view3turn38view2turn38view4

For codegen and bindings, I did **not** verify an official Predict-specific TypeScript SDK or generated binding package in the official Predict docs pages or in the repo pages I reviewed. What I *did* verify is that Sui’s own dApp tooling includes examples that use codegen in general `create-dapp` templates. PredictPilot should therefore assume: **local typed wrappers around verified Move calls are required**, while any custom generated bindings for Predict remain `TODO VERIFY` unless you later find an official package or generate your own from the verified branch. citeturn38view4turn15view0turn37search0

The most robust PredictPilot implementation approach, based on the verified protocol model, is:

- Use the official Predict server for the default UI.
- Use direct onchain reads right before and right after user-signing moments.
- Treat `PredictManager` as a persistent per-wallet account object.
- Keep package IDs, object IDs, and coin types in config, never scattered in components.
- Represent binary trades, range trades, and LP actions as separate transaction families.
- Never model positions as standalone NFTs or user-owned child objects.
- Never rely on server-only state to decide the final transaction parameters that a wallet signs. citeturn7view0turn7view1turn18view4turn37search0

For testing and demo readiness, PredictPilot should verify live testnet execution against the published package/object IDs, request DUSDC through official builder channels if required, prove at least one real binary or range action plus at least one real manager or LP action, and refresh both onchain objects and indexed server endpoints after confirmation. The recent official Sui Overflow 2026 workshop on trading DeepBook Predict suggests that this flow is now part of the active builder-support surface, not merely static documentation. citeturn7view0turn37search0turn42search0

## Limitations, open questions, `TODO VERIFY`, and final checklist

The current official DeepBook Predict materials have a few important limitations. First, the public integration surface is explicitly testnet-only and provisional. Second, several docs pages currently fail to inline source snippets, which means exact function/event verification still requires cross-checking the pinned repo branch. Third, the source itself contains open TODO-style comments around validation of oracle price pushes and SVI updates, and around whether fully redeemed settled oracles should eventually be removed from compact settled state. PredictPilot should treat those as indications that the protocol is still actively evolving. citeturn37search0turn8view0turn8view1turn20view1turn20view2turn25view1

The verified event model includes at least the following names: `PredictManagerCreated`, `PositionMinted`, `PositionRedeemed`, `RangeMinted`, `RangeRedeemed`, `Supplied`, `Withdrawn`, `OracleActivated`, `OraclePricesUpdated`, `OracleSVIUpdated`, and `OracleSettled`. The docs specifically recommend the four oracle events for live UI freshness, while the source verifies the broader manager/trade/liquidity event set. citeturn19view1turn29view0turn29view1turn29view2turn29view3turn30view2turn30view3turn20view3turn20view4turn20view5turn20view1turn37search0

### Common integration mistakes

- Treating binary or range positions as standalone objects instead of manager-owned table entries. citeturn8view1turn8view2
- Hardcoding outdated package IDs or testnet object IDs instead of loading the current published identifiers from config. citeturn37search0
- Using server-only data to finalize wallet-signing parameters without refreshing the live manager/oracle state around the transaction. citeturn7view0turn7view1
- Building “range markets” as directional instruments when the verified `RangeKey` is directionless and the source prices same-strike bull-call and bear-put ranges identically. citeturn8view2turn34view2
- Assuming LP withdrawable value equals gross vault balance, instead of accounting for `total_max_payout` and the withdrawal limiter. citeturn30view3
- Ignoring the resolved ask-bound check and showing a mint button for quotes that can still revert onchain. citeturn22view4turn35view0
- Scanning raw chain state for everything instead of using the official indexed server where the docs explicitly recommend it. citeturn7view0turn37search0

### Open questions

- `TODO VERIFY`: whether the public server supports undocumented quote-preview or simulation endpoints beyond the documented route catalog. citeturn37search0turn18view1turn34view0
- `TODO VERIFY`: whether `/managers` supports owner-based filtering or whether PredictPilot must discover managers from events or manual object storage. The docs only document `/managers` generically. citeturn37search0turn19view1
- `TODO VERIFY`: whether any additional quote assets are publicly enabled on testnet beyond the currently documented DUSDC type. The docs presently verify DUSDC and operator-side enable/disable mechanisms, but no extra live public assets were verified. citeturn37search0turn22view4
- `TODO VERIFY`: whether a range-specific permissionless redeem function exists in newer unpublished code paths. I verified `redeem_permissionless<Quote>()` only for settled binaries. citeturn17view0
- `TODO VERIFY`: whether an official Predict-specific TS SDK or generated bindings package will be published separately from the branch source. citeturn15view0turn38view4
- `TODO VERIFY`: whether mainnet deployment identifiers have been published after the docs pages I reviewed. No mainnet Predict package/object IDs were verified in official sources here. citeturn7view0turn37search0

### Recommended implementation approach for PredictPilot

Use the official public server for market discovery, vault analytics, portfolio panels, and historical views; use wallet-connected PTBs for real execution; do direct onchain reads of the current `PredictManager`, `OracleSVI`, and relevant coin objects before signing; and pin every protocol identifier to the current published testnet config. If PredictPilot needs a first live demo path, the highest-confidence path is: connect wallet, discover or create manager, deposit DUSDC into manager, mint one binary position, redeem it, then optionally show LP supply into the vault for `PLP`. That recommendation is an inference from the verified public surface rather than a quoted protocol rule. citeturn7view0turn18view0turn18view4turn17view1turn17view0turn17view3

### Final research checklist

- [ ] Use only the currently published **testnet** package, registry, and root Predict object IDs. citeturn37search0
- [ ] Treat `DUSDC` as the only currently verified public quote asset until more are officially confirmed. citeturn37search0
- [ ] Treat `PredictManager` as the user’s persistent internal account object, not as a temporary helper. citeturn8view1turn18view4
- [ ] Model binary positions with `MarketKey` and ranges with `RangeKey`; never invent position NFTs. citeturn8view2turn8view1
- [ ] Build around the verified public functions only: manager creation, preview, mint, redeem, range mint/redeem, supply, withdraw, compaction. citeturn18view0turn17view1turn17view0turn17view2turn17view3turn17view4
- [ ] Use the official server for render-ready pages and live oracle events for freshness. citeturn7view0turn37search0
- [ ] Refresh actual onchain state around every user-signing flow. citeturn7view1
- [ ] Use Sui PTBs through `Transaction`, and use official executors if you queue multiple transactions from the same address. citeturn38view0turn38view1
- [ ] Use Wallet Standard plus modern dApp Kit packages for wallet connection and account authorization. citeturn38view2turn38view3turn38view4
- [ ] Keep all unresolved assumptions behind explicit `TODO VERIFY` flags before coding them into PredictPilot. citeturn6search1turn15view0