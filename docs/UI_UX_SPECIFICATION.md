# PredictPilot UI/UX Specification

PredictPilot is a DeepBook Predict intelligence and execution terminal for Sui Overflow 2026. The product must present DeepBook Predict as a serious onchain finance primitive on Sui Testnet, not as a casual betting site. Official DeepBook Predict documentation describes the protocol as an expiry-based prediction market with binary positions, vertical ranges, OracleSVI pricing, per-user `PredictManager` accounts, and a shared vault that issues `PLP` LP shares. The same documentation also recommends a split data model: render markets, portfolio, vault, and history from the public Predict server; use Sui checkpoint or event streams when lower-latency oracle freshness matters; and confirm wallet-critical state directly onchain. citeturn10search0turn10search1turn10search2turn9search3turn20view0turn20view1

This UI must be optimized for the actual hackathon context. The official Sui Overflow 2026 page positions the event as Sui’s global hackathon with $500K+ in prizes, lists DeepBook as a specialized sponsored track with a $70K track pool, and highlights global scale and follow-on opportunities. At the same time, the official page currently mixes 2026 branding with stale 2025 timeline copy in the rendered extraction, so PredictPilot must not hardcode hackathon dates or countdowns into product UI without separate verification from the participant handbook or repo config. Past Sui Overflow winner posts show that judges reward concrete, working products across infrastructure, trading, AI, wallets, and DeFi—not only consumer apps—which supports a terminal-style, execution-first product direction for PredictPilot. citeturn22search0turn19search0turn2view0turn18view0turn18view1

**Verified product constraints**

- DeepBook Predict is currently documented as a **Testnet** integration surface and the contracts may change before mainnet; the UI must communicate this persistently. citeturn10search0turn10search2
- The current public server base URL is **`https://predict-server.testnet.mystenlabs.com`**. citeturn10search2
- The current supported quote asset documented for Predict is **DUSDC**, with **6 decimals** on Testnet. citeturn10search2
- `PredictManager` is a **per-user shared account object** that should be created once and reused; binary and range positions are stored internally in the manager and are **not separate onchain objects**. citeturn20view0turn10search1turn9search4
- `OracleSVI` has explicit lifecycle states—**inactive, active, pending settlement, settled**—and minting requires a live oracle. citeturn9search3turn10search1
- LP flows use `predict::supply` and `predict::withdraw`, which mint and burn `PLP` shares against the shared vault. citeturn20view1turn20view2

**Product experience goals**

- Make PredictPilot feel like a **professional trading and risk terminal**.
- Make real **DeepBook Predict testnet execution** obvious.
- Make **oracle freshness**, **risk**, **ask bounds**, **expiry**, **manager balances**, and **transaction preview** visible before users sign.
- Make the judge’s first 90 seconds enough to understand:
  - what DeepBook Predict is,
  - why Sui is relevant,
  - what PredictPilot adds,
  - and that the product is executing real transactions.
- Keep the capable surface narrow. The official DeepBook Predict model already provides binary, range, manager, vault, and history primitives; the UI should clarify those primitives, not invent adjacent protocol abstractions. citeturn10search0turn9search1turn10search2

**Hackathon demo UX goals**

- Default the judge into a **single best path** from connect wallet → verify testnet → inspect oracle → preview transaction → execute → confirm digest → observe portfolio refresh.
- Ensure every demo screen has one obvious primary CTA.
- Prefer reliable, high-signal pages over breadth.
- Use real testnet reads and writes by default; any read-only fallback must be labeled **Read-Only Fallback** and must never masquerade as live execution.

**Target user experience**

- For a builder/trader, PredictPilot should feel closer to **Coinbase Advanced plus a protocol-sensitive research console** than to a browse-first consumer prediction app. Coinbase’s advanced interface centers interactive charts, live history, and an order-entry panel; TradingView emphasizes structured chart layouts as a user workspace; Polymarket foregrounds browse, trending, and category discovery. PredictPilot should borrow the first two patterns more than the third. citeturn24view0turn24view1turn24view3

**Judge experience**

- The judge must encounter:
  - a polished landing page that frames the thesis,
  - a terminal dashboard that surfaces real protocol state,
  - transaction preview before signing,
  - confirmed wallet execution,
  - and post-transaction refresh that proves state changed.
- The judge must never need to infer hidden protocol logic. Every important term should have visible first-run help: `PredictManager`, `OracleSVI`, `PLP`, `dUSDC`, ask bounds, expiry, settlement.

**Proof-first UX layer**

PredictPilot’s next judge-facing layer is Proof Mode: a compact route and shared proof model that answers one question quickly: “Can this live DeepBook Predict action be trusted?” It should be designed for a 60 to 90 second judge check, not for long-form analytics.

Required Proof Mode states:

- **Blocked**: a required prerequisite is missing, such as wallet connection, Testnet, manager, dUSDC, selected oracle, or simulation.
- **Ready**: the app has enough verified inputs to prepare or review a transaction, but no wallet signature has been requested.
- **Ready but Not Submitted**: a PTB was built and simulated, but the user has not approved a wallet transaction.
- **Pending Index**: a chain-confirmed digest exists, but Predict server portfolio/history refresh has not caught up yet.
- **Verified**: chain confirmation exists and required post-transaction refresh checks are visible.
- **Failed**: wallet rejection, simulation failure, transaction failure, or refresh failure prevents proof completion.

Required source labels:

- **Wallet**: connected account, network, wallet rejection, user approval, and wallet-return state.
- **Chain**: confirmed digest, explorer link, transaction effects, and authoritative object or coin reads.
- **Predict server**: market, manager, vault, PnL, and history rows from the public Predict server.
- **Local**: UI-only selections, form inputs, demo fixtures, route state, and copied proof summaries.

Proof copy rules:

- Never call a digest `Verified` until chain confirmation exists.
- Never treat Predict-server indexed refresh as stronger than chain proof.
- Never show a demo fixture, copied summary, or local session as live Testnet proof.
- If chain proof exists but portfolio/history has not refreshed, show `Pending Index` with a retry or refresh action.
- Keep the proof verdict above supporting details so judges do not have to read a whole page to understand status.

**Design principles**

- **Execution over decoration.**
- **Risk before action.**
- **Freshness over false precision.**
- **Manager-centric portfolio, not NFT-centric portfolio.**
- **Protocol language over consumer-gambling language.**
- **One-screen clarity over feature sprawl.**
- **Source transparency over black-box numbers.**

**Visual design direction**

- Use a **dark, high-contrast terminal theme** with restrained Sui-inspired cyan accents and disciplined status colors. Sui’s official brand guidance describes the logo as a droplet and the wordmark as neutral and organic; PredictPilot should respect this by using clean, restrained accents rather than loud gradients or casino-like neon overload. citeturn13search2turn13search3
- Make the app feel “institutional but modern,” with dense data presentation, precise alignment, clear separators, and low-friction scanning.
- Use emphasis hierarchy:
  - primary surface for live market context,
  - secondary surface for execution,
  - tertiary surface for supporting analytics and history.

**Information architecture**

- **Marketing layer**
  - Landing page
  - Judge/demo entry
  - Documentation links
- **Terminal layer**
  - Dashboard
  - Market Intelligence
  - SVI Surface
  - Oracle Status
  - Strategy Builder
  - Risk Preview
  - Transaction Preview
  - Proof Mode
  - Portfolio
  - PnL
  - Vault and PLP
  - Transaction History
  - Demo Mode
- **Global overlays**
  - Wallet connect
  - Network / testnet warning
  - Data freshness inspector
  - Activity toasts
  - Error recovery drawer

**Navigation structure**

- Primary sidebar navigation:
  - Dashboard
  - Markets
  - Strategy
  - Portfolio
  - Vault
  - History
  - Demo
- Secondary top bar:
  - current oracle selector,
  - freshness badges,
  - wallet status,
  - network badge,
  - manager badge,
  - quick actions.
- Right rail:
  - context-sensitive execution rail for create manager, deposit, mint, redeem, supply, withdraw.
- Never hide execution behind deep modals if it is the primary purpose of the page.

**Core app layout**

- Desktop-first three-column terminal:
  - **Left rail:** navigation, watchlist, market/oracle quick-switcher.
  - **Center pane:** chart, analytics, tables, strategy context.
  - **Right rail:** execution + preview + balances.
- This layout is intentionally aligned with professional trading UX patterns where charts, tape/history, and order entry remain visible together. citeturn24view0turn24view1

## Information architecture and screen specifications

**Priority model**

- **MUST**
  - Landing Page
  - Dashboard
  - Market Intelligence
  - Oracle Status
  - Strategy Builder
  - Risk Preview
  - Transaction Preview
  - Proof Mode
  - Portfolio
  - Vault and PLP
  - Transaction History
  - Demo Mode
- **SHOULD**
  - SVI Surface
  - PnL
  - Dedicated error/fallback views
  - Mobile stacked terminal
- **COULD**
  - Saved layouts
  - Multi-chart modes
  - Advanced custom indicators
- **DO NOT BUILD**
  - social comments,
  - gamified badges,
  - leaderboards,
  - sportsbook-style browsing,
  - fake “AI certainty” meters not grounded in visible inputs.

**Landing page specification**

- Route: `/`
- Purpose: explain the thesis in under 20 seconds.
- Required sections:
  - hero headline: “DeepBook Predict Intelligence and Execution Terminal”
  - subheadline explaining binary, range, vault, and oracle-aware execution
  - proof ribbon:
    - Sui Testnet
    - DeepBook Predict
    - PTB-backed execution
    - dUSDC
    - Wallet connect
  - three differentiators:
    - Oracle-aware strategy building
    - Risk and preview before signing
    - Manager-centric portfolio and LP analytics
  - primary CTA: **Open Terminal**
  - secondary CTA: **Watch Judge Flow**
- Visual treatment:
  - clean, dark, premium
  - animated but subtle gradients or grid
  - no meme imagery
- Do not show generic “bet on anything” messaging. Use official protocol language: positions, ranges, oracle-driven pricing, vault liquidity. citeturn10search0turn9search1turn20view2

**Dashboard specification**

- Route: `/app`
- Purpose: best single-screen judge overview.
- Required modules:
  - active oracle summary
  - strategy builder summary
  - oracle freshness card
  - wallet dUSDC balance
  - manager dUSDC balance
  - open positions summary
  - vault summary
  - recent activity feed
- Primary CTA:
  - if disconnected: **Connect Wallet**
  - if no manager: **Create PredictManager**
  - if manager exists but empty: **Deposit dUSDC**
  - else: **Build Trade**
- Layout:
  - center: selected market panel + chart
  - right: execution rail
  - bottom: history + portfolio summary
- The dashboard must pull render-ready data from official Predict server surfaces where available. Official endpoints exist for predict state, oracle state, vault summary, manager summary, positions summary, PnL, and history. citeturn10search2

**Market intelligence screen specification**

- Route: `/app/markets`
- Purpose: search, compare, and inspect active Predict markets/oracles.
- Required modules:
  - oracle list with lifecycle status
  - asset / underlying selector
  - expiry grouping
  - current price / forward / freshness snapshot
  - ask bounds summary
  - tradeability flag
  - recent mint/redeem activity
- Each oracle card must show:
  - underlying label
  - expiry
  - lifecycle state
  - last update time
  - settlement status if settled
  - quick-action buttons: **Binary**, **Range**, **View Oracle**
- This screen must feel analytical, not promotional. `OracleSVI` stores spot, forward, SVI parameters, last update timestamp, settlement price, and lifecycle state; the intelligence screen should surface these rather than generic “hot market” cards. citeturn9search3turn10search1

**SVI surface screen specification**

- Route: `/app/svi`
- Priority: **SHOULD**
- Purpose: make PredictPilot visibly more sophisticated than a normal prediction UI.
- Required modules:
  - current oracle SVI parameter summary
  - derived volatility smile or surface visualization
  - historical SVI update timeline
  - price vs forward context
  - expiry marker
- UX rule:
  - if full surface derivation is not yet stable, ship a 2D smile / parameter panel rather than a broken 3D visualization.
- Label any derived visualization as:
  - **Derived from current OracleSVI parameters**
- Official docs confirm OracleSVI stores SVI volatility surface parameters and exposes SVI history endpoints in the public server. Exact visualization math for the frontend remains **TODO VERIFY** against the repo and integration layer. citeturn9search3turn10search2

**Oracle status screen specification**

- Route: `/app/oracles/[oracleId]`
- Purpose: make lifecycle and freshness explicit.
- Required content:
  - lifecycle badge: Inactive / Active / Pending Settlement / Settled
  - last price update timestamp
  - last SVI update timestamp
  - settlement price when available
  - time to expiry / expired marker
  - tradeability explanation
  - event timeline:
    - activated
    - prices updated
    - SVI updated
    - settled
- Oracle state is critical because mints require a live oracle, while redeems can use live or settled state. citeturn9search3turn10search1turn10search2

**Strategy builder screen specification**

- Route: `/app/strategy`
- Purpose: primary execution workspace.
- Modes:
  - **Binary**
  - **Range**
  - **Vault LP**
- Binary mode must include:
  - oracle selector
  - strike selector
  - direction selector using **Up** / **Down**
  - quantity input
  - manager balance summary
  - preview button
- Range mode must include:
  - oracle selector
  - lower strike
  - upper strike
  - quantity input
  - preview button
- Vault LP mode must include:
  - supply amount
  - withdraw amount
  - PLP summary
  - available withdrawal indicator
- Use official terminology:
  - `mint`
  - `redeem`
  - `mint range`
  - `redeem range`
  - `supply`
  - `withdraw`
- Public Predict functions exist for previewing binary and range trade amounts, minting/redeeming each, and supplying/withdrawing vault liquidity. citeturn20view2

**Risk preview screen specification**

- Route: `/app/strategy/risk`
- Purpose: force comprehension before execution.
- Required fields:
  - operation type
  - oracle state
  - quote asset
  - quantity
  - estimated cost or payout
  - ask bounds status
  - manager balance before / after
  - expiry context
  - settlement warning if expired
  - gas estimate state: estimated / unavailable
  - source badges: server / onchain / simulated
- Presentation:
  - compact summary card at top
  - expandable “why this may fail” section
  - explicit warnings when:
    - no manager,
    - insufficient manager balance,
    - oracle inactive,
    - oracle pending settlement,
    - stale data,
    - ask-bounds risk,
    - withdrawal availability insufficient.
- Risk must appear before the confirmation CTA, never after.

**Transaction preview screen specification**

- Route: `/app/strategy/preview`
- Purpose: show the PTB intent in human terms.
- Required content:
  - action verb
  - object context:
    - Predict object
    - Oracle ID
    - PredictManager ID
    - quote asset type
  - expected balance changes
  - expected position quantity change
  - expected PLP change for LP flows
  - digest placeholder while pending
  - explorer link after success
- Transaction preview must describe user intent as steps:
  - create manager if needed,
  - deposit dUSDC if included,
  - execute mint/redeem/supply/withdraw,
  - apply post-transaction refresh.
- PTBs on Sui execute atomically and sequentially; if one command fails, the whole block fails. This is why the UI must preview combined steps clearly. citeturn11view2turn11view3

**Portfolio screen specification**

- Route: `/app/portfolio`
- Purpose: manager-centric portfolio inspection.
- Required modules:
  - connected address
  - current manager ID
  - wallet dUSDC balance
  - manager dUSDC balance
  - open binary positions
  - open range positions
  - realized / unrealized PnL summary
  - recent executions
- Critical UX rule:
  - do **not** represent positions as standalone collectible cards or token objects.
  - represent them as quantities grouped by oracle, expiry, strike, and direction / range.
- This rule follows official PredictManager and MarketKey/RangeKey documentation. citeturn20view0turn9search4turn10search1

**PnL screen specification**

- Route: `/app/pnl`
- Priority: **SHOULD**
- Purpose: show profitability and usage over time for judges and users.
- Required modules:
  - cumulative PnL chart
  - realized vs unrealized split
  - PnL by oracle
  - PnL by strategy type
  - date range selector
- Use official manager PnL endpoint where possible. Exact supported range query values beyond the documented `range=ALL` are **TODO VERIFY**. citeturn10search2

**Vault and PLP screen specification**

- Route: `/app/vault`
- Purpose: prove PredictPilot supports both trader and LP workflows.
- Required modules:
  - vault value
  - concrete quote balances
  - mark-to-market liability
  - total max payout
  - PLP supply summary
  - performance chart
  - supply and withdraw rail
- Required copy:
  - “The vault takes the opposite side of every trade.”
  - “PLP represents LP shares in the shared vault.”
- This follows the official Vault design and contract information. citeturn20view1turn9search1

**Transaction history screen specification**

- Route: `/app/history`
- Purpose: prove real usage and make debugging transparent.
- Required tabs:
  - Binary Minted
  - Binary Redeemed
  - Range Minted
  - Range Redeemed
  - LP Supplies
  - LP Withdrawals
  - Wallet Transactions
- Each row should show:
  - timestamp
  - oracle / market
  - action
  - quantity
  - value
  - manager
  - digest
  - status
- Predict server exposes history endpoints for positions, ranges, LP supply/withdrawal, and trades. citeturn10search2

**Demo mode screen specification**

- Route: `/demo`
- Purpose: one-click judge path.
- Required modules:
  - “What you are about to see” summary
  - stepper:
    - connect wallet
    - verify manager
    - inspect oracle
    - preview position
    - sign transaction
    - confirm digest
    - observe portfolio refresh
  - jump buttons to preselected oracle and strategy
  - copy-ready judge narration in a side panel
  - visible real/testnet status
- Demo mode must use real live data and real wallet flows by default.
- Optional fallback:
  - a manually toggled read-only mode for conference Wi-Fi failure,
  - always labeled **Read-Only Fallback**,
  - never default.

**Error and fallback screen specification**

- Required top-level error cases:
  - wrong network
  - no wallet installed
  - Predict server unavailable
  - onchain read failure
  - manager not found
  - insufficient dUSDC
  - oracle not tradeable
  - preview unavailable
  - transaction rejected
  - indexing delay
- Every error must have:
  - plain-language explanation,
  - technical details accordion,
  - next best action,
  - retry action where appropriate.

**Empty state specification**

- Empty states must be useful:
  - no manager → “Create your PredictManager to hold quote balances and positions.”
  - no dUSDC → “Request or fund testnet dUSDC, then deposit into your manager.”
  - no positions → “Mint a binary or range position to start building a portfolio.”
  - no PLP → “Supply dUSDC to the vault to mint PLP shares.”
  - no history → “Your executed transactions will appear here after confirmation and indexing.”

**Loading state specification**

- Use structural skeletons, not spinners alone.
- Every loading state must distinguish:
  - initial load,
  - refreshing stale data,
  - transaction pending,
  - indexing catch-up.
- Use explicit labels:
  - **Loading onchain state**
  - **Refreshing indexed data**
  - **Waiting for transaction confirmation**
  - **Waiting for server indexing**

**Success state specification**

- A successful action must show:
  - human-readable summary,
  - digest,
  - post-state delta,
  - next CTA.
- Example:
  - “Binary position minted”
  - “Manager balance updated”
  - “Portfolio refresh in progress”

## Transactional UX and system states

**Wallet connection UX**

- Use Sui dApp Kit as the default connection layer.
- Use a visible **Connect Wallet** button in the top-right header and on disconnected landing states.
- After connection, show:
  - wallet name
  - truncated address
  - network
  - account switch affordance
- Official Sui documentation identifies dApp Kit as the official SDK for building Sui apps, says Wallet Standard wallets are detected automatically, and provides hooks for wallet, account, and network state. citeturn11view1turn23view0turn23view1

**Testnet warning UX**

- Persistent badge in header: **Sui Testnet**
- Persistent banner on first terminal entry:
  - “DeepBook Predict is currently documented as a Testnet integration surface. Contracts and IDs may change before mainnet.”
- Banner actions:
  - **I understand**
  - **Open technical details**
- Exact technical details may expose current package/object/server config in a collapsible debug drawer sourced from runtime config, not hardcoded UI text. The warning is required because official docs treat current deployments as provisional testnet targets. citeturn10search0turn10search2

**dUSDC balance UX**

- Show two separate balances everywhere:
  - **Wallet dUSDC**
  - **Manager dUSDC**
- Never merge them.
- Deposit flow must visually move balance from wallet to manager.
- Use 6-decimal asset handling internally and friendly display formatting externally.
- Include “Current quote asset: dUSDC” in the first-run help panel. Official contract info documents DUSDC as the current quote asset with 6 decimals on testnet. citeturn10search2

**PredictManager UX**

- PredictManager is a first-class user identity artifact inside the terminal.
- Show manager state in the header:
  - Missing
  - Ready
  - Refreshing
- When missing:
  - replace execution CTA with **Create PredictManager**
- When ready:
  - show truncated manager ID
  - copy button
  - last refreshed
- Use a dedicated setup card because the manager is not obvious to first-time users but is protocol-critical. Official docs instruct each user to create one manager and reuse it. citeturn20view0turn20view2

**Binary mint UX**

- Flow:
  - choose oracle
  - choose expiry / strike
  - choose direction
  - enter quantity
  - view preview
  - sign
  - confirm
- Before signing, show:
  - mint cost
  - manager balance after
  - oracle freshness
  - ask bounds note
  - expiry note
- Use official protocol verb **Mint binary position**, not “Place bet.” citeturn20view2turn9search3

**Binary redeem UX**

- Flow:
  - select open position
  - edit partial/full quantity
  - preview payout
  - sign
  - confirm
- If settled:
  - label clearly as **Settled Redeem**
- If unsettled but redeemable:
  - label as **Live Redeem**
- Explain that payout returns to the owner’s `PredictManager`. citeturn20view2

**Range mint UX**

- Flow mirrors binary but requires lower and upper strikes.
- Show range visually on a strike band chart.
- Validate lower < upper inline.
- Use protocol terms:
  - `mint_range`
  - bounded range position
- Official docs define range positions by oracle ID, expiry, lower strike, and higher strike. citeturn20view2turn9search4

**Range redeem UX**

- Present open range positions in grouped rows:
  - oracle
  - expiry
  - lower
  - upper
  - qty
  - estimated payout
- Support partial and full redeem.
- Explain that value returns to the manager, not directly to the wallet. citeturn20view2

**Vault supply UX**

- Use LP-specific language:
  - “Supply dUSDC”
  - “Receive PLP shares”
- Required preview fields:
  - supply amount
  - expected PLP
  - vault value snapshot
  - liability snapshot
- Explain that first supplier math and later supplier proportionality may differ; if exact frontend math is not fully validated, label estimates as estimates and defer authoritative values to onchain confirmation. Official docs explain the vault and PLP share model. citeturn9search1turn20view1turn20view2

**Vault withdraw UX**

- Required preview fields:
  - PLP to burn
  - expected quote out
  - available withdrawal note
- Include explicit warning:
  - “Withdrawals are constrained by current max payout coverage.”
- This maps directly to official withdraw behavior. citeturn20view2turn20view1

**Risk explanation UX**

- Every execution form must contain a compact inline risk summary plus a deep-dive modal.
- Risk categories:
  - protocol state
  - oracle freshness
  - ask bounds
  - settlement proximity
  - balance sufficiency
  - indexing lag after execution
- Avoid speculative VaR-style numbers unless verified.
- Prefer source-backed, protocol-native constraints.

**Oracle freshness UX**

- Use a highly visible badge system:
  - **Live**
  - **Aging**
  - **Stale**
  - **Settled**
- Badge computation:
  - based on last onchain or indexed update timestamp
  - thresholds set via config
- Always display the raw timestamp on hover / tap.
- Because OracleSVI includes a `last update timestamp`, the UI should expose freshness directly rather than letting users infer it from chart movement. citeturn9search3

**Data freshness UX**

- Every major data block must show a source badge:
  - **Indexed**
  - **Onchain**
  - **Live Events**
- Freshness inspection drawer must show:
  - last server fetch time
  - last onchain object read time
  - last event time
  - current mode
- This follows official design guidance to split reads by freshness and purpose. citeturn10search1turn10search0

**Confirmation flow UX**

- Confirmation is a two-stage process:
  - **Preview accepted**
  - **Wallet signing requested**
- The signing modal should remain conceptually distinct from the preview state.
- After wallet submit:
  - show digest as soon as available
  - move action card into **Pending Confirmation**
  - then **Refreshing Onchain**
  - then **Refreshing Indexed Views**
- Sui Wallet Standard and dApp Kit support sign-and-execute flows; PTBs should be constructed in app code and submitted through wallet signing rather than hand-waving execution invisible to the user. citeturn11view0turn11view3turn23view2

**Post-transaction UX**

- After success, immediately refresh:
  - manager balances
  - manager positions
  - selected oracle state if relevant
  - vault summary if relevant
  - history tab
- If indexed data lags onchain confirmation:
  - show “Onchain confirmed, waiting for indexed refresh”
  - keep the success card visible until server catches up
- Never silently overwrite a stale screen after execution.

**Wrong-network UX**

- Wrong network must lock execution rail entirely.
- Provide a single CTA:
  - **Switch to Testnet**
- If wallet does not support network switching programmatically:
  - provide clear instructions and linkable help text.

**Wallet account change UX**

- When the wallet account changes:
  - clear manager cache
  - refetch manager list
  - invalidate portfolio
  - show toast:
    - “Wallet account changed. Refreshing manager and portfolio state.”
- Wallet Standard defines change events for accounts, chains, and features; the app should respond visibly. citeturn11view0

## Responsive design system and components

**Mobile responsiveness requirements**

- PredictPilot is **desktop-first** because the core experience is a terminal.
- Breakpoints:
  - **Desktop ≥ 1280px**: full 3-column terminal
  - **Tablet 768–1279px**: 2-column with collapsible right execution rail
  - **Mobile < 768px**: stacked layout with bottom-sheet execution
- Mobile priorities:
  - view market
  - connect wallet
  - inspect balances
  - execute one focused action
- Mobile depriorities:
  - multi-panel simultaneous comparison
  - dense history tables
  - full SVI visualization
- Use sticky bottom CTA on mobile:
  - **Preview Trade**
  - **Deposit dUSDC**
  - **Supply Vault**
- Judges will likely evaluate on desktop, so desktop polish takes precedence.

**Accessibility requirements**

- Target WCAG AA contrast for all text and interactive controls.
- Full keyboard navigation required on desktop:
  - sidebar
  - tabs
  - charts fallback controls
  - forms
  - modals
- Every badge and color status must have text labels.
- Provide reduced-motion mode for animated charts and confirmation effects.
- Tooltip-only explanations must also be available through focusable help affordances or inline copy.

**Component library specification**

- Base stack:
  - React
  - Tailwind CSS
  - shadcn/ui-style primitives or equivalent custom primitives
  - Sui dApp Kit wallet components
- Core component primitives:
  - `AppShell`
  - `SidebarNav`
  - `TopStatusBar`
  - `ExecutionRail`
  - `DataCard`
  - `MetricCard`
  - `FreshnessBadge`
  - `LifecycleBadge`
  - `SourceBadge`
  - `RiskPanel`
  - `TxPreviewDrawer`
  - `ConfirmActionBar`
  - `ActivityFeed`
  - `TerminalTable`
  - `OracleChart`
  - `StrikeSelector`
  - `RangeSelector`
  - `EmptyState`
  - `ErrorState`
  - `SuccessState`

**Typography guidance**

- Use a modern grotesk sans such as **Inter** or equivalent system-safe alternative.
- Hierarchy:
  - Display: landing hero only
  - H1/H2: screen titles
  - Label: uppercase, compact, analytics-style
  - Numeric: tabular figures for balances, price, pnl, timestamps
- Numeric typography must prioritize alignment and quick scan.

**Spacing guidance**

- Use an 8px base grid.
- Dense terminal cards:
  - 12–16px interior padding
- Marketing cards:
  - 20–24px interior padding
- Tables:
  - compact row height on desktop
  - touch-friendly expanded row height on mobile

**Color system guidance**

- Recommended token direction:
  - `bg.canvas`: deep navy-black
  - `bg.surface`: slightly raised graphite/blue
  - `border.subtle`: low-contrast slate
  - `text.primary`: near-white
  - `text.secondary`: muted gray-blue
  - `accent.sui`: cool cyan
  - `accent.deepbook`: electric teal or blue-cyan variant
  - `state.success`: green
  - `state.warning`: amber
  - `state.error`: red
  - `state.pending`: indigo
- Use color sparingly.
- The app should feel measured and technical, not loud and speculative.

**Chart design requirements**

- Use the chart to answer user questions, not to decorate the screen.
- Required chart types:
  - oracle price history
  - PnL time series
  - vault performance
  - strike-band visualization
  - optional SVI smile/surface
- Chart labels must include:
  - source
  - last updated
  - interval or range
- Inspired pattern:
  - interactive chart center-stage,
  - controls along the header,
  - history context visible nearby. citeturn24view0turn24view1
- Do not build faux candlesticks for data that is not naturally OHLC.
- If data does not support depth or ladder behavior, do not imitate an order book just to look advanced.

**Table design requirements**

- All dense data views use a terminal-style table:
  - sticky headers
  - aligned numeric columns
  - contextual row actions
  - expandable details drawer on smaller screens
- Core tables:
  - oracle list
  - position list
  - range list
  - LP activity
  - transaction history

**Form design requirements**

- Group forms by action, not by raw protocol argument order.
- Every action form must include:
  - prerequisites
  - input fields
  - preview button
  - risk notes
  - confirm CTA
- Auto-fill supportive context:
  - current manager balance
  - current oracle
  - current quote asset
- Validate inline, not only on submit.

**Button and CTA requirements**

- Use a single dominant CTA per view.
- Button hierarchy:
  - primary: preview or execute
  - secondary: view details / refresh
  - tertiary: copy id / open help
- Avoid ambiguous CTA text like “Submit”.
- Use protocol-specific CTA text:
  - `Create PredictManager`
  - `Deposit dUSDC`
  - `Preview Binary Mint`
  - `Mint Binary Position`
  - `Redeem Binary Position`
  - `Preview Range Mint`
  - `Supply Vault`
  - `Withdraw Vault`

**Modal and drawer requirements**

- Use right-side drawers on desktop for:
  - transaction preview
  - risk detail
  - data freshness inspector
- Use bottom sheets on mobile.
- Use confirm dialogs only for destructive or irreversible context shifts, not for every action.

**Toast and notification requirements**

- Toast types:
  - wallet connected
  - manager detected
  - preview ready
  - wallet signature requested
  - transaction submitted
  - transaction confirmed
  - indexed refresh complete
  - warning / error
- Toasts must include status icon and concise text.
- Transaction-related toasts must link to the detailed activity panel.

**Tooltip and help text requirements**

- Every complex protocol label needs first-run help:
  - `OracleSVI`
  - `PredictManager`
  - `PLP`
  - `ask bounds`
  - `pending settlement`
- Tooltips must be short; drawers or help panels can go deeper.

## Content, trust, and demo polish

**Copywriting guidelines**

- Use precise, protocol-aligned words:
  - position,
  - range,
  - vault,
  - oracle,
  - manager,
  - redeem,
  - supply,
  - withdraw.
- Avoid:
  - bet,
  - wager,
  - jackpot,
  - gambler slang,
  - sports-book phrasing,
  - “AI says buy.”
- The language should reflect the official Predict docs and make the product feel credible to judges and builders. citeturn10search0turn9search1turn20view2

**Microcopy examples**

- **OracleSVI**
  - “OracleSVI is the live market state for one asset and one expiry. It tracks price, volatility surface parameters, freshness, and settlement.”
- **PredictManager**
  - “Your PredictManager is your reusable onchain account for dUSDC balances and Predict positions.”
- **dUSDC**
  - “dUSDC is the current supported quote asset for DeepBook Predict on Testnet.”
- **PLP**
  - “PLP is the LP share token minted when you supply quote assets to the Predict vault.”
- **Ask bounds**
  - “Ask bounds limit mints when post-spread pricing falls outside configured protocol limits.”
- **Expiry**
  - “Expiry marks the end of live pricing updates for this oracle.”
- **Pending settlement**
  - “This oracle has expired and is awaiting its first post-expiry price update to lock settlement.”
- **Settled**
  - “Settlement is locked. New live price or SVI updates are no longer accepted.”
- These examples are grounded in official terminology for oracle lifecycle, ask bounds, manager, and vault behavior. citeturn9search3turn9search1turn20view0turn20view1turn20view2

**User trust signals**

- Persistent network badge
- Visible source badges:
  - Indexed
  - Onchain
  - Live
- Last updated timestamps
- Wallet address and manager ID copy controls
- Transaction digest after execution
- Explorer deep-link if configured
- Explicit “Testnet” labeling on all sensitive screens
- “Contracts may change before mainnet” note in settings / info drawer
- Public server endpoint visibility in technical info modal for debug contexts because official docs expose a public Predict server for render-ready views. citeturn10search2turn10search0

**Demo polish requirements**

- Preselect a stable demo oracle from current active testnet data at runtime.
- Support a guided demo script in-app.
- Minimize clicks:
  - connect,
  - create or detect manager,
  - deposit if needed,
  - preview,
  - execute,
  - confirm.
- Every demo step must have a visual state badge:
  - not started
  - ready
  - pending
  - complete
- Use a dedicated “Judge Flow” CTA from landing page to open demo mode directly.

**Anti-patterns to avoid**

- Generic topic browsing like politics / sports / culture cards that mimic Polymarket’s homepage structure. PredictPilot is not a general-consumer browse-first venue. citeturn24view3
- Sportsbook-style chips, confetti, and hype language.
- Hidden testnet state.
- Showing positions as NFTs.
- Omitting manager/wallet balance separation.
- Hiding oracle freshness.
- Executing transactions without preview.
- Showing fake analytics disconnected from official server or onchain state.
- Building chart-heavy pages with no execution affordance.
- AI labeling that suggests predictive accuracy beyond visible protocol data.
- Hardcoding hackathon dates from inconsistent public marketing copy.

**TODO VERIFY**

- Exact 2026 participant handbook judging rubric and submission checklist.
- Exact supported `range` enum values for manager PnL and vault performance endpoints beyond the documented examples.
- Whether the current public Predict server provides a fully derived SVI surface or only raw SVI parameter history.
- Final route framework mapping if `TECHNICAL_ARCHITECTURE.md` has already locked the project to Next.js App Router instead of Vite React.
- Final explorer URL templates for testnet digests and object IDs in production UI config.
- Exact list of oracles that are most reliable for judge demo at freeze time.

## Implementation guidance and acceptance

**UI implementation folder structure**

If the project uses Next.js, map these to App Router segments. If it uses Vite React, keep the same semantic grouping with React Router. Final framework choice is **TODO VERIFY** against `TECHNICAL_ARCHITECTURE.md`.

- `src/routes/landing/`
- `src/routes/app/dashboard/`
- `src/routes/app/markets/`
- `src/routes/app/oracles/`
- `src/routes/app/strategy/`
- `src/routes/app/portfolio/`
- `src/routes/app/pnl/`
- `src/routes/app/vault/`
- `src/routes/app/history/`
- `src/routes/demo/`
- `src/components/layout/`
- `src/components/navigation/`
- `src/components/market/`
- `src/components/oracle/`
- `src/components/strategy/`
- `src/components/portfolio/`
- `src/components/vault/`
- `src/components/history/`
- `src/components/state/`
- `src/components/feedback/`
- `src/components/chart/`
- `src/components/ui/`

**Frontend component breakdown**

- Layout
  - `AppShell`
  - `TerminalHeader`
  - `SidebarNav`
  - `ExecutionRail`
- Wallet / identity
  - `ConnectWalletButton`
  - `WalletStatusCard`
  - `NetworkBadge`
  - `ManagerBadge`
- Market intelligence
  - `OracleWatchlist`
  - `OracleSummaryCard`
  - `FreshnessBadge`
  - `LifecycleBadge`
  - `AskBoundsCard`
  - `OracleTimeline`
- Strategy
  - `BinaryTradeForm`
  - `RangeTradeForm`
  - `VaultActionForm`
  - `StrikeSelector`
  - `RangeBandSelector`
  - `RiskPreviewCard`
  - `TxPreviewDrawer`
- Portfolio
  - `ManagerBalanceCard`
  - `OpenPositionsTable`
  - `OpenRangesTable`
  - `PortfolioSummary`
- Vault
  - `VaultSummaryCard`
  - `PLPBalanceCard`
  - `VaultPerformanceChart`
- History
  - `TransactionHistoryTable`
  - `ActivityFeed`
- States
  - `EmptyState`
  - `ErrorState`
  - `LoadingSkeleton`
  - `SuccessPanel`
  - `ReadOnlyFallbackBanner`

**Codex implementation instructions**

- Build the terminal shell before the marketing polish.
- Implement real data plumbing before advanced visuals.
- Ship wallet connection and manager detection first.
- Ship binary preview and execution path before range path.
- Ship vault supply path after binary flow is stable.
- Use official Predict server endpoints for render pages and authoritative onchain reads around wallet execution. citeturn10search0turn10search1turn10search2
- Use Sui dApp Kit hooks and wallet components for connection/status, and use wallet signing for PTB execution. citeturn23view0turn23view2turn11view0
- Keep every complex concept accompanied by visible helper text on first interaction.
- Never block the user with unexplained raw object IDs or protocol errors.

**UI acceptance criteria**

- A judge can understand the product thesis from the landing page in under 20 seconds.
- A connected user can see wallet network, wallet address, and PredictManager status without opening settings.
- The app visibly distinguishes wallet dUSDC from manager dUSDC.
- The app visibly distinguishes indexed data from onchain-confirmed data.
- A user can create a PredictManager from the UI if absent.
- A user can preview a binary mint with oracle freshness, ask bounds, cost, and balance impact before signing.
- A user can sign and execute a real PTB-backed action from the UI using a Sui wallet.
- After execution, the UI shows digest, pending state, and post-transaction refresh.
- Portfolio renders manager-centric positions and does not pretend positions are NFTs.
- Vault view supports supply/withdraw UX and displays PLP-specific context.
- A judge can use Demo Mode to complete the best-path walkthrough without needing hidden admin actions.
- The app never uses sportsbook language or casual gambling motifs.
- The app never hides that it is running against Testnet.

**Final UI/UX checklist**

- [ ] Landing page sells the thesis quickly.
- [ ] Terminal opens into a judge-friendly dashboard.
- [ ] Wallet connection is obvious and reliable.
- [ ] Testnet status is visible at all times.
- [ ] PredictManager setup is discoverable and understandable.
- [ ] dUSDC wallet vs manager balances are separate everywhere.
- [ ] Binary trade flow is polished and stable.
- [ ] Range flow is present or clearly labeled as post-core if not demo-stable.
- [ ] Vault and PLP flow is understandable and visually coherent.
- [ ] Oracle freshness is visible on every tradeable screen.
- [ ] Risk preview appears before every signing step.
- [ ] Transaction preview explains PTB intent in human language.
- [ ] Success flows show digest and refresh progression.
- [ ] Error states are plain-language and recoverable.
- [ ] Tables and charts feel professional, not generic.
- [ ] Mobile layout remains usable, even if desktop is primary.
- [ ] Copy uses protocol terms consistently.
- [ ] Demo mode provides a deterministic best-path story.
- [ ] Read-only fallback, if present, is explicitly labeled.
- [ ] Nothing in the UI feels like a simple betting website.
