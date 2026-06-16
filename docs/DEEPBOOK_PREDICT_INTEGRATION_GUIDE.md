# DeepBook Predict Integration Guide

This document defines the practical integration plan for PredictPilot’s DeepBook Predict layer on Sui Testnet. It is grounded in the official DeepBook Predict docs, the official Sui docs and SDK docs, and the `predict-testnet-4-16` source branch that the public docs explicitly pin as the current Testnet integration target. DeepBook Predict is currently documented as a **Testnet integration surface** whose package IDs, object layouts, and entry points can change before Mainnet, so every ID in this guide must live in config and must be re-verified before demo day and submission. `TODO VERIFY`: the uploaded file `Sui hack-2026(4).md` was referenced by the user but was not retrievable in this session, so this guide is based on official public sources only. citeturn21view0turn24view0

## Verified context and required configuration

**Integration overview.** DeepBook Predict is not a generic prediction-market frontend. The protocol centers on a shared `Predict` object, a per-user shared `PredictManager`, `OracleSVI` market objects, and a shared `Vault` that takes the opposite side of every trade. Official docs recommend a three-layer integration model: use the **public Predict server** for render-ready market, vault, portfolio, and history data; use **Sui events / checkpoint streaming** for lower-latency oracle updates; and use **direct onchain reads** around wallet flows that need confirmation-critical state. PredictPilot should follow that exact split. citeturn45view0turn21view1

**Integration goals.** For PredictPilot, the goal is to ship a real DeepBook-track execution terminal for Sui Overflow 2026, not a mock UI. The hackathon site describes the DeepBook specialized track as building trading or liquidity applications powered by DeepBook’s onchain orderbook, and the DeepBook specialized pool is listed on the official Overflow site. That means the integration must prove real Testnet execution for `PredictManager` creation, DUSDC deposit and withdrawal, binary mint and redeem, range mint and redeem, and LP supply and withdraw. citeturn32view0turn45view1

**Integration non-goals.** Do **not** build admin flows like registry setup, quote-asset allowlist management, oracle-cap creation, or oracle updates. Those are protocol-operator surfaces, not consumer dApp flows. Do **not** build the primary UI around raw chain scans. Do **not** assume Mainnet compatibility. Do **not** model positions as standalone wallet-owned objects. Docs explicitly state that positions and ranges live inside `PredictManager` tables keyed by `MarketKey` and `RangeKey`. citeturn21view1turn45view0turn8view3

**Required official sources.** The minimum source set for implementation is: DeepBook Predict overview, design, contract information, the `Predict`, `PredictManager`, `Oracle`, `Vault`, `Registry`, `MarketKey`, and `RangeKey` docs; the `predict-testnet-4-16` repository branch; Sui PTB docs; Sui TypeScript SDK docs; Sui dApp Kit docs; Sui Wallet Standard docs; and Sui object-ownership docs. Prefer these sources over blogs or third-party SDK wrappers. citeturn24view0turn40view0turn40view1turn44view2

**Verified deployment configuration.** Put every one of these values in `src/integrations/deepbook-predict/config.ts` and expose them through validated runtime config. Never hardcode them inside components. The official contract-information page currently lists the following Testnet deployment targets:

```ts
// PredictPilot local application config
export const DEEPBOOK_PREDICT = {
  network: 'testnet',
  walletChain: 'sui:testnet',
  grpcUrl: 'https://fullnode.testnet.sui.io:443',
  serverUrl: 'https://predict-server.testnet.mystenlabs.com',
  packageId: '0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138',
  registryId: '0x43af14fed5480c20ff77e2263d5f794c35b9fab7e2212903127062f4fe2a6e64',
  predictObjectId: '0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a',
  dusdcType: '0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC',
  dusdcCurrencyId: '0xf3000dff421833d4bb8ed58fac146d691a3aaba2785aa1989af65a7089ca3e9c',
  plpType: '0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138::plp::PLP',
  sourceBranch: 'predict-testnet-4-16',
} as const;
```

The package ID, registry ID, Predict object ID, server URL, DUSDC type, DUSDC currency ID, and PLP type are all explicitly published in the official Testnet contract-information page. The wallet chain string `sui:testnet` is published by the official Wallet Standard typedoc. citeturn24view0turn46view0

**Quote-asset, DUSDC, and PLP configuration.** The docs say the **current accepted quote asset** is the DeepBook Test USDC type above, with **6 decimals**, and the `Vault` source explicitly documents that quantities are tracked in quote units where `1_000_000 = 1 contract = $1 at settlement`. `PLP` is currently the coin type shown above, and the source initializes `PLP` as a 6-decimal currency. PredictPilot should therefore treat DUSDC balances, PLP balances, trade quantities, and quote-denominated PnL as fixed-precision 6-decimal values. citeturn24view0turn22view2turn23view0

**Required environment variables.** If the repo uses Vite, use `VITE_` prefixes. If it uses Next.js, mirror them with `NEXT_PUBLIC_`. Minimum variables:

```bash
VITE_SUI_NETWORK=testnet
VITE_SUI_WALLET_CHAIN=sui:testnet
VITE_SUI_GRPC_URL=https://fullnode.testnet.sui.io:443
VITE_DEEPBOOK_PREDICT_SERVER_URL=https://predict-server.testnet.mystenlabs.com
VITE_DEEPBOOK_PREDICT_PACKAGE_ID=0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138
VITE_DEEPBOOK_PREDICT_REGISTRY_ID=0x43af14fed5480c20ff77e2263d5f794c35b9fab7e2212903127062f4fe2a6e64
VITE_DEEPBOOK_PREDICT_OBJECT_ID=0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a
VITE_DEEPBOOK_PREDICT_DUSDC_TYPE=0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC
VITE_DEEPBOOK_PREDICT_DUSDC_CURRENCY_ID=0xf3000dff421833d4bb8ed58fac146d691a3aaba2785aa1989af65a7089ca3e9c
VITE_DEEPBOOK_PREDICT_PLP_TYPE=0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138::plp::PLP
```

These identifiers are all official Testnet integration targets and are explicitly temporary. citeturn24view0turn21view0

**Testnet setup.** Builders need Testnet SUI for gas and DeepBook Predict test assets for execution. The official Sui docs point builders to the Testnet faucet for SUI, and the DeepBook Predict overview explicitly says builders can request Testnet assets including DUSDC through the official DeepBook Predict Testnet token request form. citeturn9search11turn21view0

## Client setup, adapters, and repository layout

**Wallet setup.** Use the current official React dApp Kit packages, not the legacy JSON-RPC package family. The official React guide uses `@mysten/dapp-kit-react`, `createDAppKit`, `DAppKitProvider`, `ConnectButton`, `useCurrentAccount`, and `useDAppKit`, and it builds a `SuiGrpcClient` against Testnet. The broader wallet docs say Sui dApp Kit is the official SDK for Sui apps and that any wallet implementing the Wallet Standard is auto-detected without wallet-specific integration code. citeturn40view0turn12view0turn12view1

**Sui client setup.** Instantiate `SuiGrpcClient` against `https://fullnode.testnet.sui.io:443`. Mysten’s TypeScript SDK docs describe gRPC as the recommended client path, and the Core API docs recommend writing SDK-like adapters against `ClientWithCoreApi` so the integration layer stays transport-agnostic. PredictPilot should therefore instantiate `SuiGrpcClient` in app setup, but type its adapter interfaces against `ClientWithCoreApi`. citeturn15search0turn40view2turn40view3

**Predict server client setup.** The official server base URL is the Testnet server above, and the official endpoint catalog includes protocol state, oracle state, ask bounds, vault summary, vault performance, LP history, manager summary, manager positions summary, manager PnL, price history, SVI history, position history, range history, and trade history endpoints. Build a thin typed REST client in `src/integrations/deepbook-predict/api.ts` and treat it as the default source for render-ready pages. citeturn24view0turn21view1

A good first-pass local adapter surface is:

```ts
// PredictPilot local application API surface
export interface PredictApi {
  getStatus(): Promise<unknown>;
  getPredictState(predictId: string): Promise<unknown>;
  getOracles(predictId: string): Promise<unknown>;
  getOracleState(oracleId: string): Promise<unknown>;
  getOracleAskBounds(oracleId: string): Promise<unknown>;
  getQuoteAssets(predictId: string): Promise<unknown>;
  getVaultSummary(predictId: string): Promise<unknown>;
  getVaultPerformance(predictId: string, range: 'ALL'): Promise<unknown>;
  listManagers(): Promise<unknown>;
  getManagerSummary(managerId: string): Promise<unknown>;
  getManagerPositionsSummary(managerId: string): Promise<unknown>;
  getManagerPnl(managerId: string, range: 'ALL'): Promise<unknown>;
  getOraclePrices(oracleId: string): Promise<unknown>;
  getOracleLatestPrice(oracleId: string): Promise<unknown>;
  getOracleSvi(oracleId: string): Promise<unknown>;
  getOracleLatestSvi(oracleId: string): Promise<unknown>;
  getPositionMints(): Promise<unknown>;
  getPositionRedeems(): Promise<unknown>;
  getRangeMints(): Promise<unknown>;
  getRangeRedeems(): Promise<unknown>;
  getOracleTrades(oracleId: string): Promise<unknown>;
}
```

That endpoint list is directly published by the official contract-information page. `TODO VERIFY`: the exact response schemas and any undocumented query parameters were not published in the doc pages reviewed here, so all response decoding should sit behind Zod schemas and fail soft. citeturn24view0

**Onchain read adapter setup.** Put direct chain reads in `src/integrations/deepbook-predict/reads.ts`. This adapter should only own things that must come from chain authority: object existence validation, package/object ID sanity checks, wallet-critical post-transaction confirmation, and optional read-only trade-preview calls into protocol preview functions. The official integration model explicitly says the primary UI should not be built around raw chain scans. citeturn21view1turn45view0

**Data-freshness strategy.** The `OracleSVI` source states that spot/forward price data updates at high frequency of roughly one second, while SVI parameter updates happen at lower frequency of roughly ten to twenty seconds. Combined with the official guidance to use the public Predict server for page rendering and Sui event / checkpoint streaming only when second-level freshness is needed, the correct MVP strategy is: server-first for all lists and detail pages, event-stream or short polling only on the active oracle detail pane, and onchain confirmation reads immediately after transaction success. citeturn8view2turn21view1turn45view0

**Codegen recommendation.** Use `@mysten/codegen` and generate bindings **directly from the onchain Predict package ID**. Official codegen docs explicitly support onchain package generation from a package ID on a target network, and they generate type-safe Move-call wrappers plus BCS types. This is the safest way to avoid broken `MarketKey` / `RangeKey` serialization and incorrect target strings. citeturn40view1turn41view0

```ts
// LOCAL APPLICATION CODE — recommended
import type { SuiCodegenConfig } from '@mysten/codegen';

const config: SuiCodegenConfig = {
  output: './src/generated',
  packages: [
    {
      package: '0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138',
      packageName: 'deepbook-predict',
      network: 'testnet',
      generate: {
        modules: ['predict', 'predict_manager', 'market_key', 'range_key', 'oracle', 'plp'],
        types: true,
        functions: true,
      },
    },
  ],
};

export default config;
```

This follows the official codegen model for onchain packages. `TODO VERIFY`: codegen is still documented as in-development with potential breaking changes, so pin the package version and commit generated output into the repo for hackathon stability. citeturn40view1turn41view0

**Repository and module structure.** Keep the user-requested integration layer and add one generated-code directory. Recommended final layout:

```text
src/
  generated/
    deepbook-predict/              # codegen output
  integrations/
    deepbook-predict/
      config.ts
      client.ts
      api.ts
      schemas.ts
      types.ts
      mappers.ts
      reads.ts
      errors.ts
      queryKeys.ts
      hooks.ts
      index.ts
      tx/
        createManager.ts
        deposit.ts
        withdraw.ts
        mintBinary.ts
        redeemBinary.ts
        mintRange.ts
        redeemRange.ts
        supplyVault.ts
        withdrawVault.ts
```

**Recommended local function names.** Use `buildCreateManagerTx`, `buildDepositToManagerTx`, `buildWithdrawFromManagerTx`, `buildMintBinaryTx`, `buildRedeemBinaryTx`, `buildMintRangeTx`, `buildRedeemRangeTx`, `buildSupplyVaultTx`, `buildWithdrawVaultTx`, `resolveManagerIdForAddress`, `fetchOracleCatalog`, `fetchOracleState`, `fetchVaultSummary`, `fetchPortfolioSummary`, and `refreshAfterPredictDigest`. These are local names, not protocol names.

## Read paths, discovery, and indexed data usage

**Manager discovery strategy.** `PredictManager` is a **shared object**, and the source creates it with `transfer::share_object`. Sui’s ownership docs explain that shared objects are consensus objects accessible to any address subject to Move checks, not address-owned fastpath objects. That means `getOwnedObjects(address)` is **not** a reliable discovery path for a user’s manager; this is a critical integration gotcha. The safest strategy is: persist `managerId` locally after confirmed creation, validate it on reconnect, use the Predict server’s manager surfaces as the default source for summaries, and keep `PredictManagerCreated` event indexing as a fallback recovery path. The protocol emits `PredictManagerCreated { manager_id, owner }`, which is the canonical event to recover from lost local state. This conclusion about discovery is an implementation inference from the officially documented shared-object model and the published manager source. citeturn37view2turn44view2turn44view0

**PredictManager creation flow.** The official `Predict` docs say `create_manager()` creates a new shared `PredictManager` for the caller and returns its object ID, and the source confirms the target is `predict::create_manager`. After execution, persist the resulting manager ID only after transaction confirmation, ideally by reading the emitted `PredictManagerCreated` event or the transaction’s object-change surface. `TODO VERIFY`: the exact transaction-result method name to fetch events in the installed SDK version. citeturn45view1turn36view0turn37view2

**dUSDC wallet balance flow.** For wallet-origin DUSDC, prefer the SDK’s `tx.coin({ balance, type })` path instead of manually selecting and splitting coin objects. The official PTB docs show that `tx.coin()` can produce a `Coin<T>` object for non-SUI tokens, including arbitrary coin types, and that PTBs are atomic composable command sequences. PredictPilot should still show a wallet DUSDC balance in the UI, but coin-object management should live inside transaction builders, not components. citeturn43view0turn43view2

**Manager DUSDC balance flow.** Onchain, `PredictManager` exposes a public generic balance function and deposit / withdraw functions on the wrapped DeepBook balance manager. For rendering, prefer `/managers/:manager_id/summary`; for transaction-critical checks, use a post-transaction refresh plus optional onchain validation if you later implement read-only function calls. Avoid parsing the manager tables manually in the MVP unless the server is unavailable. citeturn37view4turn37view0turn24view0

**Oracle discovery flow.** Use `GET /predicts/:predict_id/oracles` as the default oracle catalog source, not raw chain scans. Every market row in PredictPilot should be rooted in an oracle ID from that endpoint, then expanded with `GET /oracles/:oracle_id/state` and `GET /oracles/:oracle_id/ask-bounds` on demand. citeturn24view0turn21view1

**OracleSVI state read flow.** The official design says one `OracleSVI` exists per underlying-plus-expiry market and stores spot, forward, SVI parameters, activation status, timestamps, and settlement price. The source confirms that oracle lifecycle states are inferred as inactive, active, pending settlement, and settled, and that `settlement_price()` becomes populated on settlement. PredictPilot should therefore normalize every oracle into a local state model with `oracleId`, `underlying`, `expiryMs`, `active`, `settled`, `spot`, `forward`, `svi`, `timestampMs`, and optional `settlementPrice`. citeturn45view0turn38view3turn38view4turn38view5turn38view6

**Ask-bounds read flow.** The contract-information docs expose `GET /oracles/:oracle_id/ask-bounds`, and the `Predict` source publishes `ask_bounds(predict, oracle_id)` as the resolved onchain ask-price bounds read after combining global and per-oracle constraints. For UI, use the server endpoint. For authoritative pre-sign preview, use the onchain `predict::ask_bounds` path through a read-only simulation layer when available. citeturn24view0turn35view4turn45view0

**Binary market read flow.** Official docs say binary positions are keyed by `(oracle_id, expiry, strike, is_up)` and that the preview function for them is `get_trade_amounts()`, which returns `(mint_cost, redeem_payout)`. The `MarketKey` source verifies the helper constructors `up`, `down`, and `new`. PredictPilot should always render binary actions in terms of **UP** vs **DOWN**, not in terms of separate custom instruments. citeturn45view0turn36view0turn22view0

**Vertical range market read flow.** Official docs say range positions are keyed by `(oracle_id, expiry, lower_strike, higher_strike)` and that a range pays if settlement lands in `(lower, higher]`. The `RangeKey` source confirms that direction is **not** part of the canonical key and that `lower_strike < higher_strike` is enforced. PredictPilot must therefore not invent separate “bull” and “bear” range instrument IDs in app state; the canonical instrument is just the band. citeturn45view0turn22view1turn34view4

**Vault summary flow.** Use `GET /predicts/:predict_id/vault/summary` for render-ready vault state and `GET /predicts/:predict_id/vault/performance?range=ALL` for the MVP chart. The official design says the vault stores accepted quote assets, concrete balances, mark-to-market liability, max payout, and compact settled-oracle state. citeturn24view0turn45view0turn22view2

**PLP balance flow.** `PLP` is the LP share token for the Predict vault. The protocol mints `PLP` on supply and burns it on withdraw, and the current `PLP` type is published in the contract-information page. PredictPilot should show wallet-held `PLP` as a normal Sui fungible-token balance and use server vault summary data for contextual valuation. citeturn24view0turn23view0turn36view1

**Portfolio summary flow.** Use `GET /managers/:manager_id/summary` and `GET /managers/:manager_id/positions/summary` as the default portfolio surfaces. The design docs explicitly advise applications to read position quantities from the manager or the indexed server, because positions and ranges are **not standalone objects**. citeturn24view0turn45view0

**PnL read flow.** Use `GET /managers/:manager_id/pnl?range=ALL` for the MVP. Treat the server as the canonical PnL renderer and do not attempt to recreate protocol PnL client-side from sparse history. citeturn24view0turn21view1

**Transaction-history flow.** The official server exposes global history endpoints for position mints, position redeems, range mints, range redeems, LP supplies, LP withdrawals, oracle trades, prices, and SVI history. Use these for history pages. `TODO VERIFY`: whether these endpoints support documented server-side filters by manager ID, trader, or time window beyond the query examples shown in the public docs. Until verified, keep history adapters tolerant and filter client-side only for MVP-sized data sets. citeturn24view0

**Event-subscription flow.** The official docs say that when a UI needs lower-latency oracle state than the indexed server provides, you should filter live Sui events by the current Predict package ID and watch these event types: `oracle::OraclePricesUpdated`, `oracle::OracleSVIUpdated`, `oracle::OracleSettled`, and `oracle::OracleActivated`. PredictPilot’s MVP should treat this as optional. If browser-side event subscription is unreliable, poll `oracles/:oracle_id/state`, `prices/latest`, and `svi/latest` every few seconds on the focused oracle screen and defer true streaming to a thin backend or later iteration. citeturn24view0turn21view1

## Write flows, PTB builders, and preview design

**PTB builder design.** Every wallet action in PredictPilot should be built by a dedicated typed builder module, not inline in UI components. PTBs are atomic sequences of commands, and the official PTB docs recommend `Transaction` plus `moveCall`, `typeArguments`, and composable command results. Use one file per business action, and return a ready-to-sign `Transaction` instance plus a local preview payload. citeturn12view3turn43view0turn39search6

**Recommended verified protocol targets.** The following onchain targets are verified from the official DeepBook Predict docs and source:

- `predict::create_manager`
- `predict::get_trade_amounts`
- `predict::ask_bounds`
- `predict::mint`
- `predict::redeem`
- `predict::redeem_permissionless`
- `predict::get_range_trade_amounts`
- `predict::mint_range`
- `predict::redeem_range`
- `predict::supply`
- `predict::withdraw`
- `predict_manager::deposit`
- `predict_manager::withdraw`
- `market_key::up`
- `market_key::down`
- `market_key::new`
- `range_key::new` citeturn45view1turn36view0turn36view1turn37view0turn22view0turn22view1

**Manager creation flow.** Build a transaction that calls `predict::create_manager`. After success, resolve the new manager ID from the emitted `PredictManagerCreated` event or transaction object changes, persist it in local storage keyed by `network + address`, then immediately refetch `/managers` and `/managers/:manager_id/summary`. Do **not** optimistically assume a fixed manager ID. citeturn45view1turn36view0turn37view2

**dUSDC manager deposit flow.** The deposit flow is wallet DUSDC to manager balance, not wallet DUSDC to Predict. The verified manager API is `predict_manager::deposit<T>(self, coin, ctx)`. Build a DUSDC coin in the PTB with `tx.coin({ balance, type: DUSDC_TYPE })`, then pass that coin into the manager deposit call. After success, refetch wallet token balances and manager summary. citeturn37view0turn43view0

```ts
// LOCAL APPLICATION CODE — illustrative manual fallback
const tx = new Transaction();

const depositCoin = tx.coin({
  balance: depositAmount,
  type: DUSDC_TYPE,
});

tx.moveCall({
  target: `${PREDICT_PACKAGE_ID}::predict_manager::deposit`,
  typeArguments: [DUSDC_TYPE],
  arguments: [
    tx.object(managerId),
    depositCoin,
  ],
});
```

The protocol target and the `tx.coin({ balance, type })` SDK pattern are both verified. `TODO VERIFY`: the exact object-helper syntax for the installed SDK version if you use non-codegen manual builders. citeturn37view0turn43view0

**Manager withdrawal flow.** The verified manager withdrawal target is `predict_manager::withdraw<T>(self, amount, ctx): Coin<T>`. Use it to move DUSDC back out of `PredictManager` into the signer’s wallet before or after trading. After the call returns a `Coin<DUSDC>`, explicitly route that coin back to the signer’s address in the same PTB or through the wallet-standard transfer path. `TODO VERIFY`: whether your final UX prefers direct address-balance deposit or explicit coin transfer for DUSDC display consistency in the chosen wallet. citeturn37view1turn37view4

**Binary mint flow.** A binary mint requires: the shared `Predict` object, the user’s shared `PredictManager`, the chosen `OracleSVI`, a `MarketKey`, a quantity, and `Clock`. The source shows that `mint<Quote>` checks manager ownership, trading pause, quantity > 0, accepted quote asset, key-oracle match, and a live oracle; then it inserts liability into the vault, prices against the post-trade state, withdraws cost from the manager balance, accepts payment into the vault, checks total exposure, and increases the user’s internal position quantity. This means the correct UX order is: ensure manager exists, ensure manager has enough DUSDC, preview amounts, then mint. Do **not** attempt to mint directly from wallet DUSDC without a manager deposit. citeturn36view0turn45view0

**Binary redeem flow.** The verified `redeem<Quote>` path removes quantity from the manager’s positions and deposits payout back into the manager balance. That payout does **not** go directly to the wallet. PredictPilot therefore needs a clear post-redeem UX that shows “Redeemed to manager balance” and offers a separate “Withdraw DUSDC to wallet” step using `predict_manager::withdraw`. For settled positions, the protocol also exposes `redeem_permissionless<Quote>` into the owner’s manager, but that should be a later or advanced surface, not a mandatory MVP path. citeturn34view3turn34view0turn45view1

**Range mint flow.** The verified `mint_range<Quote>` path buys a bounded range keyed by `RangeKey`. The official docs say the user pays only the range premium up front and that the range is priced as a single bounded instrument. PredictPilot should treat this as a first-class execution path with its own preview, not as two synthetic binary legs in the UI. The canonical constructor is `range_key::new`. citeturn34view5turn45view1turn22view1

**Range redeem flow.** The verified `redeem_range<Quote>` path deposits payout into the owner’s manager and uses the official band semantics `(lower, higher]` at settlement. Like binary redeem, range redeem should surface payout-to-manager semantics clearly. The current docs explicitly describe the preview function `get_range_trade_amounts()` for UI preview. citeturn34view6turn34view4turn45view0

**Vault supply flow.** Official docs and source confirm that `predict::supply<Quote>` takes a `Coin<Quote>` directly from the wallet, accepts payment into the vault, and mints `PLP` shares. The first supplier gets shares 1:1; later suppliers get shares proportional to deposit relative to current vault value. This means LP supply does **not** depend on `PredictManager`. It is a direct wallet-to-vault flow. citeturn36view1turn21view0

**Vault withdraw flow.** Official docs and source confirm that `predict::withdraw<Quote>` burns `Coin<PLP>` and returns a quote-asset coin, but only if the requested amount is available after current max payout and withdrawal-limiter checks. PredictPilot must pre-communicate that LP withdrawal availability is liquidity-constrained and may fail even when the user holds PLP. This is not a generic ERC-20 redeem. citeturn36view1turn21view0turn45view0

**Transaction preview design.** The protocol explicitly publishes `get_trade_amounts()`, `get_range_trade_amounts()`, and `ask_bounds()` as UI/preview reads. PredictPilot should use a two-tier preview system. Tier one is fast UI preview from the indexed server and currently selected oracle row. Tier two is authoritative pre-sign preview from the protocol preview functions via a read-only simulation path. `TODO VERIFY`: the exact simulation helper name in the final installed client transport. If that path is not ready by demo day, keep the server preview but label it “estimated until signature.” citeturn45view1turn36view0turn34view4turn35view4

**Transaction execution design.** In the current official React dApp Kit docs, the app creates a `Transaction` and signs and executes it through `useDAppKit().signAndExecuteTransaction({ transaction: tx })`. PredictPilot should follow that pattern and never allow components to mutate transaction shape after the user sees their preview. All inputs should be frozen in the builder result. citeturn40view0

**Post-transaction refresh design.** After every successful digest, refresh three things in order: wallet balances, the page-level indexed endpoints that back the current screen, and any local persisted manager metadata. For mints and redeems, refetch manager summary, positions summary, oracle state, and relevant history; for LP actions, refetch wallet PLP/DUSDC, vault summary, and LP history. This exactly matches the official guidance to refresh both affected onchain objects and indexed endpoints after confirmation. citeturn21view2turn21view1

## Runtime UX, reliability, debugging, and safety

**Error handling design.** All integration errors should pass through `src/integrations/deepbook-predict/errors.ts` and be normalized into a small set of user-facing codes: `NETWORK_MISMATCH`, `NO_MANAGER`, `INSUFFICIENT_WALLET_DUSDC`, `INSUFFICIENT_MANAGER_DUSDC`, `ORACLE_NOT_LIVE`, `ORACLE_SETTLED_MINT_BLOCKED`, `INVALID_RANGE`, `LIQUIDITY_WITHDRAW_UNAVAILABLE`, `SERVER_DECODE_FAILED`, `TX_REJECTED`, and `TX_FAILED`. This naming is a local recommendation. The protocol facts behind several of these states are official: mints require a live oracle; settled binary redemption can be permissionless; range keys enforce `lower < higher`; LP withdrawal is capped by available liquidity after max payout coverage. citeturn45view0turn34view0turn22view1turn36view1

**Loading-state design.** Use separate loading states for wallet connect, manager lookup, server fetch, preview fetch, transaction signing, and post-transaction refresh. Do not block the whole app for a background oracle poll. Local recommendation: use TanStack Query statuses plus a small `txState` store for wallet actions.

**Empty-state design.** The three most important empty states are: no wallet connected, no manager exists for this address, and no DUSDC / no PLP available. The “no manager” state should show only one strong CTA: “Create Predict Manager.” The “no DUSDC” state should link users to the official Predict Testnet token request process, because official docs explicitly tell builders to use that form for DUSDC and other test assets. citeturn21view0

**Debugging strategy.** Log the exact package ID, Predict object ID, manager ID, oracle ID, DUSDC type, and transaction digest for every write flow. Also log the last server response timestamp used for a preview. Because the docs state that Testnet identifiers and entry points are provisional, config drift is one of the most likely demo killers. citeturn24view0turn21view0

**Security requirements.** Never trust the public server for transaction construction. The server should drive rendering, but the transaction builder must use locally validated config and authoritative object IDs. Never bury package IDs in UI components. Never auto-persist a newly created manager until the transaction is confirmed. Never assume response schemas from the public server are stable unless your Zod schema passes. Never ask users to sign a transaction whose preview depends on stale oracle data without surfacing freshness. These are local requirements consistent with the official split between render-ready server data and chain-authoritative wallet flows. citeturn21view1turn45view0

**Common failure cases.** The most likely real failures are stale testnet IDs, missing DUSDC, missing manager, manager lookup built around `getOwnedObjects`, mint attempts on inactive or settled oracles, invalid range strikes, LP withdrawals above available liquidity, and server shape drift. All of these are either directly documented protocol constraints or direct implementation implications of the official object model. citeturn24view0turn45view0turn44view2

**Common integration mistakes.** Do not build positions as wallet-held NFTs or objects. Do not send mint payouts directly to the wallet. Do not skip the manager deposit step for trading. Do not model ranges as directional instruments. Do not use old Predict package IDs from past experiments. Do not center page rendering on `getObject` loops. Do not assume Mainnet-ready semantics from these Testnet docs. citeturn21view0turn45view0turn24view0

## Testing, demo preparation, and final checklist

**Testing strategy.** Split tests into four layers. First, unit-test config parsing, server response mapping, numeric formatting, and range / quantity validation. Second, integration-test each transaction builder against static config and snapshot the generated transaction JSON shape. Third, run live Testnet smoke tests against one funded wallet. Fourth, run Playwright E2E on the exact demo flows. This is a local testing plan.

**Minimum integration test cases.**
- `buildCreateManagerTx` constructs the verified `predict::create_manager` target.
- Manager creation path persists a manager ID only after confirmation.
- Deposit path builds a DUSDC `Coin` and calls `predict_manager::deposit`.
- Withdraw path calls `predict_manager::withdraw` and routes returned DUSDC back to the signer.
- Binary mint path fails fast when manager ID is missing.
- Binary redeem path refreshes manager summary and marks payout destination as manager.
- Range mint path rejects `lower >= higher` before signature.
- Vault supply path returns PLP balance growth.
- Vault withdraw path surfaces liquidity-unavailable failures cleanly.
- All builders refuse to run when the active network is not `testnet`.

The protocol targets and constraints above are all official; the exact test harness is a local recommendation. citeturn46view0turn37view0turn37view1turn36view0turn36view1turn22view1

**Minimum E2E smoke cases.**
- Connect wallet and display address plus testnet network.
- Create manager for a fresh wallet.
- Deposit DUSDC into manager.
- Mint one binary position on a live oracle.
- Redeem a binary position and show payout to manager.
- Mint and redeem one range position.
- Supply DUSDC to vault and receive PLP.
- Withdraw PLP back to DUSDC.
- Refresh portfolio, vault, and history after each digest.

**Demo preparation checklist.**
- Pre-fund the demo wallet with Testnet SUI and DUSDC. citeturn9search11turn21view0
- Validate all config IDs against the official contract-information page on the morning of the demo. citeturn24view0turn21view0
- Pre-create and persist a manager for the demo wallet, but also keep the create-manager flow available in case judges want to see it. citeturn45view1turn37view2
- Pre-select one currently live oracle for mint demo and one settled oracle for redeem demo from the current `/predicts/:predict_id/oracles` catalog. `TODO VERIFY`: exact oracle IDs on demo day. citeturn24view0turn45view0
- Warm the page caches for vault summary, manager summary, and oracle state.
- Keep a fallback “manual refresh after digest” button visible in advanced mode.

**Final integration checklist.**
- [ ] Config-driven Testnet deployment values only.
- [ ] DApp Kit React setup with Wallet Standard discovery.
- [ ] `SuiGrpcClient` wired to Testnet.
- [ ] Public Predict server adapter implemented.
- [ ] Zod schemas for all consumed server responses.
- [ ] Codegen output generated from onchain Predict package.
- [ ] Dedicated tx builder per action.
- [ ] Manager ID persistence and recovery path implemented.
- [ ] Binary preview, range preview, and ask-bounds preview implemented.
- [ ] Post-digest refresh orchestration implemented.
- [ ] Error normalization complete.
- [ ] Live oracle polling or event refresh implemented for focused market screen.
- [ ] Playwright smoke flows passing against Testnet.
- [ ] Demo wallet funded and pre-verified.

**Open questions and `TODO VERIFY` list.**
- `TODO VERIFY`: the exact response schemas and optional query parameters for the public Predict server endpoints.
- `TODO VERIFY`: the final SDK helper names for clock-object injection and `ID` pure-argument encoding if you use manual `moveCall` builders instead of codegen.
- `TODO VERIFY`: the exact transaction-result API used in the installed SDK version to retrieve emitted events and object changes after `signAndExecuteTransaction`.
- `TODO VERIFY`: whether the public `/managers` endpoint exposes a documented owner filter, or whether client-side filtering / event recovery is required.
- `TODO VERIFY`: the exact live oracle IDs to use in the judge demo.
- `TODO VERIFY`: the uploaded `Sui hack-2026(4).md` input, which was referenced by the user but not retrievable in this session.

If these unresolved items are handled, PredictPilot will be integrating DeepBook Predict the way the official docs recommend: **server-first for render-ready data, chain-authoritative around wallet flows, config-driven Testnet IDs, a real `PredictManager`-centric execution model, and real DeepBook Predict mint / redeem / LP actions on Sui Testnet.** citeturn21view1turn45view0turn24view0