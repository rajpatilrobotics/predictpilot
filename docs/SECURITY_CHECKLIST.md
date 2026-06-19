# SECURITY_CHECKLIST.md

## Scope and security model

**Purpose.** This file is the security control baseline for PredictPilot, a DeepBook Predict intelligence and execution terminal built for Sui Overflow 2026. It exists to keep Codex and human contributors from shipping unsafe wallet UX, unsafe PTB flows, stale or unvalidated protocol reads, secret leaks, or fake “demo-only” execution paths disguised as real DeepBook Predict activity. DeepBook Predict is currently documented as a **Testnet** integration surface from the `predict-testnet-4-16` branch, and the docs explicitly warn that package IDs, object layouts, and entry points can change before Mainnet, so all protocol identifiers must remain configuration-driven and re-verifiable. citeturn7view0turn1search0

**Security goals.** PredictPilot must protect user signing intent, keep all private keys and secrets out of the frontend bundle and repo, validate all external data before use, show a transaction preview before wallet signature, show a transaction digest after execution, block or clearly warn on stale oracle conditions, and distinguish authoritative onchain reads from render-oriented server reads. Sui docs describe PTBs as the primary mechanism for composing multi-step transactions, and DeepBook Predict docs explicitly recommend a split between fast server reads for rendering and onchain reads around wallet flows that require authoritative state. citeturn11view0turn9view0

**Security non-goals.** This file is not a formal audit, does not claim protocol-level safety beyond official documentation, and does not authorize Codex to invent unverified package IDs, object IDs, API routes, move targets, oracle IDs, quote assets, or demo claims. Wherever the current public docs do not verify a detail, the correct marker is `TODO VERIFY`, not a guessed value. DeepBook Predict docs state that the current public integration target is provisional Testnet documentation. citeturn7view0

**Threat model.** The main threats for PredictPilot are unsafe wallet prompting, signing the wrong network or wrong package target, stale or manipulated Predict server data, unsafe consumption of external APIs, broken object-level authorization around manager and oracle IDs, unvalidated numeric inputs, XSS from untrusted text or HTML, dependency or CI supply-chain compromise, secret leakage through logs or env exposure, and judge/demo confusion caused by mock data being presented as real execution. OWASP identifies broken object-level authorization, broken authentication, unrestricted resource consumption, and unsafe API consumption as core API risks; React warns that untrusted HTML passed to `dangerouslySetInnerHTML` creates XSS risk. citeturn33view0turn23view0

**Assets to protect.**
- User wallet signing authority.
- User-controlled testnet assets, especially `DUSDC`, `PLP`, and manager-held balances.
- Predict transaction intent and preview correctness.
- Private keys, seed phrases, `.env.local`, `.env.test`, and any deployment secrets.
- Integrity of `PredictManager`, oracle, vault, and position/range reads.
- Transaction digests and explorer proof used in demos and submission materials.
- CI credentials, deployment tokens, and any backend-only environment variables.

**Trust boundaries.**
- **Trusted only after explicit user approval:** wallet signature step.
- **Trusted only after runtime validation:** Predict server responses, URL params, query params, browser storage, form input, and any analytics payload.
- **Authoritative for execution state:** Sui onchain reads and confirmed transaction effects.
- **Fast but non-authoritative for wallet-critical operations:** the public Predict server, which DeepBook docs recommend for render-ready markets, vault summaries, portfolio summaries, and history, while onchain reads are reserved for exact wallet flows. citeturn9view0

**Security assumptions.**
- PredictPilot is a non-custodial frontend: users sign with their own wallet; the app must never request a seed phrase or private key.
- The default/primary network is `testnet`, not `mainnet`.
- Testnet assets have no real monetary value, but leaked keys, misleading transaction UX, or unsafe signing behavior are still serious security failures.
- Testnet state can be wiped occasionally, so demo reliability must not depend on unrepeatable historical state. Sui docs state Testnet data is public, uses faucet-issued test assets, and may be wiped occasionally. citeturn23view9turn20search0

**Source trust hierarchy.**
1. Official Sui docs on DeepBook Predict contract information and design.
2. Official Sui docs on transactions, network configuration, wallet integration, and data access.
3. Mysten official SDK and dApp Kit docs.
4. Official OWASP, GitHub, React, Node, pnpm, Next.js, Playwright, Vitest, Zod, and Vercel docs.
5. Source files explicitly linked from official Sui docs to the DeepBook Predict repository.
6. Public server responses, which are useful but untrusted until validated.
7. Social posts, workshops, and third-party summaries, which may help discovery but are not source of truth.
8. Ignored entirely for source-of-truth purposes: previous autonomous-agent generated docs.  

**Severity labels.**
- `CRITICAL`: blocks demo and submission; could mislead signing intent, leak secrets, or fake execution.
- `HIGH`: blocks demo until mitigated; could cause loss of funds, wrong-network execution, stale-oracle trade, or incorrect protocol calls.
- `MEDIUM`: does not block all development, but weakens safety or trust.
- `LOW`: polish, hardening, or observability gap.

## Automated quality and security gates

PredictPilot uses layered checks instead of trusting one scanner for everything:
- SonarCloud checks reliability, maintainability, duplication, and security hotspot trends.
- GitHub CodeQL runs JavaScript/TypeScript code scanning with extended security queries.
- `pnpm audit --prod` checks production dependency advisories.
- Playwright accessibility smoke tests scan current terminal routes for serious or critical WCAG issues.
- Manual funded Testnet proof remains required because static tools cannot prove wallet signing, digest capture, or post-transaction state refresh.

**Status labels.**
- `OPEN`
- `IN_PROGRESS`
- `VERIFIED`
- `ACCEPTED_RISK`
- `NOT_REQUIRED_FOR_MVP`
- `REMOVED_FROM_SCOPE`

**Canonical verified DeepBook Predict Testnet values.** These current public integration values are documented by Sui and must live in config, not hardcoded across UI components. They are provisional and must be re-verified before demo and submission. citeturn7view0
- Network: `testnet`
- Public server: `https://predict-server.testnet.mystenlabs.com`
- Predict package: `0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138`
- Predict registry: `0x43af14fed5480c20ff77e2263d5f794c35b9fab7e2212903127062f4fe2a6e64`
- Predict object: `0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a`
- Current quote asset type: `0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC`
- Current quote asset currency ID: `0xf3000dff421833d4bb8ed58fac146d691a3aaba2785aa1989af65a7089ca3e9c`
- PLP coin type: `0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138::plp::PLP`
- `TODO VERIFY`: default oracle ID for demo
- `TODO VERIFY`: default market/oracle pair to feature in the judge flow

## Wallet and protocol execution controls

**User wallet security checklist.**
- [ ] Never ask users for a seed phrase, private key, or wallet backup file.
- [ ] Support only wallet-standard compatible wallets through official Sui dApp Kit integration.
- [ ] Treat wallet connection as a consented action, never as an automatic silent requirement.
- [ ] If a demo wallet exists, it must be separate from any personal wallet and funded only with Testnet assets.
- [ ] Never store wallet signatures, seed phrases, or raw private keys in local storage, session storage, IndexedDB, analytics, or logs.
- [ ] For any future higher-trust environment, recommend hardware signing where available; Sui docs note Ledger clear signing shows human-readable transaction details on-device. citeturn11view4

**Wallet connection security checklist.**
- [ ] Use official Sui dApp Kit as the default wallet connection layer.
- [ ] Configure the wallet/client layer with explicit network support rather than implicit defaults.
- [ ] Keep `enableBurnerWallet` disabled outside intentionally local-only development.
- [ ] Surface wallet address, current network, and connection state visibly in the UI.
- [ ] Require explicit reconnect after a full reset or logout.
- [ ] If `autoConnect` is used, the UI must still show the active wallet and network clearly before any actionable trade surface. Official dApp Kit docs state `createDAppKit` manages wallet connections and network configuration, while self-custody docs note Wallet Standard wallets are auto-detected by dApp Kit. citeturn11view3turn11view4

**Wrong network protection checklist.**
- [ ] Block all mint, redeem, supply, withdraw, and manager deposit/withdraw flows if the wallet is not on `testnet`.
- [ ] Show an explicit “Wrong network” blocker with the expected network and current network.
- [ ] Never let the user reach a signature prompt for a transaction targeting the wrong network.
- [ ] Keep the configured Sui RPC on Testnet by default: `https://fullnode.testnet.sui.io:443`.
- [ ] Treat network mismatches as `HIGH` severity during demo preparation. Sui docs define Testnet as the staging network and publish the Testnet RPC URL. citeturn23view9turn20search3

**Transaction signing safety checklist.**
- [ ] Every executable flow must present a pre-sign summary that includes action type, expected asset movement, selected manager, selected oracle/market, estimated cost/payout, and package/object IDs used.
- [ ] The preview must appear **before** the wallet signature step.
- [ ] The execution result must display the confirmed transaction digest **after** execution.
- [ ] Any failed signature must return a safe, user-readable error such as “wallet rejected request” without stack traces or secret-bearing metadata.
- [ ] Any failed chain execution must return a safe error state with retry guidance and a debug ID, not raw internal exceptions.
- [ ] If using wallet-standard transaction methods, prefer the flow that preserves app-side previewing and post-execution confirmation. Wallet Standard defines `sui:signTransaction` and `sui:signAndExecuteTransaction`, plus legacy equivalents. citeturn11view2

**PTB builder security checklist.**
- [ ] All DeepBook Predict write flows must be built from typed helpers in `src/integrations/deepbook-predict/tx/`, not inline `moveCall` strings scattered through React components.
- [ ] PTB builders must read package IDs and object IDs from config modules such as `src/config/deepbookPredict.ts` and `src/config/env.ts`.
- [ ] PTB helpers must reject missing or malformed package IDs, object IDs, manager IDs, oracle IDs, or coin types before any signature step.
- [ ] PTB helpers must be deterministic: same validated input should produce the same move target and coin selection intent.
- [ ] No UI component may construct raw move targets from string concatenation unless the target is verified and centralized.

**Transaction preview security checklist.**
- [ ] Binary previews must use verified protocol preview functions, specifically `get_trade_amounts()` before `mint()`/`redeem()`, when available in the chosen integration path. citeturn10view0
- [ ] Range previews must use `get_range_trade_amounts()` before `mint_range()`/`redeem_range()`. citeturn10view0
- [ ] Add a second preview layer using chain simulation when feasible. Sui GraphQL `simulateTransaction` previews effects without committing onchain or requiring signatures, and can estimate gas and validate logic before execution. citeturn23view7turn23view8
- [ ] Label all previews as estimates unless the value is directly authoritatively returned by the protocol and still fresh at the moment of signing.
- [ ] Include a visible preview timestamp and data source label: `Predict preview`, `simulation`, or `local estimate`.
- [ ] If preview source, timestamp, or oracle freshness is missing, block the action.

**Risk preview security checklist.**
- [ ] Show oracle lifecycle status, expiry, last update timestamp, and whether the quote is live or settled.
- [ ] Show ask-bound status for mint flows and clearly indicate if bounds are missing or stale.
- [ ] Show available-withdrawal status for LP withdrawal flows.
- [ ] Label all risk preview values as “estimate” until confirmed by authoritative onchain or protocol response.
- [ ] If the app cannot compute a trustworthy risk preview, it must disable the action rather than show guessed numbers.
- [ ] DeepBook Predict docs state that `OracleSVI` tracks lifecycle and timestamps, that mints require a live oracle, and that ask bounds plus total exposure checks protect pricing and vault risk. citeturn27view0turn9view0

**dUSDC asset handling security checklist.**
- [ ] Only accept the verified current quote asset type `0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC` unless a newer official deployment replaces it. citeturn7view0
- [ ] Verify the matching currency ID `0xf3000dff421833d4bb8ed58fac146d691a3aaba2785aa1989af65a7089ca3e9c` from config before deposit or flow initialization. citeturn7view0
- [ ] Block deposits, previews, or executions if the configured coin type does not match the verified allowlisted quote asset.
- [ ] Use exact decimal handling for a 6-decimal quote asset.
- [ ] `TODO VERIFY`: official DUSDC acquisition or request process for Predict demo wallets.

**PredictManager ownership security checklist.**
- [ ] Treat `PredictManager` as a per-user shared account that should be created once and reused.
- [ ] Verify that the active wallet is the owner of the selected manager before enabling deposit, withdraw, mint, redeem, or range actions.
- [ ] Never trust `manager_id` from a URL, query string, or local cache until ownership is re-validated.
- [ ] If manager ownership cannot be confirmed, block execution.
- [ ] Predict docs state that the manager wraps a DeepBook `BalanceManager`, stores quote balances, and positions/ranges are quantities inside the manager rather than standalone onchain objects. citeturn8view0turn9view0

**OracleSVI freshness security checklist.**
- [ ] Read oracle lifecycle status and last update timestamp before any trade action.
- [ ] Treat inactive, expired-but-unsettled-without-valid-quote, or otherwise stale oracle data as a blocker for mint flows.
- [ ] Distinguish price updates from SVI parameter updates.
- [ ] If the UI streams live oracle events, match them against the verified package ID and event names only.
- [ ] Verified live event names currently documented for low-latency oracle feeds are `oracle::OraclePricesUpdated`, `oracle::OracleSVIUpdated`, `oracle::OracleSettled`, and `oracle::OracleActivated`. citeturn7view0turn27view0

**Oracle stale data security checklist.**
- [ ] If the last update time exceeds a locally defined freshness threshold, show a blocking error or prominent warning depending on action type.
- [ ] For mints, stale oracle data should block by default.
- [ ] For redeems, stale data should at minimum warn, and if payout quoting depends on untrusted or stale state, block.
- [ ] Never silently fall back from live oracle data to cached UI numbers.

**Vault and PLP security checklist.**
- [ ] Surface that the vault takes the opposite side of every trade and tracks balance, liability, max payout, and settled exposure state. citeturn28view0turn9view0
- [ ] Show LP deposit and withdrawal previews before signature.
- [ ] Block withdrawal preview/execution if the app cannot retrieve authoritative available-withdrawal information.
- [ ] Treat `PLP` as the LP share token only; never present it as a stable asset or quote asset.
- [ ] Use the verified `PLP` coin type from config. citeturn7view0turn28view0

**Binary mint security checklist.**
- [ ] Only use verified function names from official docs: `mint()` for execution and `get_trade_amounts()` for preview. citeturn10view0
- [ ] Confirm manager ownership, accepted quote asset, and live oracle before enabling the action.
- [ ] Display the market key inputs: oracle, expiry, strike, direction.
- [ ] Do not allow zero, negative, NaN, or non-finite quantities.
- [ ] Require ask-bound status to be known and acceptable before signature.

**Binary redeem security checklist.**
- [ ] Use only verified function names: `redeem()` and, where applicable, `redeem_permissionless()` for settled positions. citeturn10view0
- [ ] Confirm the manager has sufficient position quantity before enabling redeem.
- [ ] If permissionless settled redeem is used, message clearly where the payout is deposited and whose manager is affected.
- [ ] Do not infer position quantities from UI cache alone; re-check manager state before sign.

**Range mint security checklist.**
- [ ] Use only verified preview/execution functions: `get_range_trade_amounts()` and `mint_range()`. citeturn10view0
- [ ] Enforce `lower_strike < higher_strike`; official docs state `RangeKey::new()` aborts if that relationship is violated. citeturn26view0
- [ ] Display lower and upper strikes explicitly in the preview.
- [ ] Reject degenerate, overlapping, or reversed inputs locally before any RPC call.

**Range redeem security checklist.**
- [ ] Use only verified function name `redeem_range()`. citeturn10view0
- [ ] Re-read manager range quantity before enabling redeem.
- [ ] Confirm the active wallet owns the manager being mutated.
- [ ] Preserve precise strike and quantity formatting in preview and confirmation.

**Vault supply security checklist.**
- [ ] Use only verified function name `supply()`. citeturn10view0
- [ ] Show estimated `PLP` minted, selected quote asset, and the source of the estimate.
- [ ] If vault state, vault value, or quote-asset acceptance cannot be verified, block supply.

**Vault withdraw security checklist.**
- [ ] Use only verified function name `withdraw()`. citeturn10view0
- [ ] Show requested `PLP` burn, expected quote asset, and availability after max payout coverage.
- [ ] If available-withdrawal data is missing, stale, or clearly lagging, block or require refresh.

**DeepBook Predict integration security checklist.**
- [ ] Use official docs and the current contract-information page as the only source of package IDs, object IDs, quote assets, server endpoints, and event names.
- [ ] Keep all package IDs, object IDs, coin types, and URLs in config modules.
- [ ] Do not hardcode verified values directly inside screens, hooks, or components.
- [ ] Re-verify all identifiers before demo and again before submission because the docs state the integration is provisional Testnet surface. citeturn7view0

**Sui client security checklist.**
- [ ] Prefer official Sui client abstractions through dApp Kit and the current SDK.
- [ ] Use transaction simulation or dev-inspect style preview where supported before sign.
- [ ] Await full transaction confirmation before invalidating caches or presenting success as final; Sui example docs note that follow-up indexed reads may need `waitForTransaction` before cache invalidation. citeturn25search9
- [ ] Keep Testnet RPC configurable.
- [ ] `TODO VERIFY`: if PredictPilot relies on a JSON-RPC path rather than GraphQL/gRPC abstractions, confirm the current SDK and network path are appropriate, because Sui docs note JSON-RPC deprecation on full nodes by July 2026. citeturn22search7

## Data, validation, and frontend controls

**API adapter security checklist.**
- [ ] Wrap every external endpoint behind explicit adapter functions in `src/integrations/deepbook-predict/`.
- [ ] Treat all Predict server responses as untrusted inputs.
- [ ] Build separate adapters for market state, oracle state, vault state, manager summary, positions summary, PnL, history, and trade feeds.
- [ ] Never let UI components call raw endpoint strings directly.

**Verified Predict server endpoints.** The official public server base URL is `https://predict-server.testnet.mystenlabs.com`, with documented render-oriented endpoints for protocol state, vault summaries, manager summaries, PnL, and history. Use only these verified routes unless a newer official doc replaces them. citeturn7view0
- Protocol and market state:
  - `GET /status`
  - `GET /predicts/:predict_id/state`
  - `GET /predicts/:predict_id/oracles`
  - `GET /oracles/:oracle_id/state`
  - `GET /predicts/:predict_id/quote-assets`
  - `GET /oracles/:oracle_id/ask-bounds`
- Vault and LP:
  - `GET /predicts/:predict_id/vault/summary`
  - `GET /predicts/:predict_id/vault/performance?range=ALL`
  - `GET /lp/supplies`
  - `GET /lp/withdrawals`
- Manager and portfolio:
  - `GET /managers`
  - `GET /managers/:manager_id/summary`
  - `GET /managers/:manager_id/positions/summary`
  - `GET /managers/:manager_id/pnl?range=ALL`
- History:
  - `GET /oracles/:oracle_id/prices`
  - `GET /oracles/:oracle_id/prices/latest`
  - `GET /oracles/:oracle_id/svi`
  - `GET /oracles/:oracle_id/svi/latest`
  - `GET /positions/minted`
  - `GET /positions/redeemed`
  - `GET /ranges/minted`
  - `GET /ranges/redeemed`
  - `GET /trades/:oracle_id`

**Predict server data validation checklist.**
- [ ] Validate every response with Zod before storing or rendering it.
- [ ] Reject extra or malformed numeric fields rather than coercing silently.
- [ ] Validate IDs as Sui-style hex strings and reject empty strings, `null`, or mixed-type values.
- [ ] Gate wallet-critical flows on authoritative onchain re-reads even when render data came from the server. DeepBook Predict docs explicitly say applications should render from the public server but read onchain `Predict`, `PredictManager`, `OracleSVI`, and quote coin objects around wallet flows that require authoritative state. citeturn9view0

**Runtime schema validation checklist.**
- [ ] Put schemas in `src/integrations/deepbook-predict/schemas.ts`.
- [ ] Use `safeParse()`/`safeParseAsync()` instead of throwing parse chains into UI code.
- [ ] Map parse failures to safe UI errors and telemetry counters.
- [ ] Store only validated objects in query cache or state stores. Zod docs recommend `.safeParse()` when handling untrusted data without try/catch control flow. citeturn23view2

**Zod validation checklist.**
- [ ] Define schemas for:
  - protocol state
  - oracle state
  - ask bounds
  - vault summary
  - manager summary
  - positions summary
  - PnL series
  - trade history rows
  - server status
  - config/env values
- [ ] Prefer discriminated unions for API variants.
- [ ] Fail closed for wallet-critical data.

**Input validation checklist.**
- [ ] Reject zero, negative, NaN, Infinity, empty-string, whitespace-only, and locale-broken numeric values.
- [ ] Restrict decimal precision to the asset’s supported decimals.
- [ ] Require explicit strike bounds and quantity for every trade.
- [ ] Require explicit manager selection if more than one manager is visible in the environment.
- [ ] Reject arbitrary object IDs pasted into action modals unless ownership/role checks pass.

**Numeric precision and rounding checklist.**
- [ ] Never use raw floating-point arithmetic for coin amounts or strike math that affects execution.
- [ ] Convert user-facing decimal input to integer base units in a dedicated utility layer.
- [ ] Keep one canonical formatting path for quotes and payouts.
- [ ] Round only at well-defined UI boundaries; internal arithmetic should preserve base-unit precision.
- [ ] For `DUSDC`, use 6-decimal handling from verified docs. citeturn7view0

**Slippage and ask-bounds checklist.**
- [ ] Fetch and display ask-bound status before mint actions.
- [ ] Do not present local UI price as executable unless it has been checked against protocol preview or simulation.
- [ ] If ask bounds are unavailable, mark execution unavailable.
- [ ] Use the official `/oracles/:oracle_id/ask-bounds` endpoint or authoritative onchain/config reads; do not derive bounds heuristically. Official docs state global and per-oracle ask bounds are part of Predict risk control. citeturn7view0turn9view0

**Portfolio and PnL security checklist.**
- [ ] Present portfolio and PnL as informational until backed by validated server or authoritative chain data.
- [ ] Do not let PnL numbers drive signing decisions without fresh preview data.
- [ ] Mark stale PnL/history data clearly.
- [ ] Never fabricate transaction digests or explorer proof from PnL server rows alone.

**Transaction history security checklist.**
- [ ] Link history entries to transaction digests whenever they are available.
- [ ] Distinguish “indexed history” from “confirmed execution proof.”
- [ ] Use exact, case-sensitive event type strings when querying events; Sui docs warn filter mismatches and wrong package IDs cause misleading empty results. citeturn25search4
- [ ] If the indexer lags, show a pending state rather than claiming absence of execution.

**Environment variable security checklist.**
- [ ] Keep public configuration in `NEXT_PUBLIC_*` variables only when it is safe for the browser to know.
- [ ] Never store secrets under `NEXT_PUBLIC_*`.
- [ ] Treat all non-public secrets as server-only.
- [ ] Put environment parsing and assertions in `src/config/env.ts`.
- [ ] Fail startup when required config is missing or malformed.
- [ ] Next.js docs state only variables prefixed with `NEXT_PUBLIC_` are exposed to the client/bundle; non-public variables remain server-only by default. citeturn30search0turn30search2

**Secrets handling checklist.**
- [ ] `.env.local`, `.env.test`, wallet backups, private keys, faucet credentials, browser auth state, and deployment secrets must be gitignored.
- [ ] If the project uses Next.js server utilities, mark secret-bearing modules with `server-only`.
- [ ] Never echo secrets in server responses, action payloads, console logs, or CI output.
- [ ] Maintain separate secrets for local, preview, and production deployments. Vercel supports per-environment variables and documents separate Development, Preview, and Production scopes. citeturn32view0

**Private key handling checklist.**
- [ ] Private keys may exist only in a local developer keystore or a temporary demo wallet that is not committed.
- [ ] If any script needs a private key for local test automation, it must read from environment only and never from source.
- [ ] Never print private keys, mnemonic phrases, or derived secret material.
- [ ] `TESTNET_PRIVATE_KEY` is for local-only automation and must never ship to client code.

**Testnet wallet security checklist.**
- [ ] Use a dedicated Testnet wallet address for development.
- [ ] Assume Testnet history is public.
- [ ] Do not mix personal assets or main wallet accounts into judge-demo flows.
- [ ] Refresh faucet funding in advance because public faucets are rate limited. Sui docs note Testnet SUI is free, has no real value, and faucet requests are rate limited. citeturn20search0turn24search6

**Demo wallet security checklist.**
- [ ] Use a clean dedicated demo wallet with only required Testnet assets.
- [ ] Pre-fund SUI gas and DUSDC before the demo.
- [ ] Keep a backup demo wallet and a backup browser profile ready.
- [ ] Record and verify one known-good transaction flow before demo day.

**Frontend security checklist.**
- [ ] No raw HTML rendering from Predict server or user content.
- [ ] Escape and sanitize any markdown or rich text if later added.
- [ ] Keep action buttons disabled until required authoritative data is loaded and validated.
- [ ] Use stable loading and error states so users do not sign blind due to jitter or race conditions.
- [ ] Use a deterministic disabled state for every missing prerequisite.

**React security checklist.**
- [ ] Do not use `dangerouslySetInnerHTML` with untrusted content.
- [ ] Avoid passing secret-bearing values through client components.
- [ ] Keep execution logic in hooks/services, not in markup-layer callbacks with implicit captures.
- [ ] React explicitly warns that untrusted `dangerouslySetInnerHTML` content risks XSS. citeturn23view0

**XSS prevention checklist.**
- [ ] No untrusted HTML insertion.
- [ ] No unsafe URL rendering from query params without validation.
- [ ] Prefer plain text rendering for API-provided metadata.
- [ ] If using Next.js, configure a CSP for deployed environments. Next.js docs state CSP helps guard against XSS, clickjacking, and code injection. citeturn11view8

## Dependencies, CI, and deployment controls

**Dependency security checklist.**
- [ ] Commit and review the lockfile.
- [ ] Avoid unnecessary packages for formatting, analytics, or wallet abstraction if the official Sui stack already covers the need.
- [ ] Run `pnpm audit` in CI and locally before demo locks.
- [ ] Review transitive dependency churn before updating large SDK or wallet packages. pnpm documents lockfiles and delayed updates as supply-chain protections, and `pnpm audit` checks installed packages for known issues. citeturn35view0turn4search18

**Package manager security checklist.**
- [ ] Use pnpm’s safer defaults rather than re-enabling all dependency build scripts.
- [ ] Do not enable `dangerouslyAllowAllBuilds` globally.
- [ ] Explicitly allow build scripts only for trusted packages when needed.
- [ ] Enable `blockExoticSubdeps` if compatible with the repo.
- [ ] Keep `minimumReleaseAge` non-zero unless there is a deliberate exception.
- [ ] pnpm documents that v10 disables automatic dependency `postinstall` execution by default, recommends explicit allowlists for trusted build scripts, supports blocking exotic transitive sources, and defaults v11 `minimumReleaseAge` to one day. citeturn35view0

**Build pipeline security checklist.**
- [ ] Separate lint, typecheck, unit, integration, PTB, and E2E jobs.
- [ ] Do not pass production secrets into pull-request workflows.
- [ ] Keep preview builds using preview-safe env only.
- [ ] Fail CI on missing env schema validation, not only on compile errors.

**GitHub Actions security checklist.**
- [ ] Use least-privilege `GITHUB_TOKEN` permissions.
- [ ] Pin third-party actions to full-length commit SHAs.
- [ ] Audit third-party actions before adoption.
- [ ] Use `CODEOWNERS` to require review on `.github/workflows/**`.
- [ ] Prefer OIDC over long-lived cloud secrets where deployment platform supports it.
- [ ] GitHub docs call full-length commit SHA pinning the only immutable release form for actions and recommend auditing third-party actions; GitHub also documents OIDC as a replacement for cloud-provider secrets in workflows. citeturn31view1turn23view6

**Deployment security checklist.**
- [ ] Keep deployment target limited to preview/testnet usage for the hackathon unless explicitly upgraded later.
- [ ] Separate local, preview, and production configs.
- [ ] Ensure old preview deployments are not mistakenly used as the live judge link after secret rotation or config changes.
- [ ] If a custom backend or edge route is added, review rate limits, timeouts, and request validation.

**Vercel security checklist.**
- [ ] Store secrets in Vercel environment variables, not in the repo.
- [ ] Use sensitive environment variables for preview/production where possible.
- [ ] Remember env changes apply only to **new deployments**; redeploy after secret changes.
- [ ] Rotate keys by updating Vercel first, redeploying, verifying, and only then revoking the old credential.
- [ ] Vercel docs state env variables are encrypted at rest, sensitive variables are non-readable once created in preview/production, and secret rotation requires updating the project and redeploying before invalidating old credentials. citeturn32view0turn11view9turn32view1

**Logging and analytics security checklist.**
- [ ] Never log private keys, seed phrases, signed transaction bytes, bearer tokens, or server-only env values.
- [ ] Never log more protocol/account data than needed to debug.
- [ ] Mask wallet addresses partially in analytics unless full address logging is explicitly justified.
- [ ] Record errors using safe structured categories, not raw thrown objects.

**Error message security checklist.**
- [ ] UI errors must be useful but non-sensitive.
- [ ] Server or action errors must not reveal stack traces in production builds.
- [ ] Distinguish validation errors, wallet rejection, network mismatch, oracle stale, simulation failure, and onchain execution failure with safe messages.
- [ ] Keep a debug identifier for dev tooling without exposing secret context.

**Mock data security checklist.**
- [ ] Mocks are allowed only for tests, empty/loading fallback UI, and explicitly labeled offline local demos.
- [ ] Mocks are never allowed as the primary judge proof for PredictPilot.
- [ ] Any mocked screen must be visually labeled `Mock data` or `Offline fallback`.
- [ ] If a screen is mixed-source, label exactly which panels are live and which are mock.
- [ ] Never present a mock transaction digest, mock Sui Explorer view, or fabricated wallet execution as real.

**Demo mode security checklist.**
- [ ] Demo mode must be opt-in and visibly labeled.
- [ ] Demo mode must disable or isolate real write actions by default unless explicitly configured for a live demo wallet flow.
- [ ] Demo mode must never reuse production or personal credentials.
- [ ] If demo mode hides a temporary outage, it must preserve a clear “not live” label.

## PP-057 MVP client hardening

**Implemented client guards.**
- `src/lib/security.ts` time-boxes pre-sign transaction previews and blocks wallet signature requests when the preview is missing, stale, not simulation-ready, or not in the ready phase.
- Shared trade execution flow state uses a synchronous operation lock so repeated clicks cannot start overlapping review, simulation, or wallet-signature requests before React state settles.
- Guard failures return sanitized `PredictPilotError` objects and never include raw PTBs, wallet objects, private keys, seed phrases, signed payloads, or unbounded external data.

**Remaining manual security proof.**
- The client still never handles private keys or seed phrases directly; wallet signing remains delegated to Sui dApp Kit and Wallet Standard wallets.
- Funded Testnet smoke proof is still required before final submission to verify live digest-backed execution and post-transaction refresh against current DeepBook Predict deployment state.

## Testing, demo, and submission verification

**Recommended implementation targets.**
- `src/config/env.ts`
- `src/config/deepbookPredict.ts`
- `src/integrations/deepbook-predict/config.ts`
- `src/integrations/deepbook-predict/schemas.ts`
- `src/integrations/deepbook-predict/errors.ts`
- `src/integrations/deepbook-predict/tx/*`
- `src/lib/security.ts`
- `src/lib/validation/*`
- `src/tests/unit/security.test.ts`
- `src/tests/unit/trade-execution-security.test.tsx`
- `e2e/security.spec.ts`
- `.env.example`
- `.gitignore`
- `.github/workflows/ci.yml`

**Recommended security test files.**
- `src/tests/security/env.test.ts`
- `src/tests/security/config.test.ts`
- `src/tests/security/predict-schemas.test.ts`
- `src/tests/security/tx-preview.test.ts`
- `src/tests/security/oracle-freshness.test.ts`
- `src/tests/security/manager-ownership.test.ts`
- `src/tests/security/range-inputs.test.ts`
- `src/tests/security/error-redaction.test.ts`
- `e2e/security.spec.ts`

**Test security checklist.**
- [ ] Unit tests must verify validation, parsing, formatting, env gating, and range/bounds logic.
- [ ] Integration tests must verify adapter/schema handling, stale oracle blocking, config-driven IDs, and PTB helper failures on missing config.
- [ ] PTB tests must verify package/object/coin/config guards before transaction bytes are produced.
- [ ] Browser-facing tests must verify only visible user behavior, not internal implementation trivia. Playwright best practices emphasize testing user-visible behavior and keeping tests isolated. citeturn23view4

**E2E test security checklist.**
- [ ] If authentication state is cached for Playwright, store it under `playwright/.auth` and gitignore it.
- [ ] Reuse auth state only for automation where it is safe and clearly isolated from personal wallets.
- [ ] Keep each E2E test isolated from the prior one.
- [ ] If network mocking is used in E2E, reserve it for negative-path or UI-only tests; live execution proof must be tested separately.
- [ ] Playwright docs recommend isolated browser contexts and gitignoring persisted auth state. citeturn23view3turn23view4

**Vitest security checklist.**
- [ ] Restore or reset mocks between tests.
- [ ] If `import.meta.env` is mocked, reset it manually or enable `unstubEnvs`.
- [ ] Avoid test pollution across suites.
- [ ] Vitest docs warn mocks and env stubs do not reset automatically unless configured/reset explicitly. citeturn34view0

**Required security test scenarios.**
- [ ] App blocks execution on wrong network.
- [ ] App blocks mint when oracle data is stale.
- [ ] App blocks mint when ask bounds are invalid or missing.
- [ ] App blocks deposit when `DUSDC` coin type is not verified.
- [ ] App blocks transaction when Predict package ID is missing.
- [ ] App blocks transaction when Predict object ID is missing.
- [ ] App blocks transaction when PredictManager owner does not match wallet.
- [ ] App shows PTB preview before wallet signing.
- [ ] App shows transaction digest after execution.
- [ ] App handles failed wallet signature safely.
- [ ] App handles failed transaction safely.
- [ ] App handles Predict server failure safely.
- [ ] App validates API responses with Zod.
- [ ] App prevents unsafe numeric input.
- [ ] App prevents negative or zero trade amounts where invalid.
- [ ] App prevents unsafe range inputs.
- [ ] App never logs private keys.
- [ ] App never exposes secret environment variables in frontend.
- [ ] App never commits `.env.local`.
- [ ] App never treats mock data as real testnet proof.

**Manual QA security checklist.**
- [ ] Verify active network is Testnet.
- [ ] Verify visible package/object/coin configuration values match the current official config.
- [ ] Verify preview source and preview timestamp appear before sign.
- [ ] Verify command is blocked cleanly on missing/stale oracle.
- [ ] Verify manager owner mismatch is blocked.
- [ ] Verify digest appears after successful transaction.
- [ ] Verify explorer/open-proof link works for the digest.
- [ ] Verify manual refresh after execution rehydrates state cleanly.
- [ ] For hard failures, capture digest or failure ID and use Sui replay/debug tools if needed; Sui docs provide `sui replay --digest <TX_DIGEST>` for local re-execution of past onchain transactions. citeturn25search1turn25search3

**Pre-demo security checklist.**
- [ ] Re-verify the official DeepBook Predict Testnet package ID, registry ID, object ID, quote asset, and PLP type.
- [ ] Verify Predict server health with `GET /status`.
- [ ] Verify demo wallet balance for SUI gas and DUSDC.
- [ ] Run live smoke test for manager create/deposit/preview at minimum.
- [ ] Run at least one end-to-end execution flow and capture digest proof.
- [ ] Confirm demo browser profile has only the intended wallet extension and account active.
- [ ] Confirm no local mock flag is enabled in the demo build unless explicitly labeled.

**Pre-submission security checklist.**
- [ ] Search the repo for `PRIVATE_KEY`, `MNEMONIC`, `SECRET`, `.env.local`, `.env.test`, and known wallet backup strings.
- [ ] Verify `.gitignore` covers local env files and auth state folders.
- [ ] Verify all `TODO VERIFY` items affecting security are resolved or explicitly disclosed.
- [ ] Verify the README and demo script do not overclaim live execution if any screen is mocked.
- [ ] Verify at least one digest-backed live testnet flow is reproducible on the submission build.

## Codex guardrails and sign-off

**Common security mistakes Codex must avoid.**
- Do not invent DeepBook Predict package IDs, object IDs, oracle IDs, function names, quote assets, or endpoints.
- Do not hardcode protocol IDs into UI components.
- Do not put secrets in client code or `NEXT_PUBLIC_*`.
- Do not treat server data as authoritative for wallet-critical flows without onchain confirmation.
- Do not replace real failure handling with silent fallbacks that make the app look successful.
- Do not commit `.env.local`, `.env.test`, `playwright/.auth`, keystores, or local wallet exports.
- Do not ship a “success” state without transaction digest proof.

**Common DeepBook Predict integration mistakes Codex must avoid.**
- Building a generic prediction-market UI that ignores `PredictManager`, `OracleSVI`, `Vault`, and `PLP`.
- Treating positions or ranges as standalone owned objects instead of internal manager quantities.
- Allowing mints without a live oracle.
- Ignoring ask bounds or vault exposure-related availability.
- Using unverified oracle IDs or market IDs.
- Calling unverified move targets or stale package deployments.
- Using mock pricing instead of `get_trade_amounts()` / `get_range_trade_amounts()` and/or transaction simulation. Official docs verify the major Predict functions and the manager/oracle/vault model. citeturn10view0turn8view0turn27view0turn28view0

**Common Sui PTB mistakes Codex must avoid.**
- Asking the wallet to sign before the user has seen a preview.
- Building PTBs from raw string concatenation in components.
- Forgetting network guards.
- Executing with missing config-driven IDs.
- Trusting stale cached objects after a previous transaction without waiting for confirmation.
- Assuming simulation guarantees identical live execution under stale inputs.

**Common wallet mistakes Codex must avoid.**
- Showing a connected wallet without showing the active network.
- Using a personal browser profile for judge demos.
- Triggering hidden or repeated wallet prompts.
- Interpreting user rejection as app success.
- Mixing demo wallet logic with live wallet logic.
- Depending on extension-specific behavior when Wallet Standard/dApp Kit already provides interoperable methods. Sui docs state dApp Kit automatically detects Wallet Standard wallets and Wallet Standard defines current and legacy signing features. citeturn11view4turn11view2

**Security acceptance criteria.**
- [ ] No write action is possible on the wrong network.
- [ ] No write action is possible without validated package/object/coin config.
- [ ] No mint action is possible with stale or missing oracle state.
- [ ] No manager mutation is possible without owner verification.
- [ ] Every external response used for logic is validated at runtime.
- [ ] Every execution-capable action shows a preview before sign.
- [ ] Every successful execution shows a digest after execution.
- [ ] No secret appears in the frontend bundle, repo, or logs.
- [ ] No mocked data is presented as real testnet proof.
- [ ] The demo can reproduce at least one live digest-backed DeepBook Predict flow on Testnet.

**Security sign-off checklist.**
- [ ] Config values re-verified against official DeepBook Predict docs.
- [ ] Env schema passes locally and in CI.
- [ ] Dependency audit reviewed.
- [ ] Security tests green.
- [ ] Live smoke flow green on Testnet.
- [ ] Demo wallet prepared and isolated.
- [ ] README/demo script accurately disclose live vs mock state.
- [ ] Submission assets include digest-backed execution proof.
- [ ] Remaining accepted risks documented in `KNOWN_ISSUES_AND_TODO_VERIFY.md`.

**Final security checklist.**
- [ ] PredictPilot uses config-driven, officially verified DeepBook Predict Testnet identifiers only. citeturn7view0
- [ ] PredictPilot uses official Sui wallet/dApp Kit integration patterns and Testnet network guards. citeturn11view3turn11view4turn23view9
- [ ] PredictPilot previews transactions with official protocol preview functions and/or simulation before sign. citeturn10view0turn23view7
- [ ] PredictPilot re-checks authoritative onchain state around wallet-critical flows. citeturn9view0
- [ ] PredictPilot validates Predict server responses with Zod and treats external APIs as untrusted. citeturn33view0turn23view2
- [ ] PredictPilot blocks risky execution on stale oracle, wrong network, bad manager ownership, or missing config. citeturn27view0turn9view0
- [ ] PredictPilot never commits or exposes secrets, auth state, or private keys. citeturn30search0turn30search2turn23view3turn11view9
- [ ] PredictPilot hardens CI and deployments with pinned GitHub Actions, least privilege, and safe secret handling. citeturn31view1turn23view6turn32view1
- [ ] PredictPilot keeps mocks clearly labeled and never uses them as the main hackathon proof.
- [ ] PredictPilot is ready for a safe, truthful, digest-backed hackathon demo.
