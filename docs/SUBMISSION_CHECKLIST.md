# SUBMISSION_CHECKLIST.md

## Purpose and official context

### Submission checklist purpose

This file is the final pre-submission control document for **PredictPilot**, a **DeepBook Predict intelligence and execution terminal** intended for the **Sui Overflow 2026 DeepBook specialized track**. Its job is to prevent three failure modes that lose hackathons: incomplete proof of real integration, unclear judge narrative, and last-minute operational mistakes. Official public materials confirm that Sui Overflow 2026 includes a **DeepBook specialized track** for teams building **trading or liquidity applications powered by DeepBook’s on-chain orderbook**, and that teams must choose **one** track for submission. citeturn19view1turn1view0

### Submission goal

The goal is not merely to upload files. The goal is to submit a project that makes judges immediately confident that PredictPilot is:

- a real **Sui** application,
- a real **DeepBook Predict** integration,
- capable of **real Testnet execution**,
- safe enough to demo under pressure,
- and clearly differentiated from a generic prediction-market UI or a read-only analytics dashboard. DeepBook Predict is officially documented as an expiry-based protocol on Sui for **binary positions**, **vertical ranges**, and **vault LPing via PLP**; the current public integration target is on **Sui Testnet**. citeturn20view3turn21search0turn20view1

### Hackathon track being targeted

**Target track:** **DeepBook specialized track**. The official Sui Overflow 2026 site describes this track as: **“Build trading or liquidity applications powered by DeepBook’s on-chain orderbook.”** The same page also shows a **$70,000 USD** DeepBook specialized track pool on the public site. citeturn19view2turn19view0

### Final project positioning

Use this positioning everywhere:

> **PredictPilot is a DeepBook Predict intelligence and execution terminal on Sui Testnet. It helps users discover active Predict markets, inspect oracle state and risk, preview PTBs before signing, execute real mint/redeem and LP actions, and verify outcomes through portfolio updates and transaction digests.**

That positioning is grounded in the official DeepBook Predict docs, which define the protocol around `Predict`, `PredictManager`, `OracleSVI`, vault flows, public server rendering, and Testnet transaction flows for mint, redeem, range, supply, and withdraw. citeturn20view1turn20view2turn21search0turn12search0

### Official submission requirements

The official public sources that were retrievable during this research confirm the following:

- Sui Overflow 2026 is the official annual Sui hackathon and the official site links registration to **DeepSurge**. citeturn1view0turn0search0
- The official site states that **anyone is welcome to participate** and there are **no experience requirements**. citeturn1view0
- The official site states that a project must be submitted to **one track only**. citeturn1view0
- The official site links to the **Participant Handbook**, **Event Participation Terms & Conditions**, and **Hackathon Terms of Service**, but stable text snapshots of the full handbook/rules were not fully retrievable during this research session. Treat any rule not explicitly captured here as **`TODO VERIFY`** against the live handbook and submission portal before final submission. citeturn1view0turn2search1

### Official deadline checklist

There is an important operational warning: the currently indexed official pages show **inconsistent timeline data**. The official Overflow page header says **“May - August, 2026”**, while its timeline block still includes stale **2025** labels and dates, and the DeepSurge search preview shows **May 6, 2026 - Jun 20, 2026** for Sui Overflow 2026. Because of that inconsistency, do **not** hardcode submission dates inside your repo or pitch. Final dates must be checked on the live submission portal and handbook on the day you submit. citeturn1view0turn14search1

**Official deadline checklist**

- [ ] Confirm **final submission deadline** from the live DeepSurge submission page. **`TODO VERIFY`**
- [ ] Confirm whether **demo day participation** is required for shortlisted teams. **`TODO VERIFY`**
- [ ] Confirm whether **community voting** affects the submission package you need to prepare. **`TODO VERIFY`**
- [ ] Confirm whether there is a **video duration limit** or specific upload format. **`TODO VERIFY`**
- [ ] Screenshot the live deadline page and store it in `docs/submission/screenshots/official-deadline-proof.png`.
- [ ] Update `README.md`, `DEMO_SCRIPT.md`, and the submission form draft if any date changed.

### Eligibility checklist

- [ ] Confirm all team members satisfy live prize eligibility rules in the handbook/terms. **`TODO VERIFY`**
- [ ] Confirm whether university status is needed for the **University Award**. The public site shows **$2,500 USD to 10 winners** for university teams. citeturn19view0
- [ ] Confirm whether there are country, sanctions, or restricted-territory rules in the hackathon terms. **`TODO VERIFY`**
- [ ] Confirm whether contributors added after registration must also be listed in DeepSurge. **`TODO VERIFY`**
- [ ] Confirm whether reused pre-hackathon code is allowed and under what conditions. **`TODO VERIFY`**

### Track requirement checklist

For the DeepBook track, the safest interpretation of the official wording is that your project must be visibly and materially built on **DeepBook’s trading/liquidity stack**, not just adjacent to it. Official DeepBook Predict materials also position Predict as the third DeepBook primitive alongside **Spot** and **Margin**, enabling builders to create binary markets, options-like structures, leveraged products, and structured instruments. citeturn19view2turn20view0turn20view3

- [ ] The home screen explicitly names **DeepBook Predict**.
- [ ] The app shows real DeepBook Predict **market/oracle/vault** data from the official Testnet surfaces.
- [ ] The app executes at least one real **Predict** transaction on Sui Testnet.
- [ ] The demo explains why PredictPilot belongs in **DeepBook**, not only in DeFi/Payments or Infra.
- [ ] The README and submission form explicitly describe how PredictPilot uses **Predict**, **PredictManager**, **OracleSVI**, and the **vault/PLP** model.

### DeepBook Predict minimum requirement checklist

These are the minimum submission standards for PredictPilot if you want judges to believe the “DeepBook Predict terminal” claim:

- [ ] Use the **current documented Testnet integration target**, not older package IDs.
- [ ] Read indexed data from the official **Predict server**.
- [ ] Use direct onchain object reads for confirmation-critical wallet flows.
- [ ] Demonstrate at least one real write path from the official Predict flow set: `predict::create_manager`, `predict::mint`, `predict::redeem`, `predict::mint_range`, `predict::redeem_range`, `predict::supply`, `predict::withdraw`, plus manager deposit/withdraw handling. citeturn21search0turn12search0
- [ ] Show at least one real **transaction digest** and verify it in a Sui explorer.
- [ ] Refresh portfolio/history state after execution.

### MUST SUBMIT, SHOULD SUBMIT, NICE TO HAVE, DO NOT SUBMIT

**MUST SUBMIT**

- a working repository,
- a polished README,
- a working deployed app or clearly reproducible local run path,
- a demo video,
- a DeepBook-track-aligned project description,
- proof of real Testnet integration,
- at least one verifiable transaction digest,
- no secrets in the repo.

**SHOULD SUBMIT**

- live deployment,
- multiple execution proofs,
- screenshots,
- architecture diagram,
- explicit tested wallet list,
- clear known limitations,
- backup demo recording,
- final judge FAQ notes.

**NICE TO HAVE**

- multiple wallets tested,
- LP flow proof in addition to trader flow,
- range flow proof in addition to binary flow,
- separate proof artifacts directory,
- post-transaction explorer screenshots,
- short explainer GIFs or screenshots for README.

**DO NOT SUBMIT**

- fake or mocked execution presented as real,
- outdated package IDs or stale screenshots from older Predict deployments,
- broken links,
- private keys,
- verbose claims for flows that are not actually implemented,
- “coming soon” features framed as live,
- screenshots without clear DeepBook Predict evidence,
- a generic prediction-market pitch with no DeepBook-specific terminology.

## Repository and project readiness

### Repository readiness checklist

- [ ] Default branch builds from a clean clone.
- [ ] `README.md` exists at repo root and matches the final product.
- [ ] `LICENSE` exists. If final license is undecided, add **`TODO VERIFY`** and resolve before submission.
- [ ] `.env.example` exists and contains **only placeholder values**, never live secrets.
- [ ] `package.json` scripts are accurate and tested.
- [ ] `src/` has no dead demo-only code that contradicts the final product.
- [ ] `docs/` contains the core planning docs that explain the build clearly.
- [ ] The repo includes no generated junk, accidental screen recordings, node_modules, or large binary artifacts that are not needed for judging.

### README readiness checklist

The README must do two jobs at once: help judges understand value quickly and help builders run the app without guessing.

- [ ] Title, tagline, and one-line summary clearly say **PredictPilot** and **DeepBook Predict**.
- [ ] README states the project targets the **Sui Overflow 2026 DeepBook specialized track**. citeturn19view1
- [ ] README explains that DeepBook Predict is an expiry-based protocol supporting **binary positions**, **vertical ranges**, and **vault LP shares via PLP**. citeturn20view3turn20view1
- [ ] README includes verified current Testnet config values:
  - Predict package: `0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138`
  - Predict registry: `0x43af14fed5480c20ff77e2263d5f794c35b9fab7e2212903127062f4fe2a6e64`
  - Predict object: `0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a`
  - Predict server: `https://predict-server.testnet.mystenlabs.com`
  - DUSDC coin type: `0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC`
  - DUSDC currency ID: `0xf3000dff421833d4bb8ed58fac146d691a3aaba2785aa1989af65a7089ca3e9c`
  - PLP coin type: `0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138::plp::PLP`  
  These values are officially documented as **Testnet integration targets** and may change before Mainnet, so the README must label them as provisional. citeturn21search0turn20view3
- [ ] README links to the demo video and live app.
- [ ] README includes at least one screenshot where the DeepBook Predict identity is obvious.
- [ ] README explicitly states which flows are implemented and which remain **`TODO VERIFY`** or out of scope.

### Documentation readiness checklist

- [ ] `PROJECT_VISION.md` and `MVP_SCOPE.md` still match the shipped app.
- [ ] `TECHNICAL_ARCHITECTURE.md` matches the repo structure.
- [ ] `TESTING_STRATEGY.md` matches actual test commands and CI.
- [ ] `DEMO_SCRIPT.md` matches the real UI and current data flow.
- [ ] All docs using package IDs, object IDs, or server URLs are updated to the same values.
- [ ] All unresolved docs placeholders are either removed or isolated in a clearly labeled **`TODO VERIFY`** section.

### Code quality checklist

- [ ] `pnpm install`, `pnpm build`, `pnpm lint`, and `pnpm typecheck` pass.
- [ ] There are no TypeScript `any` escape hatches around critical transaction-building code unless documented.
- [ ] Error messages shown to users are useful and human-readable.
- [ ] No raw package/object IDs are scattered through UI components; config drives them.
- [ ] Wallet, network, and API code paths are isolated from presentation logic.
- [ ] Transaction utilities are centralized and testable.
- [ ] No unhandled promise rejections in wallet or fetch flows.

### Frontend readiness checklist

- [ ] App loads on **Sui Testnet** by default.
- [ ] Connect wallet flow works with the chosen supported wallet(s).
- [ ] Wrong-network state is obvious.
- [ ] Market view, oracle state, risk preview, PTB preview, and confirmation result are visible without explanation.
- [ ] After a real transaction, the UI shows:
  - updated balance or position,
  - updated portfolio summary,
  - updated transaction history,
  - the transaction digest,
  - a path to explorer verification.
- [ ] Empty, loading, success, and failure states look intentional.
- [ ] Mobile or small-screen responsiveness is acceptable for judges reviewing on laptop displays.

### Backend readiness checklist

DeepBook Predict’s recommended app integration model is to use the **official public Predict server** for render-ready market/portfolio/vault/history data, reserve **direct onchain reads** for confirmation-critical flows, and optionally subscribe to Sui events for low-latency oracle updates. That means PredictPilot does **not** need a custom backend to be credible. If you add a proxy/API adapter, it must be clearly documented and deployed. citeturn20view1turn21search0

- [ ] If no backend exists, README clearly says the app is a direct client integration over the official Predict server plus Sui wallet/onchain reads.
- [ ] If a backend exists, document hosting, health checks, failure mode, and fallback UI.
- [ ] No backend secret is required for ordinary judge use.
- [ ] All backend URLs are environment-driven.

### Environment readiness checklist

- [ ] `NEXT_PUBLIC_SUI_NETWORK` is `testnet`.
- [ ] Predict server URL points to the official documented server.
- [ ] Package/object IDs match official docs.
- [ ] Explorer base URL is valid.
- [ ] Wallet address used in the demo has Testnet SUI and DUSDC.
- [ ] Test wallet is not your primary personal wallet.
- [ ] Faucet and token request paths are documented. Official Sui docs confirm that Testnet SUI is free and available via faucet, and official DeepBook Predict docs state that builders can request Testnet tokens including DUSDC via the DeepBook Predict token request form. citeturn13search3turn20view3

### Deployment readiness checklist

- [ ] Live URL loads without manual headers or local setup.
- [ ] Deployment uses the same config values shown in docs.
- [ ] 404 routes and refresh behavior are sane.
- [ ] CSP or production headers do not break wallet connection.
- [ ] Main landing page is available at the exact URL you plan to submit.
- [ ] The deployed app is tested after the final production build, not only in local dev.

### Testing readiness checklist

- [ ] Unit tests pass.
- [ ] Integration tests for API adapters and wallet-independent flows pass.
- [ ] PTB simulation tests pass.
- [ ] At least one end-to-end real wallet/manual flow has been re-run in the final environment.
- [ ] Any removed features also had their stale tests removed or updated.
- [ ] For any local Move packages, `sui move test` passes, and use `sui move test --coverage` if relevant. Official Sui docs recommend `sui move test --coverage` for uncovering missing coverage. citeturn23search0turn23search5

### Security readiness checklist

- [ ] No private keys or mnemonics are committed.
- [ ] No demo wallet secrets are stored in client code.
- [ ] No admin/operator controls from registry/oracle maintenance surfaces are exposed to normal users unless intentionally part of the demo.
- [ ] Rate limits or retry logic prevent spammy broken states against the Predict server.
- [ ] No misleading “simulated success” copy is shown for failed transactions.
- [ ] If you use sponsored flows or future auth experiments, they are clearly labeled and documented.

### Secrets and private key checklist

- [ ] Search the repo for `PRIVATE_KEY`, `MNEMONIC`, `SECRET`, `pk_`, `sk_`, `seed`, and wallet export strings.
- [ ] Inspect `.env`, `.env.local`, CI secrets, Vercel settings, and shell history.
- [ ] Confirm screenshots and screen recordings never reveal wallet addresses you do not intend to publicize.
- [ ] Confirm no transaction-signing debug logs include sensitive payloads.

### License checklist

- [ ] `LICENSE` file exists.
- [ ] README references the same license.
- [ ] Any third-party assets used in screenshots/video are properly licensed or removed.
- [ ] If license is not final, resolve before submission. Do not leave public repo license-ambiguous.

### Open source cleanliness checklist

- [ ] Remove abandoned branches or stale demos from default-branch docs.
- [ ] Ensure commit history does not include leaked secrets. If it does, rotate the secret and rewrite history or create a clean public mirror.
- [ ] Remove unused packages.
- [ ] Remove placeholder branding that makes the app look unfinished.

### Known limitations checklist

- [ ] README contains a short, honest **Known Limitations** section.
- [ ] Any incomplete flow is framed as future work, not present capability.
- [ ] If a feature is demo-only or fallback-only, say so explicitly.
- [ ] If any official rule detail is unresolved because of source inconsistency, keep it in **`TODO VERIFY`** until resolved.

### `TODO VERIFY` cleanup checklist

- [ ] Re-check hackathon deadline live.
- [ ] Re-check handbook-specific video/submission constraints.
- [ ] Re-check DeepSurge form fields.
- [ ] Re-check current Predict package/object IDs in the docs on submission day.
- [ ] Re-check active supported quote asset list.
- [ ] Re-check whether your chosen demo oracle and market are still active on Testnet.
- [ ] Re-check wallet compatibility after final deployment.

## DeepBook Predict and Sui integration readiness

### DeepBook Predict integration readiness checklist

Official docs currently define the public Testnet integration target as:

- Predict package: `0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138`
- Predict registry: `0x43af14fed5480c20ff77e2263d5f794c35b9fab7e2212903127062f4fe2a6e64`
- Predict object: `0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a`
- Public server: `https://predict-server.testnet.mystenlabs.com`
- DUSDC coin type: `0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC`
- PLP coin type: `0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138::plp::PLP`  
Use those values only through config, and remember the docs explicitly warn that Testnet identifiers are provisional and can change before Mainnet. citeturn21search0turn20view3

- [ ] App reads market state from `GET /predicts/:predict_id/state`.
- [ ] App reads oracle lists from `GET /predicts/:predict_id/oracles`.
- [ ] App reads per-oracle state from `GET /oracles/:oracle_id/state`.
- [ ] App can load portfolio data from `GET /managers/:manager_id/summary`, `GET /managers/:manager_id/positions/summary`, and `GET /managers/:manager_id/pnl?range=ALL`.
- [ ] App can load vault data from `GET /predicts/:predict_id/vault/summary`.
- [ ] App can load history via the documented history endpoints.
- [ ] App degrades gracefully if the Predict server is unavailable. Official docs recommend using the server for render-ready data and direct onchain reads around wallet flows. citeturn21search0turn20view1

### Sui PTB readiness checklist

Sui documentation defines PTBs as the standard way to compose user transactions, and the official TypeScript SDK `Transaction` builder supports multi-command flows, automatic dry-run gas budgeting, and wallet serialization. The modern client also supports `simulateTransaction` so you can inspect effects and balance changes before execution. citeturn13search0turn24view1turn25view0

- [ ] PredictPilot builds transactions with `Transaction` from `@mysten/sui/transactions`.
- [ ] Gas budget is either dry-run derived or explicitly set where needed.
- [ ] Simulation/preview path is implemented for critical flows.
- [ ] Final signing flow is wallet-native; avoid brittle hand-built BCS in app code when unnecessary.
- [ ] PTB preview shown to users matches the actual command intent.
- [ ] Failed simulation blocks signing for clearly invalid flows.

### Wallet integration readiness checklist

Official dApp Kit docs provide a `ConnectButton`, current account hooks, testnet network configuration, and auto-connect behavior. PredictPilot must show a clean wallet flow on top of those supported patterns. citeturn24view2turn24view3

- [ ] `ConnectButton` or equivalent wallet UI works.
- [ ] Current account and current network are visible somewhere in the session state.
- [ ] Wrong network is detected and surfaced.
- [ ] Wallet reconnect on refresh does not corrupt app state.
- [ ] Signing rejection shows a clear user-facing message.
- [ ] Manual fallback instructions exist if the auto-connect state misbehaves.

### dUSDC readiness checklist

The official DeepBook Predict docs identify **DUSDC** as the current quote asset on Testnet and publish its type and currency ID. Official docs also state builders can request DeepBook Predict Testnet tokens, including DUSDC, via the token request form. citeturn21search0turn20view3

- [ ] DUSDC balance is shown.
- [ ] The app validates DUSDC availability before allowing deposit or trade actions.
- [ ] Deposit and withdraw UX use the correct DUSDC decimals.
- [ ] Missing DUSDC produces a clear acquisition/request path.

### PredictManager readiness checklist

`PredictManager` is a **per-user shared account object** that wraps a DeepBook `BalanceManager`, stores quote balances, and tracks positions and ranges internally. Official docs emphasize that users should create **one manager and reuse it**, and that positions/ranges are **not separate onchain objects**. citeturn20view2turn12search0

- [ ] App can discover an existing manager for the connected wallet.
- [ ] App can create a manager if none exists.
- [ ] App shows the manager ID visibly after creation/discovery.
- [ ] App can deposit quote assets into the manager.
- [ ] App can withdraw quote assets from the manager.
- [ ] Portfolio views read positions/ranges from the manager-backed surfaces, not from nonexistent standalone position objects.

### OracleSVI readiness checklist

Official docs define `OracleSVI` as the market state for one underlying and one expiry, storing spot, forward, SVI params, timestamp, lifecycle status, and settlement price. Mints require a **live oracle**; redeems may use **live or settled** state; after settlement, price/SVI updates are rejected. citeturn9view3turn20view1

- [ ] Latest oracle state is shown.
- [ ] Last update timestamp is visible.
- [ ] Oracle freshness or stale warning is visible.
- [ ] Oracle lifecycle state is visible: inactive, active, pending settlement, or settled.
- [ ] Ask bounds are displayed where relevant.
- [ ] User cannot attempt a mint when the oracle is not live.

### Vault and PLP readiness checklist

Official DeepBook Predict docs state that the vault takes the opposite side of every Predict trade, holds the accepted quote assets, tracks liabilities/exposure, and mints/burns `PLP` for LP operations. LPs call `predict::supply` and `predict::withdraw`; withdrawals are limited by available vault value after covering current max payout. citeturn9view4turn20view1

- [ ] Vault summary screen loads.
- [ ] PLP balance is shown if present.
- [ ] Supply and withdraw previews show expected quote/PLP impact.
- [ ] Vault utilization and available-withdraw messaging are understandable.
- [ ] LP proof transaction digest can be shown if the LP path is part of the final submission.

### Binary mint readiness checklist

The official repository integration quickstart identifies `predict::mint<Quote>` as the directional position mint entrypoint, using `Predict`, `PredictManager`, `OracleSVI`, `MarketKey`, `quantity`, and `Clock`. Official docs also state that Predict uses oracle fair prices plus spread/utilization adjustments and can enforce ask bounds and exposure checks. citeturn12search0turn20view1turn23search10

- [ ] User can select market direction and strike.
- [ ] Quantity input validates min/max and precision.
- [ ] Risk preview appears before signing.
- [ ] PTB preview appears before signing.
- [ ] Simulation matches expected manager debit.
- [ ] Successful mint updates position quantity and transaction history.
- [ ] Mint digest is saved into proof artifacts.

### Binary redeem readiness checklist

The official repository quickstart identifies `predict::redeem<Quote>` and `predict::redeem_permissionless<Quote>` for settled positions. Official docs state that redeem decreases manager quantity and returns quote asset into the manager. citeturn12search0turn9view3

- [ ] App shows redeemable quantity.
- [ ] Redeem preview is available.
- [ ] Live or settled-state gating is correct.
- [ ] Success updates manager balance, positions, and history.
- [ ] Failure states explain whether the position is not redeemable yet, insufficient quantity, or stale local state.

### Range mint readiness checklist

The official repository quickstart identifies `predict::mint_range<Quote>` for bounded range positions. DeepBook Predict docs also define vertical ranges as a first-class protocol capability. citeturn12search0turn20view3

- [ ] Lower and upper strikes are clearly selected and displayed.
- [ ] Invalid lower/upper combinations are blocked before signing.
- [ ] Range preview shows expected cost and exposure.
- [ ] Range mint writes real state on Testnet if the flow is included in the final scope.
- [ ] If only preview is implemented, the submission materials do **not** claim full execution.

### Range redeem readiness checklist

The official repository quickstart identifies `predict::redeem_range<Quote>` for range redemption. citeturn12search0

- [ ] App lists existing range quantity.
- [ ] Redeem preview works.
- [ ] Success updates history and portfolio surfaces.
- [ ] If not implemented fully, remove any “live redeem” claim from README, video, and form text.

### Vault supply readiness checklist

Official docs identify `predict::supply<Quote>` as the LP entrypoint and document that the first supplier receives shares one-to-one while later suppliers receive proportional shares relative to current vault value. citeturn12search0turn20view1

- [ ] Supply preview shows DUSDC in and PLP out.
- [ ] Supply flow handles wallet gas and quote asset selection cleanly.
- [ ] Vault summary refreshes after supply.
- [ ] PLP balance refreshes after supply.

### Vault withdraw readiness checklist

Official docs identify `predict::withdraw<Quote>` as the LP withdraw entrypoint and state that withdrawals are limited by current vault value and payout coverage. citeturn12search0turn20view1

- [ ] Withdraw preview works.
- [ ] If the withdrawal limiter or vault availability blocks the action, the error is understandable.
- [ ] Successful withdraw reduces PLP and returns quote asset visibility to the user.

### Portfolio readiness checklist

Official docs recommend using manager summary, position summary, and PnL endpoints for portfolio rendering. citeturn21search0turn20view1

- [ ] Portfolio loads after wallet connect or manager discovery.
- [ ] Empty-state copy is intentional for zero-position users.
- [ ] Portfolio refreshes after every successful transaction.
- [ ] Portfolio reflects both binary and range positions if both are in scope.
- [ ] LP holdings are visible if LP flows are enabled.

### PnL readiness checklist

Official docs publish `GET /managers/:manager_id/pnl?range=ALL` for manager PnL. citeturn21search0

- [ ] PnL loads from the documented endpoint.
- [ ] PnL time range labels are accurate.
- [ ] PnL fallback/empty state is handled if newly funded manager has no realized history.
- [ ] PnL does not display obviously stale or contradictory numbers after execution without a refresh indicator.

### Transaction history readiness checklist

Official docs publish history endpoints for positions, ranges, LP events, and oracle/trade history. citeturn21search0turn12search0

- [ ] User-visible history updates after a successful transaction.
- [ ] The just-executed transaction appears with a digest or a refresh indicator if indexer lag exists.
- [ ] If server lag delays history appearance, the UI says so instead of silently looking broken.

### Transaction digest proof checklist

- [ ] At least one real digest is shown in the app after a successful transaction.
- [ ] Digest is copyable.
- [ ] Digest is stored in `docs/submission/proof/digests.md`.
- [ ] Each digest is labeled with flow type, wallet address, and approximate time.
- [ ] You can explain exactly which user action produced each digest.

### Testnet execution proof checklist

**Minimum acceptable proof set for PredictPilot**

- [ ] one digest for manager creation **or** a clearly existing manager proof,
- [ ] one digest for DUSDC deposit into manager,
- [ ] one digest for binary mint,
- [ ] one digest for binary redeem **or** range mint/redeem,
- [ ] one digest for LP supply/withdraw **if vault flow is claimed as implemented**.

If a flow is incomplete, do not fabricate proof. Reduce scope and adjust the pitch.

### Sui Explorer proof checklist

- [ ] Every must-show digest opens in a Sui explorer.
- [ ] Store explorer screenshots in `docs/submission/screenshots/`.
- [ ] At least one screenshot clearly shows the digest and successful execution status.
- [ ] At least one screenshot clearly shows changed objects or balance changes if helpful.
- [ ] Explorer screenshots match the same wallet and same flow shown in the demo.

### Risk preview readiness checklist

- [ ] Risk preview blocks clearly invalid quantities.
- [ ] Risk preview blocks missing manager or missing DUSDC.
- [ ] Risk preview blocks stale/non-live oracle mints.
- [ ] Risk preview warns on dangerous LP withdrawals or bounded-liquidity conditions.
- [ ] Risk preview text is judge-readable, not only developer-readable.

### Transaction preview readiness checklist

- [ ] Transaction preview appears before the wallet signature popup.
- [ ] Preview shows action type, asset, manager, oracle, and intended quantity.
- [ ] Preview distinguishes **simulation/preview** from **executed result**.
- [ ] Preview and actual signed action never disagree.
- [ ] Failed preview prevents misleading wallet prompts where possible.

### Demo mode readiness checklist

- [ ] Demo mode, if present, is clearly labeled.
- [ ] Demo mode never pretends a mocked transaction is a real chain result.
- [ ] Demo mode may provide preset market selection, cached screenshots, or prerecorded fallback states.
- [ ] Real execution remains available and is the primary path shown to judges.

## Demo, judging, and proof package readiness

### Demo video readiness checklist

- [ ] Video opens with the exact problem and why DeepBook Predict matters.
- [ ] Video shows the market/oracle screen quickly.
- [ ] Video includes wallet connect.
- [ ] Video includes at least one real Testnet execution or clearly labeled backup proof.
- [ ] Video shows post-transaction portfolio/history refresh.
- [ ] Video shows at least one transaction digest.
- [ ] Audio is clear, cursor clicks are visible, text is legible.
- [ ] Any fallback proof is clearly labeled as backup, not passed off as live.

### Live demo readiness checklist

- [ ] Demo wallet has enough SUI gas and DUSDC.
- [ ] Browser tab noise is removed.
- [ ] Wallet extension is preloaded and unlocked.
- [ ] Correct network is selected.
- [ ] Demo account has either an existing manager or the manager creation path has been rehearsed.
- [ ] Known-good oracle/market selection is prepared. **`TODO VERIFY`** live on demo day.

### Backup demo readiness checklist

- [ ] Backup video exists locally.
- [ ] Backup screenshots exist for connect, market, preview, sign, digest, explorer, portfolio refresh.
- [ ] If the Predict server is down, you can still explain the architecture and show real prior proof assets.
- [ ] If wallet signing fails live, you can switch to recorded proof without confusion.

### Screenshots readiness checklist

Store final screenshots here:

- `docs/submission/screenshots/home-market.png`
- `docs/submission/screenshots/wallet-connected.png`
- `docs/submission/screenshots/predict-manager.png`
- `docs/submission/screenshots/risk-preview.png`
- `docs/submission/screenshots/tx-preview.png`
- `docs/submission/screenshots/tx-success-digest.png`
- `docs/submission/screenshots/explorer-proof.png`
- `docs/submission/screenshots/portfolio-refresh.png`
- `docs/submission/screenshots/vault-summary.png` **if LP flow is claimed**

### Pitch readiness checklist

Prior Sui Overflow winners show that projects are judged in a crowded field: the 2025 edition had **599 submissions from 85 countries**, and the 2024 edition had **352 submissions** with **47 judges** across demo days. That means PredictPilot must feel finished, specific, and technically real within minutes. This is an inference based on official winner summaries and competition scale. citeturn17view0turn18search4

- [ ] Opening line says what PredictPilot is in one sentence.
- [ ] Second line says why it belongs in the DeepBook track.
- [ ] Third line says what proof judges will see.
- [ ] Pitch avoids claiming “exchange,” “options desk,” or “full portfolio engine” unless the demo truly proves those claims.

### Judge narrative checklist

- [ ] Explain that Predict is part of the DeepBook stack alongside Spot and Margin. citeturn20view0
- [ ] Explain that PredictManager is the user trading account, not a cosmetic abstraction. citeturn20view2
- [ ] Explain that OracleSVI governs tradeability and settlement state. citeturn9view3turn20view1
- [ ] Explain that the vault is the counterparty side and LPs receive PLP. citeturn9view4turn20view1
- [ ] Explain that the app uses the official Predict server for rendering and direct chain reads for confirmation-critical flows. citeturn20view1turn21search0

### Technical explanation checklist

- [ ] Show the official Predict package/object/server values in docs or config.
- [ ] Explain the three-source data model:
  - Predict server for indexed rendering,
  - Sui events/checkpoints for freshness if needed,
  - direct onchain reads around wallet flows. citeturn20view1turn21search0
- [ ] Explain why PTBs matter on Sui.
- [ ] Explain why the wallet signs a transaction only after preview/simulation.
- [ ] Explain how a signed tx becomes a digest and then a portfolio refresh.

### Common disqualification risks

- claiming the DeepBook track while failing to show real DeepBook usage,
- shipping only a mock frontend,
- hardcoding stale or wrong Testnet IDs,
- broken live link,
- submission assets contradicting the repo,
- leaked secrets,
- demo video showing flows that the public repo cannot reproduce,
- missing acknowledgment of fallback/mock mode.

### Common judge confusion risks

- the app looks like a generic prediction market and never names DeepBook Predict,
- the UI never explains `PredictManager`,
- the UI never explains why oracle freshness matters,
- the transaction preview is invisible,
- the transaction digest is not surfaced,
- portfolio/history do not visibly refresh,
- LP flow is listed as a feature but absent from the video,
- range products are mentioned in README but absent from the product.

### Final Q&A reminders for judges

- “Is this real Testnet?” → show the digest and explorer.
- “Why DeepBook?” → show Predict/manager/oracle/vault terminology and execution.
- “What’s unique versus a normal prediction market frontend?” → show risk preview, PTB preview, oracle state, and DeepBook-native liquidity framing.
- “What’s onchain versus offchain?” → explain server-rendered indexed reads versus authoritative onchain writes and reads.
- “How do you know it worked?” → show tx digest, updated manager state, updated portfolio/history.

## Final timeline and submission operations

### Last 72 hours checklist

- [ ] Freeze scope.
- [ ] Resolve all P0 bugs in real transaction flows.
- [ ] Re-verify current Predict Testnet IDs from the docs.
- [ ] Rehearse full demo twice.
- [ ] Record backup video.
- [ ] Clean README and docs.
- [ ] Generate proof digests and screenshots.

### Last 48 hours checklist

- [ ] Run final build from a fresh clone.
- [ ] Re-test live deployment.
- [ ] Re-test wallet connect on final domain.
- [ ] Re-test at least one real mint/redeem path.
- [ ] Re-test LP path if claimed.
- [ ] Re-check DeepSurge submission form fields. **`TODO VERIFY`**
- [ ] Re-check submission deadline. **`TODO VERIFY`**

### Last 24 hours checklist

- [ ] Upload demo video.
- [ ] Validate every submitted link while logged out.
- [ ] Export final screenshots.
- [ ] Finalize paste-ready descriptions.
- [ ] Confirm team names and contacts.
- [ ] Confirm repo default branch is the intended public state.

### Last 6 hours checklist

- [ ] Refill SUI gas if needed.
- [ ] Confirm DUSDC availability.
- [ ] Unlock wallet and clear extraneous browser state.
- [ ] Open live app and confirm good market/oracle visibility.
- [ ] Open explorer tab and proof folder for backup.
- [ ] Keep submission text in a local plain-text file in case portal glitches.

### Final 30 minutes checklist

- [ ] Submit only after opening every link one last time.
- [ ] Verify DeepBook track selected.
- [ ] Verify video URL is public.
- [ ] Verify repo URL is public.
- [ ] Verify live app URL is public.
- [ ] Verify no placeholder “TODO” text remains in the form.
- [ ] Screenshot the completed submission form before pressing submit, if possible.
- [ ] Screenshot submission confirmation after submit.

### Submission form checklist

Because the live DeepSurge form fields were not fully retrievable in a stable text capture during this research session, treat the list below as the **expected submission packet** and map it to the actual form at submit time. **`TODO VERIFY`** any field that differs in the live portal.

- [ ] Project name: `PredictPilot`
- [ ] Track: `DeepBook`
- [ ] Short description
- [ ] Long description
- [ ] GitHub repository URL
- [ ] Live demo URL
- [ ] Demo video URL
- [ ] Team members
- [ ] Contact email
- [ ] Country / university status if requested **`TODO VERIFY`**
- [ ] Key features
- [ ] Technical architecture summary
- [ ] What was built during the hackathon **`TODO VERIFY`**
- [ ] Wallet address or contract/object references if requested **`TODO VERIFY`**
- [ ] Any required compliance / originality attestation **`TODO VERIFY`**

### Submission assets checklist

Prepare these assets before opening the form:

- [ ] public repo URL
- [ ] public live app URL
- [ ] public demo video URL
- [ ] short description
- [ ] long description
- [ ] feature bullets
- [ ] technical highlights
- [ ] DeepBook integration explanation
- [ ] Sui integration explanation
- [ ] screenshot pack
- [ ] proof digests document
- [ ] explorer screenshot
- [ ] optional pitch deck or architecture image if allowed **`TODO VERIFY`**

### Post-submission checklist

- [ ] Save submission confirmation screenshot.
- [ ] Save submitted text in `docs/submission/final-form-copy.md`.
- [ ] Tag the submitted commit in git.
- [ ] Do not force-push breaking changes after submission without strong reason.
- [ ] Keep the deployed app live through judging.
- [ ] Be ready for demo-day follow-up.

## Paste-ready submission copy and final sign-off

### Final judge-facing project summary

Use this summary as the top-level submission narrative. It is grounded in the official DeepBook Predict scope and the DeepBook specialized track description. citeturn19view2turn20view3turn20view0

**Paste-ready summary**

PredictPilot is a DeepBook Predict intelligence and execution terminal on Sui Testnet. It helps users discover active Predict markets, inspect oracle freshness and ask bounds, create or reuse a PredictManager, fund it with DUSDC, preview risk and PTB details before signing, execute real binary/range or LP actions, and immediately verify outcomes through updated portfolio state, transaction history, and onchain digests.

### Final short project description

**Paste-ready short description**

PredictPilot is a DeepBook Predict terminal for Sui that turns oracle-aware market discovery into real Testnet execution. Users can inspect Predict markets, preview risk and PTB actions, execute mint/redeem and LP flows, and verify results through transaction digests and refreshed portfolio state.

### Final long project description

This description is aligned to the official Predict model of `Predict`, `PredictManager`, `OracleSVI`, vault + `PLP`, and the documented Testnet public server architecture. citeturn20view1turn20view2turn21search0

**Paste-ready long description**

PredictPilot is a DeepBook Predict intelligence and execution terminal built for the Sui Overflow 2026 DeepBook track. Instead of acting like a generic prediction-market frontend, it is designed around DeepBook Predict’s actual primitives: users discover live oracle-driven markets, inspect oracle freshness and ask bounds, create or reuse a PredictManager, fund it with DUSDC, preview risk and PTB details before signing, and execute real Testnet mint, redeem, range, or LP flows. After execution, PredictPilot refreshes portfolio, PnL, and history views and surfaces transaction digests so judges can verify that the app is not just reading data—it is driving real Sui transactions against DeepBook Predict.

### Final feature bullets

**Paste-ready feature bullets**

- DeepBook Predict market discovery using the official Testnet Predict server
- Oracle-aware trading UX with freshness, lifecycle, and ask-bound visibility
- PredictManager discovery, creation, DUSDC deposit, and DUSDC withdraw flows
- Binary mint and redeem flow with pre-sign risk preview
- Range position preview or execution flow, depending on final shipped scope
- Vault and PLP summary, plus LP supply/withdraw if enabled in the final build
- PTB preview before wallet signing
- Post-transaction portfolio, PnL, and history refresh
- Transaction digest surfacing and explorer-verifiable proof
- Backup-safe demo mode without disguising mock execution as real execution

### Final technical highlights

**Paste-ready technical highlights**

- Built on Sui Testnet using wallet-signed programmable transaction blocks
- Integrates the official DeepBook Predict Testnet package, registry, object, DUSDC coin type, and public server
- Uses the official Predict server for render-ready market, vault, portfolio, and history data
- Uses direct onchain reads and transaction confirmation for authoritative wallet flows
- Supports transaction simulation/preview before signature for safer execution UX
- Surfaces transaction digests and post-write state refresh for judge-verifiable proof

### Final DeepBook integration explanation

The copy below is aligned with the official DeepBook track description and the official DeepBook Predict docs. citeturn19view2turn20view3turn20view1

**Paste-ready DeepBook explanation**

PredictPilot is not a generic market UI layered on top of synthetic data. It is built specifically around DeepBook Predict’s protocol model on Sui Testnet: `Predict` as the market root, `PredictManager` as the reusable user trading account, `OracleSVI` as the live market state and settlement surface, and the shared vault/`PLP` model for liquidity. Our app uses the official Predict server for market and portfolio rendering, then moves into real PTB-based wallet execution for manager, trading, and LP flows.

### Final Sui integration explanation

This copy is aligned with official Sui PTB, wallet, and client docs. citeturn13search0turn24view1turn24view2turn24view3turn25view0

**Paste-ready Sui explanation**

PredictPilot uses Sui the way the protocol is meant to be used: wallet-connected programmable transaction blocks for execution, client-side transaction simulation and preview before signing, and post-transaction digest verification. Sui’s PTB model lets us compose market actions cleanly, while the wallet flow keeps signing user-controlled and the resulting digest gives judges an immediate way to confirm that the app executed a real onchain action.

### Final demo video outline

- Open PredictPilot and state the problem in one sentence.
- Show that the app is built for DeepBook Predict, not a generic market UI.
- Connect wallet on Sui Testnet.
- Show or discover the user’s PredictManager.
- Show oracle state, freshness, and ask bounds.
- Show DUSDC balance and manager funding state.
- Show risk preview and PTB preview for a real action.
- Execute one real Testnet action.
- Show the resulting transaction digest.
- Show updated portfolio/history state.
- If available, show vault/PLP flow or range flow.
- Close with why this fits the DeepBook specialized track.

### Final go or no-go checklist

**GO only if all are true**

- [ ] Track selected is **DeepBook**
- [ ] Repo is public and clean
- [ ] README is accurate
- [ ] Live app works
- [ ] Demo video is public
- [ ] At least one real Testnet digest is ready
- [ ] The app clearly uses DeepBook Predict, not generic mock data
- [ ] No secrets are exposed
- [ ] All high-impact `TODO VERIFY` items are resolved or clearly labeled
- [ ] Submission text does not overclaim

**NO-GO if any are true**

- [ ] Demo link is broken
- [ ] Package/object IDs are stale
- [ ] Claimed execution flow has no real proof
- [ ] Wallet/network path is flaky and unrehearsed
- [ ] README and product disagree
- [ ] Secrets are still in the repo
- [ ] You cannot answer “show me the digest” immediately

### Final submission sign-off

**Project:** PredictPilot  
**Target track:** DeepBook specialized track  
**Submission owner:** `TODO VERIFY`  
**Repository URL:** `TODO VERIFY`  
**Live app URL:** `TODO VERIFY`  
**Demo video URL:** `TODO VERIFY`  
**Final submitted commit SHA:** `TODO VERIFY`  
**Submission timestamp:** `TODO VERIFY`

- [ ] I verified the live deadline and form requirements on the official portal.
- [ ] I verified the final app against the official DeepBook Predict Testnet docs.
- [ ] I verified that all submission links are public and working.
- [ ] I verified that every claimed feature is either demonstrated or clearly labeled as future work.
- [ ] I verified that at least one real Testnet transaction digest is included in the proof set.
- [ ] I verified that no private keys, mnemonics, or secrets are in the repo or screenshots.

**Final decision:** `GO / NO-GO`