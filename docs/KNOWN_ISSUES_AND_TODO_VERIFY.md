# KNOWN_ISSUES_AND_TODO_VERIFY

## Purpose and usage

DeepBook Predict is currently documented as a **Sui Testnet integration surface**, and the official contract documentation explicitly warns that package IDs, object layouts, and entry points are **provisional before Mainnet**. This file exists to stop PredictPilot from building against stale, guessed, or hallucinated values while still giving Codex a practical go/no-go checklist for implementation. citeturn6view0turn0search7

Codex should use this document as a **hard verification gate**, not as passive reference material. If a task depends on exact onchain function signatures, object IDs, quote asset types, or server schemas that are still marked `TODO VERIFY`, Codex should either pause and verify them from official sources or implement the relevant adapter behind an explicit placeholder boundary that cannot be mistaken for production-ready behavior. This is especially important because the official Predict docs expose many function names, but several embedded source panes currently fail with `File not found in manifest`, which means the function names are visible while exact signatures and argument ordering are not fully surfaced in the docs UI. citeturn22view0turn23view0turn14view1

This strictness is justified by the competitive bar. The official Sui winner announcements state that Sui Overflow 2024 had **352 submissions** and Sui Overflow 2025 had **599 submissions**, meaning judges have historically seen many polished projects and weak proof will not be enough. citeturn10search2turn8search0

## Verification model

**Verification philosophy.** PredictPilot must prefer official, current, directly cited sources over memory, blog summaries, or inferred code paths. The strongest sources currently available are the Sui docs pages for DeepBook Predict, the Mysten SDK docs, the official Sui hackathon pages, and the official MystenLabs `deepbookv3` repository. The docs themselves state that the current Predict integration targets come from the `predict-testnet-4-16` branch of the DeepBookV3 repository. citeturn6view0turn5search0turn25view0

**Source trust hierarchy.**

1. **Official Sui docs and Mysten SDK docs** for DeepBook Predict, Sui PTBs, Sui network/RPC behavior, and dApp Kit usage. citeturn6view0turn14view3turn24view1turn24view3  
2. **Official MystenLabs GitHub repository** for DeepBookV3 source-of-truth package structure and branch references. citeturn6view0turn25view0  
3. **Official hackathon surfaces** such as `overflow.sui.io`, the DeepSurge hackathon page, and official Sui winner announcements. citeturn0search0turn1search2turn8search0turn10search2  
4. **Official Sui blog / DeepBook site** for context and positioning, but not for exact contract inputs unless cross-checked against docs or repo. citeturn0search14turn17search0  
5. **Everything else** is non-authoritative and should not settle technical disputes for PredictPilot.

**Severity system.**

- `CRITICAL`: wrong value or missing proof could cause fake integration, invalid demo claims, or failed submission.
- `HIGH`: likely to break real transactions, portfolio correctness, or judge confidence.
- `MEDIUM`: material implementation or UX risk, but work can proceed with care.
- `LOW`: quality or completeness gap that does not block the MVP path.

**Status system.**

- `OPEN`: unresolved and still needs action.
- `IN_PROGRESS`: partially validated, still pending final confirmation.
- `VERIFIED`: confirmed from an official source.
- `BLOCKED`: cannot be resolved from currently accessible evidence.
- `ACCEPTED_RISK`: known gap accepted for hackathon scope.
- `NOT_REQUIRED_FOR_MVP`: explicitly deferred.
- `REMOVED_FROM_SCOPE`: intentionally excluded.

**Anti-hallucination rules.**

- Codex must **not guess** package IDs, object IDs, quote coin types, or imported module targets.
- Codex must **not present mock execution as real Predict execution**.
- Codex may use mocks only in tests, storybook-like UI fallback, or demo backup modes that are clearly labeled as fallback.
- All integration IDs must be kept in config, because the official docs explicitly warn that current Testnet values are provisional. citeturn6view0turn5search0

## Global TODO VERIFY summary

**Verified current deployment targets.** The official DeepBook Predict contract page currently publishes the following Testnet integration values:

- Network: `Testnet`
- Public server: `https://predict-server.testnet.mystenlabs.com`
- Predict package: `0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138`
- Predict registry: `0x43af14fed5480c20ff77e2263d5f794c35b9fab7e2212903127062f4fe2a6e64`
- Predict object: `0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a`
- Current quote asset type: `0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC`
- DUSDC currency ID: `0xf3000dff421833d4bb8ed58fac146d691a3aaba2785aa1989af65a7089ca3e9c`
- PLP coin type: `0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138::plp::PLP` citeturn6view0

**Verified public server endpoints.** The Predict docs currently publish endpoint families for protocol state, oracle state, vault summaries, LP supply and withdrawal history, manager summaries, PnL, oracle price/SVI history, position/range mint and redeem history, and per-oracle trade history. The docs also publish official live event names for lower-latency oracle updates: `oracle::OraclePricesUpdated`, `oracle::OracleSVIUpdated`, `oracle::OracleSettled`, and `oracle::OracleActivated`. citeturn6view0

**Verified onchain function names exposed in docs.** The Predict docs currently expose these public function names: `create_manager`, `get_trade_amounts`, `mint`, `redeem`, `redeem_permissionless`, `get_range_trade_amounts`, `mint_range`, `redeem_range`, `supply`, `withdraw`, and `compact_settled_oracle`. The Oracle page exposes `activate`, `update_prices`, and `update_svi`. The Registry page exposes `create_predict` and `create_oracle`. Market key helpers exposed in docs include `up`, `down`, `new`, and `RangeKey::new`. citeturn22view0turn14view1turn4view4turn14view2

**Highest-priority `TODO VERIFY` items.**

- The public hackathon surfaces for **Sui Overflow 2026** are not cleanly self-consistent. The official `overflow.sui.io` page is branded as 2026, but one visible timeline section still references “Road to Sui Overflow 2025,” so final dates and rules must be re-confirmed in the participant handbook and submission platform before submission. citeturn1search1turn1search2
- The official docs reveal many Predict function names, but several page sections show `File not found in manifest`, so the exact **Move signatures, argument order, type arguments, and return decoding** still need repository or generated-binding verification. citeturn22view0turn23view0turn14view1
- The official docs confirm that builders can request **DUSDC and other DeepBook Predict Testnet tokens** through a token request form, but the exact operational request path was not fully recoverable in this research pass and must be manually verified before demo day. citeturn17search1turn5search0
- The Sui SDK surface is in transition. Mysten’s current SDK docs recommend the new dApp Kit and `SuiGrpcClient`, and state that JSON-RPC is being deprecated in favor of gRPC and GraphQL clients. PredictPilot should therefore avoid baking deep assumptions into legacy client paths. citeturn24view1turn24view2turn15search1

**Hackathon rules to verify.**

- Final build deadline.
- Final demo-day schedule and timezone.
- Whether live URL is required or optional.
- Whether a private repo is allowed.
- Whether non-team-member code or AI-generated code disclosures are required.
- Exact DeepBook-track-specific judging expectations.
- Required submission assets and file formats.
- Whether a separate community-vote flow exists for 2026.  
These remain `TODO VERIFY` because the public 2026 page is partially inconsistent and the full handbook text was not fully accessible from public HTML in this research pass. citeturn1search1turn1search2

## Detailed issue register

**Issue HK-001 — Official Sui Overflow 2026 dates and rules need reconciliation**

ID: `HK-001`  
Category: `HACKATHON`  
Title: Public 2026 hackathon surfaces are partially inconsistent  
Severity: `CRITICAL`  
Status: `OPEN`  
What is uncertain: The official hackathon branding is clearly “Sui Overflow 2026,” but the visible overflow site snippet still contains timeline copy that references “Road to Sui Overflow 2025,” alongside a submission window and demo-day dates.  
Why it matters: PredictPilot must not cite wrong deadlines, wrong year labels, or wrong judging logistics in the repo, README, demo, or submission form.  
Current best-known answer: 2026 is the correct event framing, but the authoritative date/rule source still requires handbook and submission-platform confirmation. citeturn1search1turn1search2  
Source or evidence: Official overflow page snippet and official DeepSurge listing. citeturn1search1turn1search2  
Required verification action: Open the participant handbook and submission platform directly, capture exact deadlines and required assets, and update `SUBMISSION_CHECKLIST.md`.  
Owner: `Raj`  
Blocks Codex build: `no`  
Blocks demo: `no`  
Blocks submission: `yes`  
Resolution notes: `TODO VERIFY` exact handbook dates, timezone, and form requirements.

**Issue SUB-001 — Official 2026 submission form fields are not yet captured**

ID: `SUB-001`  
Category: `SUBMISSION`  
Title: Submission payload requirements are not fully extracted  
Severity: `HIGH`  
Status: `OPEN`  
What is uncertain: The final form fields for project description length, required links, repo visibility, and media assets were not fully accessible in this pass.  
Why it matters: Submission friction at the end can cause avoidable misses or last-minute rushed edits.  
Current best-known answer: The official 2026 event exists on DeepSurge, and the official overflow site points judges/builders to a participant handbook for more detail, but final form requirements still need direct capture. citeturn0search3turn1search1  
Source or evidence: DeepSurge listing snippet and overflow site copy. citeturn0search3turn1search1  
Required verification action: Screen-record or screenshot every submission form step once available; mirror the required fields into `SUBMISSION_CHECKLIST.md`.  
Owner: `Raj`  
Blocks Codex build: `no`  
Blocks demo: `no`  
Blocks submission: `yes`  
Resolution notes: Keep placeholder copy blocks in repo docs until final form lengths are confirmed.

**Issue DBP-001 — Predict deployment IDs are verified but explicitly provisional**

ID: `DBP-001`  
Category: `DEEPBOOK_PREDICT`  
Title: Current Testnet package and object IDs must stay config-driven  
Severity: `CRITICAL`  
Status: `VERIFIED`  
What is uncertain: Nothing about the current published values themselves is uncertain, but their durability is uncertain because the docs mark them as provisional Testnet targets.  
Why it matters: Hardcoding these values into UI or transaction builders will create brittle behavior after any redeploy or docs update.  
Current best-known answer: Use the currently published package, registry, Predict object, DUSDC type, DUSDC currency ID, and PLP type exactly as listed today, but store them only in config and re-validate before demo/submission. citeturn6view0turn0search7  
Source or evidence: Official DeepBook Predict contract information page. citeturn6view0  
Required verification action: Re-check the official docs within 24 hours of demo recording and again before final submission.  
Owner: `Raj + Codex`  
Blocks Codex build: `no`  
Blocks demo: `yes` if stale  
Blocks submission: `yes` if stale  
Resolution notes: Never scatter these values across components; centralize them in config.

**Issue DBP-002 — Exact Move call signatures still require repository-level verification**

ID: `DBP-002`  
Category: `DEEPBOOK_PREDICT`  
Title: Docs expose function names but not always full callable source details  
Severity: `CRITICAL`  
Status: `OPEN`  
What is uncertain: Exact argument order, object/reference shapes, type parameters, and return-value decoding for several Predict and PredictManager calls.  
Why it matters: PredictPilot cannot safely build PTBs from function names alone. Incorrect signatures will cause failed transactions or misleading previews.  
Current best-known answer: Verified function names include `create_manager`, `mint`, `redeem`, `mint_range`, `redeem_range`, `supply`, and `withdraw`, but the docs UI currently shows `File not found in manifest` for several embedded source panes, so final signature verification must come from the `predict-testnet-4-16` repo branch or generated bindings. citeturn22view0turn23view0turn14view1turn6view0  
Source or evidence: Predict, PredictManager, and Oracle contract pages plus contract-info source pointers. citeturn22view0turn23view0turn14view1turn6view0  
Required verification action: Verify each callable target against repository source or official generated bindings before any transaction builder is marked done.  
Owner: `Codex`  
Blocks Codex build: `yes`  
Blocks demo: `yes`  
Blocks submission: `yes`  
Resolution notes: Keep `TODO VERIFY` inline beside every unverified target string until repo confirmation is complete.

**Issue API-001 — Predict server base URL and endpoint families are verified, but response schemas are not yet live-captured**

ID: `API-001`  
Category: `API`  
Title: Predict server schemas need a recorded contract test  
Severity: `HIGH`  
Status: `IN_PROGRESS`  
What is uncertain: Field names, pagination structure, freshness semantics, and whether the server includes transaction digests or IDs in all history responses.  
Why it matters: PredictPilot’s market views, portfolio summaries, PnL, and history UI depend on these payloads.  
Current best-known answer: The official docs verify the base URL and endpoint families for protocol state, oracle state, vault summaries, manager summaries, PnL, and history; they do not fully document every response field in the surfaced HTML. citeturn6view0  
Source or evidence: Official contract info endpoint list. citeturn6view0  
Required verification action: Capture real JSON samples for every endpoint the app uses, create Zod schemas from those samples, and fail fast on nonconforming payloads.  
Owner: `Codex`  
Blocks Codex build: `no`  
Blocks demo: `yes` if UI depends on uncaptured fields  
Blocks submission: `no`  
Resolution notes: Do not infer hidden fields such as digest, owner, or timestamp precision without live payload confirmation.

**Issue DUSDC-001 — DUSDC metadata is verified, but the operational funding workflow is still `TODO VERIFY`**

ID: `DUSDC-001`  
Category: `DUSDC`  
Title: DUSDC request and replenishment path is not fully operationalized  
Severity: `HIGH`  
Status: `OPEN`  
What is uncertain: Exact request form URL, expected turnaround, faucet-like behavior if any, and whether repeated requests are rate-limited or manually approved.  
Why it matters: PredictPilot cannot execute real mint, redeem, supply, or withdraw flows without DUSDC in the demo wallet.  
Current best-known answer: The official docs verify the DUSDC type and currency ID, and they explicitly state that builders can request DeepBook Predict Testnet tokens, including DUSDC, through the DeepBook Predict Testnet token request form. The precise operational process still needs manual confirmation. citeturn6view0turn17search1  
Source or evidence: Contract info and DeepBook Predict overview docs. citeturn6view0turn17search1  
Required verification action: Submit or locate the official token request workflow and test at least one successful DUSDC funding cycle before demo week.  
Owner: `Raj`  
Blocks Codex build: `no`  
Blocks demo: `yes`  
Blocks submission: `no`  
Resolution notes: Keep a funded backup wallet once confirmed.

**Issue PM-001 — PredictManager modeling is verified conceptually, but the funding entry points still need exact-call verification**

ID: `PM-001`  
Category: `PREDICT_MANAGER`  
Title: PredictManager is the core per-user account object; generic position-object assumptions are wrong  
Severity: `CRITICAL`  
Status: `IN_PROGRESS`  
What is uncertain: Exact deposit and withdraw entry function names and argument shapes for manager quote-asset funding.  
Why it matters: PredictPilot’s data model, wallet flow, and portfolio UI must assume that positions and ranges live **inside** the `PredictManager`, not as separate user-owned position objects. Mis-modeling this will break portfolio logic and onchain refresh assumptions.  
Current best-known answer: The official docs verify that each user should create one manager and reuse it, that the manager wraps a DeepBook `BalanceManager`, and that binary positions and vertical ranges are quantities stored inside the manager. The docs also verify `create_manager()` on the `Predict` object, but they do not surface the exact function names for quote-asset deposit and withdrawal in the HTML excerpts available here. citeturn23view0turn14view0  
Source or evidence: PredictManager and Predict contract pages. citeturn23view0turn14view0  
Required verification action: Confirm the exact manager funding entry points from repo/bindings and document read-refresh logic after every transaction.  
Owner: `Codex`  
Blocks Codex build: `yes`  
Blocks demo: `yes`  
Blocks submission: `yes` if portfolio flow is claimed  
Resolution notes: UI must show manager-centric state, not generic wallet object lists.

**Issue ORACLE-001 — OracleSVI lifecycle is verified, but usable oracle IDs and freshness thresholds remain open**

ID: `ORACLE-001`  
Category: `ORACLE_SVI`  
Title: Oracle lifecycle is known; live market selection and freshness policy still need implementation proof  
Severity: `HIGH`  
Status: `OPEN`  
What is uncertain: Which oracle IDs are currently suitable for demo, what thresholds PredictPilot should treat as “fresh” vs “stale,” and how quickly the public server index lags real-time updates.  
Why it matters: Mints require a live oracle, and judge trust will fall quickly if the app cannot explain or visualize stale data.  
Current best-known answer: `OracleSVI` stores spot, forward, SVI parameters, timestamps, and settlement state; it moves through inactive, active, pending settlement, and settled states. Mints require a live oracle, while redeems can use live or settled quoteable state. For lower-latency oracle reads, the official docs advise using Sui checkpoint or event streaming and list the relevant oracle event types. citeturn14view1turn4view5turn6view0  
Source or evidence: Oracle page, design page, and event list in contract info. citeturn14view1turn4view5turn6view0  
Required verification action: Identify at least one stable demo oracle, define a freshness timeout policy, and test fallback UI for stale-oracle conditions.  
Owner: `Raj + Codex`  
Blocks Codex build: `no`  
Blocks demo: `yes`  
Blocks submission: `no`  
Resolution notes: Freshness label must be explicit in the UI.

**Issue MARKET-001 — `MarketKey` and `RangeKey` semantics are documented, but strike encoding and PTB input serialization still need confirmation**

ID: `MARKET-001`  
Category: `DEEPBOOK_PREDICT`  
Title: MarketKey and RangeKey input encoding is not fully verified  
Severity: `HIGH`  
Status: `OPEN`  
What is uncertain: Exact strike units, integer scaling, BCS serialization, and whether frontend builders should pass primitives or helper-constructed structs/bcs blobs.  
Why it matters: Wrong strike encoding will silently target the wrong market or cause transaction failures.  
Current best-known answer: `MarketKey` is keyed by oracle ID, expiry, strike, and direction; `RangeKey` is keyed by oracle ID, expiry, lower strike, and higher strike; helper constructors include `up`, `down`, and `new`, and range creation aborts if `lower_strike` is not less than `higher_strike`. The docs do not, in the accessible HTML here, fully expose the final PTB serialization shape. citeturn14view2  
Source or evidence: Official Market Keys contract page. citeturn14view2  
Required verification action: Confirm strike encoding and serialization from repository source or binding code, then lock it into a tested adapter module.  
Owner: `Codex`  
Blocks Codex build: `yes`  
Blocks demo: `yes` for range flows  
Blocks submission: `no` if range remains out of MVP  
Resolution notes: Keep range UI behind a feature flag until verified.

**Issue VAULT-001 — Vault and PLP flows are documented, but liquidity execution still needs end-to-end proof**

ID: `VAULT-001`  
Category: `VAULT_PLP`  
Title: Supply and withdraw logic is known conceptually but not yet live-validated in PredictPilot  
Severity: `HIGH`  
Status: `IN_PROGRESS`  
What is uncertain: The exact PTB call wiring, available-withdrawal behavior under current max payout, and the best UX for communicating why a withdrawal may be limited.  
Why it matters: Vault/PLP flows are one of PredictPilot’s differentiators; if they are unstable, judges may view the app as an incomplete analytics front end.  
Current best-known answer: The official docs verify that LPs interact through `predict::supply` and `predict::withdraw`, receive `PLP` shares, and can withdraw only when the requested amount is available after max-payout coverage. The docs also verify that `PLP` is the LP share coin type published in the current deployment table. citeturn4view3turn22view0turn6view0  
Source or evidence: Vault page, Predict page, and contract deployment page. citeturn4view3turn22view0turn6view0  
Required verification action: Execute at least one live `supply` and one live `withdraw` against the current Testnet deployment, then capture digest and portfolio refresh evidence.  
Owner: `Raj + Codex`  
Blocks Codex build: `no`  
Blocks demo: `yes` if vault flow is claimed  
Blocks submission: `no` if vault flow is clearly labeled non-MVP  
Resolution notes: Do not market PLP flow as complete without live digest proof.

**Issue PTB-001 — PredictPilot must choose the modern Sui client path deliberately**

ID: `PTB-001`  
Category: `PTB`  
Title: Use modern PTB + simulation APIs; avoid deep dependence on deprecated JSON-RPC paths  
Severity: `HIGH`  
Status: `VERIFIED`  
What is uncertain: The exact final transport choice for PredictPilot’s implementation.  
Why it matters: The current Mysten docs recommend the new dApp Kit and `SuiGrpcClient`, while the SDK migration guide states that JSON-RPC is being deprecated in favor of `SuiGrpcClient` and `SuiGraphQLClient`, and that `devInspectTransactionBlock` maps to `simulateTransaction` with `checksEnabled: false`. Choosing the wrong client surface now creates migration debt immediately. citeturn24view1turn24view2turn24view3turn15search1  
Current best-known answer: Build around `Transaction` PTBs plus current dApp Kit + gRPC-friendly client patterns, and treat any JSON-RPC usage as compatibility-only. citeturn14view3turn24view1turn15search1  
Source or evidence: PTB docs, SDK migration guide, and dApp Kit setup docs. citeturn14view3turn24view1turn24view2turn15search1  
Required verification action: Standardize one client abstraction in `src/lib/sui/` and test both preview simulation and live execution through that abstraction.  
Owner: `Codex`  
Blocks Codex build: `yes`  
Blocks demo: `no`  
Blocks submission: `no`  
Resolution notes: If any library forces JSON-RPC, isolate it behind a narrow adapter.

**Issue SUI-001 — Public Testnet infrastructure introduces reliability and rate-limit risk**

ID: `SUI-001`  
Category: `SUI`  
Title: Testnet wipes, epoch timing, and public-RPC rate limits must be treated as real product constraints  
Severity: `HIGH`  
Status: `VERIFIED`  
What is uncertain: Which specific outage or delay scenarios will occur during demo week.  
Why it matters: PredictPilot uses live Testnet calls for proof, so infrastructure instability affects both technical correctness and presentation reliability.  
Current best-known answer: The official Sui docs state that Testnet data can be wiped occasionally, should not be relied upon for permanent storage, and uses `https://fullnode.testnet.sui.io:443` as its RPC URL. The RPC best-practices page also states that public endpoints are rate-limited to **100 requests per 30 seconds** and should not be relied on as production infrastructure. Testnet epochs are roughly 24 hours, and epoch changes may briefly delay transactions. citeturn20search1turn20search5turn21search12  
Source or evidence: Networks, RPC best practices, and transaction lifecycle docs. citeturn20search1turn20search5turn21search12  
Required verification action: Add caching, request deduplication, and graceful retry logic; pre-warm critical screens before the demo.  
Owner: `Codex`  
Blocks Codex build: `no`  
Blocks demo: `yes`  
Blocks submission: `no`  
Resolution notes: Provide a recorded backup flow if RPC timing becomes unreliable.

**Issue WALLET-001 — PredictPilot wallet integration path is known, but actual extension/mobile compatibility is not yet proven**

ID: `WALLET-001`  
Category: `WALLET`  
Title: dApp Kit and Wallet Standard are verified; wallet matrix still needs end-to-end test coverage  
Severity: `HIGH`  
Status: `IN_PROGRESS`  
What is uncertain: Which wallets will behave most reliably for Testnet Predict PTBs on demo hardware, and whether mobile deep links are needed.  
Why it matters: A wallet-connection failure is a demo failure.  
Current best-known answer: Mysten’s current docs recommend the new dApp Kit using `@mysten/dapp-kit-react` plus `@mysten/sui`, and Sui browser-extension wallets use the Wallet Standard. Slush wallet has a documented integration path and detection support. citeturn24view0turn24view1turn24view2turn24view4turn11search2turn11search3  
Source or evidence: dApp Kit docs, Wallet Standard docs, and Slush Wallet integration docs. citeturn24view0turn24view1turn24view4turn11search2turn11search3  
Required verification action: Test at least one primary wallet and one fallback wallet on the actual MacBook/browser setup used for the demo.  
Owner: `Raj + Codex`  
Blocks Codex build: `no`  
Blocks demo: `yes`  
Blocks submission: `no`  
Resolution notes: Use the most stable tested wallet for the final recording, not the most feature-rich one.

**Issue EXEC-001 — Real Testnet execution, digest proof, and explorer verification are not optional**

ID: `EXEC-001`  
Category: `DEMO`  
Title: PredictPilot must prove at least one real transaction end to end  
Severity: `CRITICAL`  
Status: `OPEN`  
What is uncertain: Whether PredictPilot’s final flow will successfully show a live digest, explorer confirmation, and post-transaction state refresh for at least one binary or vault action.  
Why it matters: Without this proof, judges may reasonably conclude the app is only a read dashboard layered on mock interactions.  
Current best-known answer: Sui transactions are PTBs; the official Explorer exists at `explorer.sui.io`, and Sui docs also reference Testnet explorers such as SuiVision. Predict’s design docs explicitly recommend authoritative onchain reads immediately around wallet flows that require confirmation-critical state. citeturn7search8turn21search2turn21search4turn4view5  
Source or evidence: Transaction overview, Explorer, Sui address docs, and Predict design docs. citeturn7search8turn21search2turn21search4turn4view5  
Required verification action: Record one live digest flow from wallet sign → success → explorer verification → portfolio/history refresh.  
Owner: `Raj + Codex`  
Blocks Codex build: `yes` for demo-ready milestone  
Blocks demo: `yes`  
Blocks submission: `yes` if real execution is claimed  
Resolution notes: A recorded fallback is acceptable only as backup, not as the primary proof if live execution works.

**Issue PORT-001 — Portfolio, PnL, and history views still need consistency checks against actual chain state**

ID: `PORT-001`  
Category: `API`  
Title: Render-ready summaries are available, but cross-check rules are not finalized  
Severity: `HIGH`  
Status: `OPEN`  
What is uncertain: Which fields in server summaries are authoritative enough for UI, how often they lag, and how transaction digests map into history payloads.  
Why it matters: Portfolio and history are core judge-confidence surfaces for PredictPilot.  
Current best-known answer: The Predict server is intended for markets, portfolios, vault summaries, and history, while the design docs explicitly recommend direct onchain reads around confirmation-critical wallet flows. Endpoints exist for manager summary, positions summary, PnL, and various mint/redeem histories, but exact schema-level digest and lag behavior still need testing. citeturn4view5turn6view0  
Source or evidence: Predict design and public endpoint docs. citeturn4view5turn6view0  
Required verification action: After every live tx in testing, compare server summary, onchain manager state, and explorer digest to define the refresh contract.  
Owner: `Codex`  
Blocks Codex build: `no`  
Blocks demo: `yes` if portfolio/history are shown  
Blocks submission: `no`  
Resolution notes: If digest is absent from history endpoints, render digest from tx result locally and deep-link explorer directly.

**Issue UIX-001 — Oracle freshness, stale data, and fallback labeling still need explicit UX rules**

ID: `UIX-001`  
Category: `UI_UX`  
Title: PredictPilot must visually distinguish live, indexed, stale, and fallback data  
Severity: `MEDIUM`  
Status: `OPEN`  
What is uncertain: Exact freshness thresholds, wording, and screen-level fallback behavior.  
Why it matters: Judges should never have to guess whether a price or portfolio row is live onchain, indexed, delayed, or mocked.  
Current best-known answer: The docs recommend split reads: public server for rendering and history, event/checkpoint streams for lower-latency oracle updates, and onchain reads for confirmation-critical state. That architecture implies the UI should expose freshness rather than hiding it. citeturn4view5turn6view0  
Source or evidence: Predict design and contract info data-flow guidance. citeturn4view5turn6view0  
Required verification action: Add visual freshness badges and fallback banners for stale or unavailable oracle/server data.  
Owner: `Codex`  
Blocks Codex build: `no`  
Blocks demo: `yes` if stale conditions are possible  
Blocks submission: `no`  
Resolution notes: This is a judge-confidence multiplier, not a cosmetic extra.

**Issue TEST-001 — End-to-end test coverage for wallet and PTB flows is not yet fully specified**

ID: `TEST-001`  
Category: `TESTING`  
Title: PredictPilot test plan must cover simulations, adapters, and at least one demo-path smoke flow  
Severity: `MEDIUM`  
Status: `OPEN`  
What is uncertain: Which flows can be safely automated in CI versus which require manual wallet validation.  
Why it matters: Without a disciplined test split, late integration changes can silently break the demo.  
Current best-known answer: PredictPilot can and should test read adapters, Zod schemas, PTB construction, and simulation-based preview logic automatically. Mysten’s official starter tooling also includes React/Vite/Tailwind and E2E-capable templates, which makes adding a smoke path practical. citeturn24view0turn24view2turn14view3turn15search1  
Source or evidence: dApp Kit starter docs, PTB docs, and SDK migration docs. citeturn24view0turn24view2turn14view3turn15search1  
Required verification action: Define separate suites for schema tests, tx-builder tests, simulation tests, and one browser smoke path.  
Owner: `Codex`  
Blocks Codex build: `no`  
Blocks demo: `no`  
Blocks submission: `no`  
Resolution notes: Wallet-extension automation may still need a manual verification supplement.

**Issue DEP-001 — Deployment and demo-hosting assumptions remain unverified**

ID: `DEP-001`  
Category: `DEPLOYMENT`  
Title: Hosted build must be validated against wallet injection and Testnet RPC expectations  
Severity: `MEDIUM`  
Status: `OPEN`  
What is uncertain: Whether the final deployment target will introduce SSR, hydration, CSP, or wallet-provider edge cases.  
Why it matters: A local-only success is not enough if judges are expected to open a live URL.  
Current best-known answer: Mysten documents both React and Next.js setup paths for the new dApp Kit, and the Next.js guide explicitly calls out client-only rendering for wallet detection. citeturn24view1turn24view2  
Source or evidence: dApp Kit React and Next.js guides. citeturn24view1turn24view2  
Required verification action: Validate the exact deployment mode and test one full hosted flow before submission day.  
Owner: `Raj + Codex`  
Blocks Codex build: `no`  
Blocks demo: `yes` if live URL is required  
Blocks submission: `depends on official rules`  
Resolution notes: Prefer the simplest hosting path that preserves wallet stability.

**Issue SEC-001 — Secrets, stale IDs, and fake demo behavior are the main security and trust risks**

ID: `SEC-001`  
Category: `SECURITY`  
Title: PredictPilot must not leak keys or fake real execution  
Severity: `CRITICAL`  
Status: `OPEN`  
What is uncertain: Nothing conceptually; the risk is operational discipline.  
Why it matters: A hacked repo, exposed private key, or mock-only demo presented as real would damage both the submission and trustworthiness of the project.  
Current best-known answer: Sui docs describe wallet derivation and signing patterns, and official docs repeatedly frame Testnet values as dynamic and provisional. PredictPilot must therefore keep private keys out of source control and keep all chain IDs/config externalized. citeturn16search12turn6view0turn0search7  
Source or evidence: Sui signing docs and Predict contract docs. citeturn16search12turn6view0turn0search7  
Required verification action: Scan the repo for secrets, remove any committed private material, and ensure every integration ID comes from config.  
Owner: `Raj`  
Blocks Codex build: `yes` if secrets are present  
Blocks demo: `yes` if fake flows are mislabeled  
Blocks submission: `yes`  
Resolution notes: Mocks may exist only in tests or clearly labeled fallback/demo mode.

**Issue DOC-001 — Documentation can accidentally overclaim unverified Predict coverage**

ID: `DOC-001`  
Category: `DOCUMENTATION`  
Title: README, demo script, and submission copy must stay synchronized with verified scope  
Severity: `HIGH`  
Status: `OPEN`  
What is uncertain: Whether the repo documents will remain consistent as implementation realities change.  
Why it matters: Documentation drift is one of the fastest ways to lose judge confidence.  
Current best-known answer: PredictPilot can truthfully claim official DeepBook Predict Testnet targets, public server integration, and the documented onchain surfaces above. It cannot truthfully claim any exact call path, market ID, or execution proof that has not been live-verified. citeturn6view0turn22view0turn23view0  
Source or evidence: Current official contract pages and endpoint docs. citeturn6view0turn22view0turn23view0  
Required verification action: Every `TODO VERIFY` that appears in build-critical code must also be reflected in docs until resolved.  
Owner: `Raj + Codex`  
Blocks Codex build: `no`  
Blocks demo: `yes` if overclaims appear in script  
Blocks submission: `yes` if overclaims appear in form/README  
Resolution notes: Prefer underclaiming to claiming a feature that cannot be demonstrated.

**Issue DEMO-001 — The live demo dependency chain is still fragile without a tested fallback plan**

ID: `DEMO-001`  
Category: `DEMO`  
Title: Wallet, RPC, Predict server, DUSDC, and oracle freshness form a multi-point failure chain  
Severity: `CRITICAL`  
Status: `OPEN`  
What is uncertain: Which component is most likely to fail during the final live walkthrough.  
Why it matters: PredictPilot is strongest when it proves real execution, but the demo must still survive partial infrastructure failure.  
Current best-known answer: The official design encourages mixed data sources precisely because indexed data and live state have different strengths. The app should therefore support a live path, a recorded backup path, and a clearly labeled fallback-render mode rather than pretending one source can do everything. citeturn4view5turn6view0  
Source or evidence: Predict design and data-flow docs. citeturn4view5turn6view0  
Required verification action: Prepare one live flow, one recorded flow, and one screenshot fallback sequence with identical narration.  
Owner: `Raj`  
Blocks Codex build: `no`  
Blocks demo: `yes`  
Blocks submission: `no`  
Resolution notes: Backup media is mandatory; switching to it must be calm and transparent.

## Guardrails, assumptions, and allowed placeholders

**Known limitations right now.** The official docs give strong visibility into deployment IDs, endpoint families, architectural roles, and many function names, but not every exact Move-call signature is exposed in easily consumable HTML because multiple embedded source panes currently show manifest errors. The current research pass also did not fully retrieve the 2026 participant handbook text. Those are real limitations and must stay visible until resolved. citeturn22view0turn23view0turn14view1turn1search2

**Assumptions that must be validated.**

- The current published Predict deployment values are still current on the day PredictPilot demos.
- The DUSDC request workflow is available and timely.
- At least one oracle/market pair is active and suitable for demo.
- The server responses contain enough fields for portfolio/history UX without hidden undocumented dependencies.
- The chosen wallet handles current Predict PTBs reliably on Testnet.
- The final submission rules do not conflict with how the repo or demo is packaged.

**Items Codex must not guess.**

- Any package ID, registry ID, Predict object ID, oracle ID, market ID, or quote coin type not verified from official docs or live discovery.
- Exact manager funding function names and exact transaction argument order where docs do not surface them.
- Any history endpoint field that has not been captured in real payload samples.
- Final hackathon deadlines, rules, or required submission assets where the official 2026 surfaces are inconsistent.
- Any claim that a simulated preview equals a real onchain result.

**Items Codex may implement with local placeholders.**

- Screenshots, demo video URLs, and live deployment URLs.
- Mock payloads used strictly in tests or UI-loading fallbacks.
- Feature-flagged range or vault UI shells while awaiting exact tx verification.
- Local dummy labels for future strategy templates, as long as execution buttons are disabled or clearly marked.

**Items that must block a production demo.**

- Missing or stale Predict deployment config.
- No funded SUI in the demo wallet.
- No funded DUSDC in the demo wallet for trade/liquidity paths.
- No verified wallet connection on the demo machine.
- No real transaction digest proof for any claimed execution feature.
- UI that hides stale-oracle or stale-server conditions.
- Any mock-only interaction dressed up as real Testnet execution.

**Items that must block submission.**

- Committed secrets or private keys.
- False claims about real DeepBook Predict integration.
- Unresolved `TODO VERIFY` on any value placed in public-facing README/submission copy as if it were final.
- Repository instructions that cannot boot the app.
- Demo assets that contradict the actual implemented scope.

**Items acceptable for hackathon MVP.**

- Range mint/redeem behind a clearly labeled preview-only flag if binary mint/redeem and one vault flow are real.
- Manual rather than fully automated wallet testing.
- Backup recorded demo evidence for live-failure handling.
- Partial portfolio analytics, if transaction digest proof and post-transaction refresh are real.

## Final verification checklists

**Final pre-Codex verification checklist.**

- Confirm the official published deployment values from the current DeepBook Predict contract docs. citeturn6view0
- Choose the client stack deliberately: `Transaction` PTBs, current dApp Kit, and a gRPC-first client path. citeturn14view3turn24view1turn15search1
- Verify exact callable signatures for every onchain function that PredictPilot will execute.
- Capture at least one real JSON sample for every Predict server endpoint consumed by the app.
- Record unresolved items in code comments as `TODO VERIFY`, not as silent assumptions.
- Keep all integration IDs in config, never in UI components.

**Final pre-demo verification checklist.**

- Primary wallet connects on the actual demo browser.
- Backup wallet is prepared and funded.
- Demo wallet has Testnet SUI and DUSDC.
- One live oracle/market pair is confirmed active.
- One full transaction path has been rehearsed end to end.
- Explorer digest lookup has been rehearsed on Testnet.
- Portfolio and/or history refresh behavior has been observed after a real transaction.
- Backup recorded demo and backup screenshots are ready.
- Every fallback path is honestly labeled as fallback.

**Final pre-submission verification checklist.**

- Re-check current Predict deployment values against the official docs. citeturn6view0
- Re-check official 2026 submission requirements from handbook/platform once accessible.
- Remove or resolve all public-facing `TODO VERIFY` items that would weaken trust.
- Confirm README, demo script, and submission form copy all describe the same scope.
- Confirm no secrets are present in git history or current working tree.
- Confirm live URL and repo URL work if required by official rules.
- Confirm at least one real transaction digest and explorer proof is available in demo assets.
- Confirm no feature is described as live unless it was actually executed or clearly marked preview/fallback.

**Go / no-go rule.** PredictPilot is ready for Codex build when all `Blocks Codex build: yes` items are either `VERIFIED` or isolated behind explicit placeholders. PredictPilot is ready for demo when all `Blocks demo: yes` items are resolved or backed by a transparent fallback. PredictPilot is ready for submission only when all `Blocks submission: yes` items are resolved and no public-facing claim depends on an unresolved `TODO VERIFY`.