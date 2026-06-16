# MVP Scope

## Scope framing

PredictPilot’s MVP must be built against the currently documented **DeepBook Predict testnet integration surface**, not against guessed contracts or stale package IDs. The official Sui docs describe DeepBook Predict as an expiry-based prediction market protocol on Sui, document the current public integration target as **Sui Testnet**, and explicitly warn that package IDs, object layouts, and entry points are **provisional** before mainnet. citeturn3view2turn3view3turn5view2

**Verified public integration targets for the MVP research baseline, as of June 15, 2026:**

- Public Predict server: `https://predict-server.testnet.mystenlabs.com` citeturn5view2turn17view0
- Predict package: `0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138` citeturn5view2turn17view0
- Predict registry: `0x43af14fed5480c20ff77e2263d5f794c35b9fab7e2212903127062f4fe2a6e64` citeturn5view2
- Predict object: `0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a` citeturn5view2turn17view0
- Current quote asset: `0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC` citeturn5view2turn17view0
- DUSDC currency ID: `0xf3000dff421833d4bb8ed58fac146d691a3aaba2785aa1989af65a7089ca3e9c` citeturn5view1
- DUSDC decimals: `6` citeturn5view1
- PLP coin type: `0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138::plp::PLP` citeturn5view2
- Source branch: `predict-testnet-4-16` citeturn5view2turn17view0

The official docs and the Predict repository README agree on the recommended data model for apps: use the **public Predict server** for render-ready market, vault, portfolio, and history data; use **Sui events/checkpoints** when the UI needs fresher oracle updates; and use **direct onchain object reads** only around wallet flows that require authoritative state. That split is a hard constraint for this MVP, because it avoids building a custom indexer while preserving correctness around transactions. citeturn4view5turn7view0turn17view0

**Verification note:** the official handbook shortlink resolved to a Notion destination that was not directly retrievable in this session, so any handbook-only wording, track nuances, or submission wording should be rechecked against your local copy before final submission. Treat handbook-specific details that are not also present on official public pages as `TODO VERIFY`. citeturn25view0

## MVP objective and success definition

The official Overflow website describes the **DeepBook specialized track** as a place to build **trading or liquidity applications powered by DeepBook’s on-chain orderbook**, and shows a **$70,000** specialized prize pool for DeepBook. DeepBook’s own site now presents **Spot, Margin, and Predict** as “three primitives, one financial stack,” which means a serious Predict integration is aligned with the broader DeepBook product direction rather than being an unrelated side experiment. citeturn22view0turn22view2turn22view3turn28view0

Past Sui Overflow winners suggest a clear pattern: protocol-native tools, trading bots, vaults, unified account models, and composable financial products tend to outperform generic surfaces. In 2024, winning or placing projects included a **DeepBook market-making vault**, an **arbitrage bot**, and a **flashloan indexer**. In 2025, winning DeFi projects emphasized **modular vaults**, **programmable finance**, and **unified account models**. That pattern suggests that PredictPilot should optimize for **native DeepBook execution plus clear productized UX**, not for a shallow dashboard or a speculative AI wrapper. citeturn9view1turn9view2turn9view3

**MVP objective**

Build a polished **DeepBook Predict Intelligence & Execution Terminal** that proves three things in one demo:

- PredictPilot can read the official DeepBook Predict market surface correctly.
- PredictPilot can help a user understand market state, oracle lifecycle, balances, and protocol constraints before acting.
- PredictPilot can execute real **testnet** DeepBook Predict transactions reliably through a wallet. citeturn3view2turn17view0turn21view2

**MVP success definition**

The MVP is successful if a judge can see, in one short session, that PredictPilot:

- connects a Sui wallet,
- finds or creates exactly one reusable `PredictManager`,
- shows wallet and manager DUSDC balances,
- renders market/oracle state from the official Predict server,
- executes a real binary position mint,
- executes a real binary position redeem,
- shows portfolio state updating after the transaction,
- executes a real LP supply into the Predict vault and returns `PLP`,
- explains why the current market is safe or unsafe to trade using deterministic protocol-aware signals. citeturn3view5turn6view0turn7view0turn17view0turn19view0

**Hackathon-winning scope strategy**

The winning strategy is to ship **two reliable vertical slices** instead of a sprawling product:

- a **Trader Flow** for manager creation, funding, binary minting, and redeeming,
- an **LP Flow** for vault analytics and DUSDC supply into `PLP`.

Everything else is secondary. This is the smallest scope that still looks like a real DeepBook product rather than a toy interface. It also aligns with the track language around **trading** and **liquidity** applications. citeturn22view0turn22view3turn28view0

## Must-have product surface

The Predict README, docs, and contract pages define the exact integration surfaces that matter most for an app engineer: `Predict` as the shared protocol object, `PredictManager` as the per-user account object, `OracleSVI` as the per-underlying-and-expiry market state, internal position quantities keyed by `MarketKey` and `RangeKey`, and `PLP` as the LP share token. The same materials also name the core write entry points that matter for a product MVP: `predict::create_manager`, `predict::mint`, `predict::redeem`, `predict::supply`, and `predict::withdraw`. citeturn3view4turn3view5turn4view4turn17view0

**`MUST HAVE` features**

- **Markets dashboard.** Show active Predict markets using `GET /predicts/:predict_id/oracles`, current protocol state from `GET /predicts/:predict_id/state`, and current oracle state from `GET /oracles/:oracle_id/state`. The trading page should follow the official recommended page-level usage: `predict state` + `predict oracles` + `oracle state`. citeturn7view0turn17view0
- **Market detail terminal.** For a selected oracle, show lifecycle status, expiry, spot, forward, settlement if present, accepted quote asset, and resolved ask-bounds. `OracleSVI` lifecycle is central because an oracle can be inactive, active, pending settlement, or settled, and tradeability depends on that status. citeturn4view4turn8search4turn7view0
- **Deterministic intelligence panel.** Add a product layer that converts raw protocol data into concise guidance such as: `tradeable now`, `near expiry`, `settled`, `ask-bound constrained`, `insufficient manager balance`, or `manager not ready`. This is a product decision built on top of official lifecycle, quote-asset, ask-bound, and manager concepts. citeturn4view4turn7view0turn17view0
- **Wallet connection.** Use the official Sui dApp Kit and Wallet Standard so any compatible wallet is detected automatically. The MVP should not implement wallet-specific connection code. citeturn3view9turn13search0
- **PredictManager setup.** Detect an existing manager, or create one if absent. The docs are explicit that each user should create **one** `PredictManager` and reuse it, and that positions and ranges are **not separate objects** but quantities stored inside the manager. citeturn3view5turn14search8turn17view0
- **Manager funding.** Show both wallet DUSDC balance and deposited manager DUSDC balance. The contract docs state that the manager owner deposits quote assets before minting positions or ranges, and can withdraw quote assets from the manager. citeturn6view0turn6view1
- **Binary trading flow.** Support one clean path for minting a directional binary position with `predict::mint<Quote>` and one clean path for redeeming it with `predict::redeem<Quote>`. These are the canonical trader actions for the MVP. citeturn4view0turn4view1turn17view0
- **Portfolio page.** Use the official manager endpoints to render `summary`, `positions/summary`, and PnL. The official recommended portfolio page surface is exactly `manager summary` + `positions summary` + `pnl`. citeturn7view0turn17view0
- **Vault page.** Show `vault summary`, historical vault performance, LP history, and the user’s ability to supply DUSDC for `PLP`. The official recommended vault page surface is `vault summary` + `vault performance`. citeturn7view0turn17view0
- **LP supply execution.** Support `predict::supply<Quote>` so a user can send DUSDC into the Predict vault and receive `PLP`. The Predict docs and scripts confirm this flow and the repository includes a testnet supply script that calls `predict::supply` directly. citeturn4view2turn17view0turn19view0
- **Transaction feedback loop.** Every write must show wallet confirmation state, submitted digest, success/failure, and a post-transaction refresh of both direct onchain state and page-level indexed endpoints. The official Predict README explicitly warns not to assume the server is zero-lag after a write. citeturn17view0
- **Judge-ready reliability layer.** Include basic preflight validation before enabling actions: wallet connected, manager exists or will be created, enough DUSDC, oracle tradeable, and known current package/object IDs loaded from config. This is a product decision grounded in the official protocol surfaces and lifecycle rules. citeturn5view2turn8search4turn17view0

**Risk preview scope for the MVP**

The protocol exposes authoritative concepts for previewing risk or feasibility, including oracle lifecycle, ask bounds, vault exposure policy, and read functions for trade-amount calculations. The MVP should therefore include **qualitative and operational risk preview** as a must-have, while keeping exact pricing previews lighter unless the implementation is fully verified. citeturn4view0turn4view4turn7view0

The MVP **must** show:

- whether the oracle is currently tradeable,
- whether the market is near or past expiry,
- whether the user has enough DUSDC in the manager,
- whether the action is mint, redeem, or LP supply,
- whether the trade is using the current accepted quote asset,
- whether the page is showing indexed data or freshly refreshed post-transaction data.

The MVP **does not need** a full quant engine or a complex scenario simulator.

## Secondary scope and exclusions

The protocol supports more than the MVP needs. The docs expose vertical range trading through `get_range_trade_amounts`, `mint_range`, and `redeem_range`, and the vault surface also supports `withdraw()` subject to max-payout coverage. The official event list also supports a fresher oracle tape through `OraclePricesUpdated`, `OracleSVIUpdated`, `OracleSettled`, and `OracleActivated`. Those are valuable, but they are not all equal in MVP priority. citeturn4view0turn4view1turn4view3turn7view0

**`SHOULD HAVE` after the core demo works**

- **Vertical range execution.** One clean `mint_range` and `redeem_range` path would highlight that Predict is more advanced than a generic binary prediction market UI. citeturn4view0turn4view1
- **LP withdraw.** Support `predict::withdraw<Quote>` only after LP supply is stable, because withdrawals depend on vault availability after max-payout coverage. citeturn4view3turn4view4
- **Live oracle tape.** Subscribe to the official oracle events for a fresher trading page if the core indexed UI is already stable. citeturn7view0turn17view0
- **Exact pre-trade quote preview.** Use the documented read helpers such as `get_trade_amounts()` and `get_range_trade_amounts()` only after the core transaction paths are already verified. citeturn4view0turn4view1
- **Richer raw analytics.** Add expandable SVI parameter display and more detailed oracle history views after the core demo is stable. citeturn8search4turn7view0

**`COULD HAVE` if there is extra time without destabilizing the demo**

- Permissionless settled redeem UI for `redeem_permissionless`.
- A one-click “deposit and mint” or “create manager and deposit” convenience PTB.
- A narrow watchlist or saved market state.
- A dedicated judge-mode “guided tour” panel.
- CSV export of portfolio snapshots.

**`DO NOT BUILD` for the MVP**

- **Do not build a custom Move package** for trading logic. Sui’s own developer cheat sheet recommends using PTBs to compose existing onchain functionality whenever possible rather than publishing new smart contract code. DeepBook Predict already exposes the primitives this MVP needs. citeturn27view0turn17view0
- **Do not build a custom indexer or database-first analytics backend.** The Predict docs explicitly recommend the public Predict server as the default render backend and reserve direct chain reads for confirmation-critical state. citeturn4view5turn17view0
- **Do not build margin, spot-orderbook, or cross-protocol trading** into the MVP. DeepBook Margin is a separate product with its own pools, managers, orders, and risk ratios; folding it in would expand scope far beyond the Predict terminal proof. citeturn14search14turn8search8
- **Do not build registry/admin/oracle-operator flows.** The registry docs state that most app integrations do not call these functions directly; they are operator/governance surfaces. citeturn8search5
- **Do not build mainnet support.**
- **Do not build a generic AI chatbot or autonomous trading agent** unless it sits on top of a fully working Predict execution core.
- **Do not build social features, notifications, mobile apps, leaderboards, or multi-user collaboration** before the trader and LP flows are rock solid.

## Demo flows and integration scope

The official Predict integration materials define a straightforward product funnel: render current market state, create or find a manager, fund the manager, build transactions with generated bindings, confirm onchain state, and then refresh indexed surfaces. That is the exact flow PredictPilot should operationalize. citeturn17view0

**Core demo flow**

1. Open the Markets dashboard.
2. Display current protocol state, active oracles, and one selected market.
3. Connect a Sui wallet.
4. Detect an existing `PredictManager` or create one.
5. Show wallet DUSDC and manager DUSDC.
6. Deposit DUSDC into the manager if needed.
7. Mint one binary position.
8. Show the portfolio page update from manager summary and positions summary.
9. Redeem that position.
10. Switch to the Vault page and supply DUSDC to receive `PLP`.
11. Show that the LP position and vault summary updated.

This flow proves **read intelligence**, **wallet-based execution**, and **liquidity participation** in one terminal.

**Judge-mode flow**

The judge-mode flow should be the shortest, least fragile version of the product:

- Start from a pre-selected active oracle.
- Use a pre-funded demo wallet holding DUSDC.
- If possible, start with an already created manager to avoid first-time setup friction.
- Demo binary mint first.
- Demo redeem second, because it proves the product is not a one-way UI.
- Demo LP supply last, because it proves PredictPilot also covers the liquidity side of the protocol.
- Keep any settled-market demo optional rather than mandatory.

The repository scripts confirm that testnet DUSDC minting and vault supply are practical for demo preparation, so the demo environment should be prepared before recording or live judging. citeturn20view0turn19view0

**User flows included in the MVP**

- Connect a wallet through Wallet Standard / dApp Kit. citeturn3view9turn13search0
- Load markets, oracle state, vault state, and manager state from the official indexed surfaces. citeturn7view0turn17view0
- Create or reuse a single `PredictManager`. citeturn3view5turn17view0
- Deposit DUSDC into the manager. citeturn6view0
- Mint a binary position. citeturn4view0turn17view0
- Redeem a binary position. citeturn4view1turn17view0
- View portfolio PnL/positions summary. citeturn7view0turn17view0
- Supply DUSDC to the vault and receive `PLP`. citeturn4view2turn17view0turn19view0

**User flows excluded from the MVP**

- Oracle creation, activation, and updates.
- Registry configuration and quote-asset management.
- Margin trading.
- Spot orderbook trading.
- Cross-wallet account abstraction beyond standard wallet connection.
- Mainnet onboarding.
- Full LP withdraw optimization.
- Advanced automation, alerts, or strategy execution bots.

**DeepBook Predict integration scope**

PredictPilot’s MVP integrates exactly these DeepBook Predict surfaces:

- `Predict` shared object as the market root. citeturn3view4turn17view0
- `PredictManager` as the reusable user trading account. citeturn3view5turn17view0
- `OracleSVI` as the primary market-state object. citeturn4view4turn8search4
- `PLP` via vault supply. citeturn3view6turn8search6turn17view0
- Public Predict server endpoints for render and history. citeturn7view0turn17view0
- Live oracle events only as an enhancement layer. citeturn7view0

**PTB execution scope**

Sui PTBs allow multiple commands to execute in order, reuse prior command results, and apply atomically at the end; if any command fails, the whole block fails. The official Sui guidance also recommends PTBs for composing existing onchain functionality instead of writing new contracts. That makes PTBs the correct execution model for PredictPilot. citeturn21view2turn21view3turn27view0

The MVP execution rules are:

- Every write action must be a PTB.
- Each core action may ship initially as its own PTB: create manager, deposit, mint, redeem, supply.
- Combined convenience PTBs are optional, not required.
- The MVP should prefer generated bindings and typed helpers rather than hard-coded string targets scattered throughout the UI, because the official Predict README recommends `@mysten/codegen` for parsing, typed decoding, PTB helpers, and generated call targets. citeturn17view0

**Wallet integration scope**

The MVP wallet layer is intentionally simple:

- Use `@mysten/dapp-kit-react` and `@mysten/sui`.
- Use Wallet Standard discovery and the dApp Kit connection UI.
- Support transaction signing and execution from the connected wallet.
- Do not build custom wallet adapters.
- Do not add zkLogin, burner wallets, or alternative auth flows unless they are isolated from the main demo path. citeturn13search0turn3view9turn13search1

**dUSDC scope**

The current documented accepted quote asset is **testnet DUSDC**, with 6 decimals. The repo also includes a testnet `dusdcMint.ts` script that mints DUSDC using the configured treasury cap, which is useful for demo preparation but is **not** an end-user product flow. citeturn5view2turn20view0

So the MVP dUSDC scope is:

- read wallet DUSDC balance,
- read manager DUSDC balance,
- deposit DUSDC into manager,
- spend DUSDC in binary mint,
- spend DUSDC in LP supply,
- receive DUSDC back into the manager on redeem.

The MVP does **not** include an in-app DUSDC faucet or admin minting UI.

**PredictManager scope**

The manager scope is strict:

- one manager per user,
- manager discovery on connect,
- manager creation if missing,
- read owner/balances/position quantities,
- deposit quote assets,
- withdraw quote assets only if this can be implemented safely without destabilizing the demo. citeturn3view5turn6view0turn17view0

**OracleSVI scope**

The MVP must treat oracle lifecycle as a first-class UX concept:

- inactive,
- active,
- pending settlement,
- settled. citeturn4view4turn8search4

The user must always know whether a market is tradeable right now.

**Vault and `PLP` scope**

The vault takes the opposite side of every Predict trade, tracks balances/liabilities/max payout, and mints or burns `PLP` around supply/withdraw flows. The MVP must expose vault summary and LP supply. LP withdraw is secondary. citeturn3view6turn4view4turn8search6

**Market analytics scope**

The MVP market analytics scope is:

- active oracle list,
- current oracle details,
- lifecycle status,
- spot and forward,
- settlement if settled,
- ask bounds,
- time to expiry,
- tradeability status,
- recent trade/oracle history if cheap to load from official endpoints. citeturn7view0turn8search4turn17view0

**Portfolio analytics scope**

The MVP portfolio analytics scope is:

- manager summary,
- position summary,
- PnL series if available from the official endpoint,
- DUSDC manager balance,
- transaction history from indexed trade/redeem/mint endpoints if needed. citeturn7view0turn17view0

## Delivery scope

**Frontend MVP scope**

The frontend must feel like a real trading terminal, but the route surface should stay tight. The minimum route set is:

- `/markets`
- `/markets/[oracleId]`
- `/portfolio`
- `/vault`

A compact top-level layout with wallet connect, selected network badge, manager status, and current quote-asset status is enough. The UI should prioritize legibility, confidence, and clear execution states over decorative complexity.

**Backend MVP scope**

Do **not** build a heavy backend. The official Predict docs already supply a render-ready public server, and the official guidance is to use it for lists, history, portfolio summaries, and vault summaries. A thin server-side proxy or BFF is acceptable only if needed for caching, CORS hardening, or normalized response shapes. citeturn4view5turn7view0turn17view0

The backend **must not** include:

- a new database,
- a custom historical indexer,
- oracle-operation services,
- autonomous trade execution.

**Data fetching scope**

The fetching model must follow the official three-path split:

- **Default render path:** public Predict server. citeturn4view5turn17view0
- **Freshness path:** Sui oracle events/checkpoints for optional live tape. citeturn7view0turn17view0
- **Authority path:** direct onchain reads for manager/oracle/coin state around transaction flows. citeturn4view5turn17view0

If the implementation supports a custom RPC path, read-after-write consistency should reuse the same full node where practical, following Sui’s developer guidance. citeturn27view0

**Testing MVP scope**

The MVP testing bar is practical, not academic.

`MUST HAVE` testing:

- smoke-test every read adapter against the current Predict server endpoints,
- unit-test transaction-builder helpers and config parsing,
- manually verify create-manager, deposit, mint, redeem, and LP-supply on testnet,
- verify post-transaction refresh behavior on the live deployed app,
- verify UI behavior for the four oracle lifecycle states where sample data exists.

`SHOULD HAVE` testing:

- mocked component tests for terminal states,
- a basic end-to-end browser smoke path up to wallet interaction boundaries,
- replayable test-wallet setup instructions for demo prep.

**Deployment MVP scope**

Deployment should be simple:

- one publicly accessible web app,
- one testnet config set,
- one RPC configuration,
- one current Predict config file,
- one demo wallet prepared in advance,
- one fallback environment checklist.

No long-running servers should be required unless absolutely necessary for an event stream proxy.

**Documentation MVP scope**

The MVP documentation set must include:

- `README.md` with setup and demo steps,
- `.env.example`,
- verified Predict config constants with `TODO VERIFY` comments where needed,
- a short demo script,
- a testnet preparation guide for DUSDC and wallet funding,
- a troubleshooting section for stale package IDs, missing manager, and server lag.

## Non-goals, acceptance, and build order

**Non-goals**

PredictPilot MVP is **not** trying to be:

- a full prediction-market consumer app,
- a bespoke DeepBook indexer,
- a generalized DeFi analytics suite,
- a margin terminal,
- a spot-orderbook terminal,
- a mobile app,
- a mainnet product,
- a no-code strategy platform,
- a social or gamified experience.

**Stretch goals**

If the core experience is already stable, the best stretch goals are:

- vertical range mint/redeem,
- LP withdraw,
- event-driven live tape,
- exact pre-trade quote preview from onchain read helpers,
- a guided judge mode,
- richer raw oracle analytics.

**Kill list**

If schedule pressure appears, cut these first:

- range trading,
- live event streaming,
- LP withdraw,
- fancy charting,
- historical deep analytics,
- animations,
- watchlists,
- any AI chat layer.

Do **not** cut the core binary mint/redeem flow, manager flow, or LP supply flow.

**MVP acceptance criteria**

The MVP is accepted only when all of the following are true:

- the app loads current markets from the official Predict server,
- wallet connect works on testnet,
- a user can detect or create one `PredictManager`,
- DUSDC balances are shown in both wallet and manager contexts,
- a real binary mint succeeds on testnet,
- a real binary redeem succeeds on testnet,
- portfolio data refreshes correctly after execution,
- vault summary renders correctly,
- a real LP supply succeeds and returns `PLP`,
- the app never relies on unverified package IDs or guessed object shapes,
- the demo can be replayed with one prepared wallet and one prepared market selection.

**Definition of done**

PredictPilot MVP is done when the product is:

- **technically real** — no mocked core execution paths,
- **protocol-native** — built on the verified Predict testnet surface,
- **judge-ready** — short, reliable, and understandable,
- **scope-disciplined** — no distracting side systems,
- **documented** — reproducible setup and demo included.

**Build order**

1. Lock verified testnet constants and config loading.
2. Build read-only markets dashboard.
3. Build oracle detail page and intelligence panel.
4. Add wallet connect and manager discovery.
5. Add manager creation.
6. Add DUSDC deposit into manager.
7. Add binary mint.
8. Add portfolio refresh and positions summary.
9. Add binary redeem.
10. Add vault summary page.
11. Add LP supply and `PLP` receipt flow.
12. Add transaction toasts, loading states, and error handling.
13. Add demo mode, docs, and smoke testing.
14. Only then consider range trading, LP withdraw, and live tape.

**Final MVP checklist**

- [ ] Current Predict package, object, registry, DUSDC type, and PLP type are stored in config and marked re-verifiable.
- [ ] Markets page uses official indexed endpoints.
- [ ] Wallet connect works via dApp Kit.
- [ ] Manager detection works.
- [ ] Manager creation works.
- [ ] DUSDC wallet balance shows correctly.
- [ ] DUSDC manager balance shows correctly.
- [ ] Deposit flow works.
- [ ] Binary mint works.
- [ ] Binary redeem works.
- [ ] Portfolio page updates correctly.
- [ ] Vault summary page renders.
- [ ] LP supply works.
- [ ] Transaction digest, success, and failure states are visible.
- [ ] Demo wallet is pre-funded with DUSDC.
- [ ] README, env example, and demo script are complete.
- [ ] Anything not re-verified from the latest official docs is marked `TODO VERIFY`.