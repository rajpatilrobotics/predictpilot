# AGENTS

PredictPilot is a DeepBook Predict intelligence and execution terminal built to maximize the probability of winning the **Sui Overflow 2026** DeepBook specialized track. The public Sui Overflow 2026 site describes the DeepBook track as building **trading or liquidity applications powered by DeepBook’s on-chain orderbook**, and lists a **$70,000 USD** prize pool for that specialized track. DeepBook Predict itself is documented as an **expiry-based prediction market protocol on Sui** where users mint and redeem **binary positions** or **vertical ranges** against oracle-driven prices, while liquidity providers supply quote assets to a shared vault and receive **PLP** shares. citeturn14view0turn36view0

This file is the permanent operating system for the repository. If any local assumption conflicts with the latest official Sui or DeepBook Predict documentation, the official documentation wins. In particular, DeepBook Predict is currently documented as a **Testnet integration surface** tied to the `predict-testnet-4-16` branch, and the docs explicitly warn that package IDs, object layouts, and entry points can change before Mainnet launch. citeturn36view0turn25view3

## Mission and Success Criteria

The mission of this repository is not to produce a generic dashboard. It is to ship a **credible, professional, testnet-working trading terminal** that makes DeepBook Predict easier to understand, analyze, simulate, and execute than the raw protocol surface. The terminal must faithfully implement the documented Predict user flow: load render-ready market state, let the user create or find a `PredictManager`, deposit an accepted quote asset, preview mint or redeem amounts, execute the trade, and then refresh both authoritative onchain state and indexed state. It should also support the documented LP path of supplying quote assets to the vault and receiving `PLP`. citeturn36view0turn25view1

Success means that a judge can open the app, connect a supported Sui wallet on **Testnet**, see live Predict market data, understand oracle state and payoff structure, execute at least one mint or redeem flow through a PTB, and optionally execute an LP supply or withdrawal flow, all with clear state transitions and polished UX. The product must feel like a serious financial tool, not a hackathon mock. This emphasis is aligned with the DeepBook track focus on trading and liquidity applications. citeturn14view0turn36view0

Use the following values as the **current verified defaults as of June 15, 2026**, but treat them as provisional and refresh them against the latest official Contract Information page before coding or deploying:

```env
SUI_NETWORK=testnet
PREDICT_SERVER_URL=https://predict-server.testnet.mystenlabs.com
PREDICT_PACKAGE_ID=0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138
PREDICT_REGISTRY_ID=0x43af14fed5480c20ff77e2263d5f794c35b9fab7e2212903127062f4fe2a6e64
PREDICT_OBJECT_ID=0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a
PREDICT_QUOTE_TYPE=0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC
PREDICT_PLP_TYPE=0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138::plp::PLP
PREDICT_SOURCE_BRANCH=predict-testnet-4-16
```

These values come from the official DeepBook Predict Contract Information page and are explicitly described as temporary public integration targets for Testnet. citeturn25view3

The hackathon schedule itself must be treated carefully. The public **Overflow 2026** landing page still exposes a stale **2025** timeline block, so this repository must treat exact submission cutoffs, judging windows, and handbook-specific requirements as **`TODO VERIFY`** against the participant handbook and the active DeepSurge registration flow rather than trusting the landing page alone. citeturn14view0

## Winning Strategy

PredictPilot wins only if it is unmistakably a **DeepBook-native** product. That means the repo should prioritize the protocol surfaces that judges can directly map to official DeepBook Predict concepts: `Predict`, `PredictManager`, `OracleSVI`, `Vault`, `PLP`, binary positions, vertical ranges, and PTB-based execution. Avoid diluting the project with unrelated features that do not strengthen the “best DeepBook trading or liquidity application” narrative. citeturn36view1turn14view0

An inference from prior Sui Overflow winners is that judges consistently reward technically serious financial products, data tooling, unified account models, and polished composable infrastructure. In 2025, winning DeFi projects included a programmable yield abstraction layer and a composable perpetuals exchange with a unified account model, while the Infra and Tooling winners included SQL-style blockchain tooling, provenance tooling, and sub-second data streaming. In 2024, ecosystem prize winners included **Flashloan Indexer**, **NAVI arbitrage Bot**, **KriyaDexBot**, and **CLMM and DeepBook Market Making Vaulta**. That pattern suggests that a strong DeepBook entry should combine **real protocol usage**, **strong analytics/data presentation**, and **clear execution UX**. This is an inference, but it is grounded in official winner recaps. citeturn22view1turn22view3turn21view1

The non-negotiable product priorities for this repo are simple. First, the terminal must demonstrate at least one real end-to-end Predict trade flow on Testnet. Second, it must make the protocol more legible than the raw docs by surfacing oracle lifecycle, position structure, expected payoff, and vault exposure context. Third, it must feel trustworthy: exact direction, strike, expiry, quantity, quote asset, previewed cost or payout, and post-trade results must all be obvious before and after signing. Fourth, the demo must tell a story in under two minutes. These priorities follow directly from the documented Predict user flow and the track’s focus on trading and liquidity. citeturn36view0turn14view0

Because community perception mattered in 2025, presentation quality is not optional. The 2025 Sui Overflow recap states that community voting contributed points to project rankings. Until the 2026 handbook is verified, assume that public-facing clarity, naming, README quality, screenshots, and demo video quality may still matter materially. Mark this as **`TODO VERIFY`** for 2026, but optimize as though it matters. citeturn22view2

## Product and Architecture Mandates

PredictPilot is a **terminal**, not a landing page with a wallet button. The core product surfaces should be:

- a market board for active Predict oracles and strikes,
- an oracle detail pane with lifecycle state and price history context,
- a payoff and trade preview surface for binary positions and vertical ranges,
- a portfolio view sourced from the manager and indexed state,
- a vault and LP view for `PLP`, vault value, and performance,
- a transaction composer and execution drawer with simulation and final confirmation.

These surfaces are justified by the official Predict data model and server endpoints for markets, oracle state, vault summaries, manager summaries, positions, PnL, and history. citeturn26view0turn36view1

The app’s read architecture must follow the official Predict integration model. Use the public Predict server for page rendering, lists, historical data, vault summaries, portfolio summaries, and PnL. Use Sui checkpoint or event streaming only where low-latency oracle freshness materially improves UX. Use direct onchain reads immediately before and after wallet flows that require confirmation-critical state. Do **not** architect the product around raw chain scans. citeturn36view0turn36view1turn26view0

The repo should be a TypeScript-first monorepo organized approximately like this:

```text
apps/
  web/                  # Next.js trading terminal
packages/
  domain/               # shared types, zod schemas, formatters, constants
  predict/              # Predict server client, domain mappers, chart models
  sui/                  # PTB builders, wallet adapters, chain read helpers
  ui/                   # reusable terminal-grade components
services/
  event-worker/         # optional live oracle/event ingestion worker
docs/                   # architecture, prompts, product docs
contracts/              # optional Move package only if truly needed
```

Use `pnpm`, strict TypeScript, and a single source of truth for environment-based deployment config. Keep any optional custom Move code out of the critical path unless it clearly improves the demo and can be tested thoroughly.

For chain access, prefer **gRPC or GraphQL**, not new JSON-RPC integrations. The official Sui GraphQL docs state that **JSON-RPC is deprecated** and that applications should migrate to **GraphQL or gRPC by July 2026**, with GraphQL RPC and the general-purpose indexer already generally available. citeturn34view1

For DeepBook-related extensions beyond Predict, it is acceptable to add optional context from DeepBookV3 and DeepBook Margin if it strengthens the analytics story. DeepBook’s public site positions **Spot, Margin, and Predict** as “three primitives, one financial stack,” and official SDK docs exist for DeepBookV3 and DeepBook Margin. Use this only to enrich Predict understanding, never to distract from the core DeepBook Predict workflow. citeturn23search0turn30view0turn30view1

## Sui and DeepBook Predict Rules

DeepBook Predict rules are strict. Each user should create **one** `PredictManager` and reuse it. Binary positions and vertical ranges are **not standalone onchain objects**; they are quantities stored inside the manager and keyed by `MarketKey` and `RangeKey`. Do not build a product model that assumes standalone NFT-like position objects. Read positions from the manager object or from indexed endpoints. citeturn25view0turn36view1turn38view0

The supported public Predict flow is grounded in the officially documented entry points: `create_manager()`, `get_trade_amounts()`, `mint()`, `redeem()`, `redeem_permissionless()`, `get_range_trade_amounts()`, `mint_range()`, `redeem_range()`, `supply()`, `withdraw()`, and `compact_settled_oracle()`. Use only verified function names and verified type arguments. If any signature is uncertain, mark it **`TODO VERIFY`** and confirm it against the official source pointers in the `predict-testnet-4-16` branch before writing code. citeturn25view1turn26view0

Do not treat admin and operator functions as user features. The `Registry` docs explicitly describe registry calls as operator and governance surfaces, not the main app integration surface. Likewise, oracle lifecycle updates such as `activate()`, `update_prices()`, and `update_svi()` are operator actions; the terminal should generally **read** oracle state, not try to administer it. citeturn28view1turn25view2

Use protocol concepts faithfully in the UI. `OracleSVI` has lifecycle states of **inactive**, **active**, **pending settlement**, and **settled**. Binary positions are keyed by oracle, expiry, strike, and direction. Vertical ranges are keyed by oracle, expiry, lower strike, and higher strike, and pay when settlement lands in the band `(lower, higher]`. The vault takes the opposite side of every trade, tracks liability and maximum payout, and mints or burns `PLP` during LP flows. These are not marketing labels; they are core product semantics. citeturn36view1turn25view2turn28view0

Every user transaction must be built as a **PTB**. On Sui, PTBs are the standard way to chain multiple calls together atomically, and Sui PTBs can include up to **1,024** calls or actions. PredictPilot should exploit that strength by composing coherent flows such as “create manager if missing, deposit quote asset, preview, and execute” where the protocol allows it. PTB construction is a core product advantage, not an implementation detail. citeturn37view0turn31view0

Every mutation must support simulation before execution. The official TypeScript SDK docs recommend `simulateTransaction` for estimating gas, checking return values, and validating transactions before execution. In this repo, no high-risk trade or LP action should be sent without a simulation or equivalent preview layer unless there is a documented reason that the wallet flow cannot support it. citeturn31view2

Wallet integration must use the **Sui dApp Kit** and **Wallet Standard** first. Official Sui docs say the dApp Kit is the official SDK for Sui apps and that Wallet Standard wallets are discovered automatically without wallet-specific code. Build around `DAppKitProvider`, `ConnectButton`, account hooks, and the modern `useSignAndExecuteTransaction` flow. Do not build wallet-specific custom integrations before the standard path works. citeturn33view0turn33view1

If reducing onboarding friction becomes important, sponsored transactions are an acceptable optional feature, because official Sui docs describe them as a way to let users execute transactions without owning SUI for gas. That said, sponsorship is a **phase-two optimization**. The repo must first succeed with a standard self-custodial testnet wallet flow. citeturn31view1

If custom Move code is ever added, follow Sui Move best practices. Use capability-based access control where appropriate, commit `Move.lock` and `Published.toml`, structure modules predictably, prefer pure core functions over transfer-heavy impure functions, and expose separate instantiate/share functions for shared objects. citeturn31view4turn32view2turn37view0

## Workflow and Anti-Hallucination

Before writing code in any new area, read the current official source of truth in this order: the latest DeepBook Predict Contract Information page, the linked source pointers in the official docs, the latest relevant Sui docs for transactions, wallets, access patterns, and data access, and then only after that any supplemental DeepBook or Sui blog content. This order is mandatory because the Predict docs explicitly warn that the current integration surface is provisional and testnet-only. citeturn25view3turn36view0

Never invent package IDs, object IDs, module paths, event types, coin types, REST endpoints, or Move function names. If a technical detail is not verified from an official source, annotate it as **`TODO VERIFY`** and stop pretending it is known. This is especially important for DeepBook Predict because the docs explicitly caution against reusing older Predict package IDs and explain that current identifiers can change before Mainnet. citeturn36view0turn25view3

If the docs page shows incomplete inline snippets such as “file not found in manifest,” follow the official GitHub source pointers exposed from the Contract Information page instead of guessing. The docs themselves provide source pointers for `predict.move`, `predict_manager.move`, `registry.move`, `oracle.move`, and `vault.move`. citeturn26view0

Implementation work must follow this loop: research the exact target surface, write a concise technical plan, build the smallest working slice, simulate or dry-run, test on Testnet, capture proof with screenshots or logs, then update docs. Do not merge speculative code simply because it compiles.

When building data features, explicitly separate **authoritative** state from **indexed** state. Authoritative state means direct onchain reads or wallet transaction effects. Indexed state means Predict server responses, event streams, or derived analytics. The UI must never present indexed data as final settlement-critical truth during a signing flow. This rule follows the official Predict integration model. citeturn36view0turn26view0

For event ingestion, prefer package-filtered streams and exact event types. The official Predict docs recommend watching `oracle::OraclePricesUpdated`, `oracle::OracleSVIUpdated`, `oracle::OracleSettled`, and `oracle::OracleActivated` for low-latency freshness, while the broader Sui events docs explain that production event processing should rely on checkpoint streaming or polling plus storage and exact event filters. citeturn26view0turn34view0

## Quality Gates

Code quality is mandatory. TypeScript must be strict. Runtime input validation should use explicit schemas. Formatting, linting, and tests must run in CI. Domain logic for payoff math, quote formatting, direction handling, oracle lifecycle mapping, and position serialization must live outside React components. UI components should be stateless where possible and never contain hidden chain logic.

Testing must cover four layers. First, unit tests for formatting, payoff math, range validation, and data mappers. Second, integration tests for Predict server clients and transaction builders. Third, wallet-connected smoke tests on Testnet that verify at least the happy path for manager discovery or creation, deposit, preview, mint, and refresh. Fourth, event or polling validation for live oracle updates where that feature is enabled. The point is not theoretical coverage; it is demo reliability.

Every transaction-oriented review must verify the following before approval:

- the network is visibly pinned to Testnet,
- all package IDs and object IDs come from config rather than hardcoded UI text,
- the signer is the wallet user, not a backend-held key,
- the app surfaces exact trade parameters before signing,
- the transaction has a simulation, preview, or equivalent validation path,
- post-trade refresh logic updates both chain-confirmed and indexed UI layers,
- failure states are understandable and actionable.

Security rules are simple and absolute. Never request or handle seed phrases. Never proxy user signing through backend private keys. Never hide transfers or surprise balance movements inside larger PTBs. If the app introduces sponsored transactions, the sponsored action scope must be validated server-side and visibly explained client-side. These wallet and sponsorship boundaries are consistent with official Sui wallet and sponsored-transaction documentation. citeturn33view0turn31view1

## Demo and Submission Readiness

The primary demo should follow the official Predict user journey closely because that makes the product easy to judge against the actual protocol. The ideal path is: land on the terminal, show active Predict markets and oracle state from the public server, connect a Sui wallet on Testnet, create or find the user’s `PredictManager`, deposit `DUSDC`, preview a binary or range trade, execute a PTB-backed mint or redeem, then refresh the portfolio and show the updated manager summary or PnL. A second short path should show LP supply into the vault and receipt of `PLP`, or a vault analytics panel built from the documented vault endpoints. citeturn36view0turn26view0turn25view1

Every demo build should visibly teach something about DeepBook Predict. At minimum, the UI should explain the meaning of `PredictManager`, the oracle lifecycle, how binary directions work, how vertical ranges differ from binaries, how the vault is the counterparty, and why `PLP` represents LP shares. This is not extra copywriting; it is the intelligence layer that differentiates PredictPilot from a bare transaction form. citeturn36view1turn28view0

Submission assets must be generated as if community and judge audiences both matter. That means the README must clearly state the track fit, architecture, protocol surfaces used, exact demo steps, technical challenges solved, and how the product maps to official DeepBook Predict primitives. The video must show a real working testnet flow, not only a Figma prototype. Because the current public 2026 landing page contains stale schedule content, the exact submission checklist, final cutoff, and judging rubric remain **`TODO VERIFY`** against the handbook and registration system before final submission. citeturn14view0turn22view2

The repo owner must also verify the following live items before final submission:

- **`TODO VERIFY`** exact 2026 submission deadline,
- **`TODO VERIFY`** exact 2026 judging criteria and track-specific requirements,
- **`TODO VERIFY`** whether community voting affects final ranking in 2026,
- **`TODO VERIFY`** whether DeepBook track sponsors require any special submission tags, links, or deployment notes.

## Definition of Done

A task is done only when the implementation is complete, tested, documented, and demo-safe.

A feature is done only when it is wired to the real data source it claims to use, handles empty and failure states, has clear user feedback, and can be shown live without hand-waving.

The product is done for hackathon purposes only when all of the following are true:

- the app runs in a stable deployed environment,
- wallet connection works through the standard Sui wallet flow,
- the app clearly indicates Testnet,
- the app reads official Predict data surfaces correctly,
- at least one real Predict trade flow works end-to-end,
- at least one meaningful analytics or intelligence layer clearly improves understanding of the protocol,
- the README, architecture notes, and demo script match reality,
- all unstable constants are verified one final time against official docs,
- nothing essential depends on guesswork.

When in doubt, choose the option that makes PredictPilot more obviously **DeepBook-native**, more obviously **real**, and more obviously **demoable**.