# API_CONTRACTS.md

## Intent and source hierarchy

PredictPilot needs three data surfaces, each with a different trust level and job. The official DeepBook Predict integration docs explicitly recommend: public `predict-server` for indexed, render-ready data; live Sui checkpoint or event streaming for low-latency oracle freshness; and direct onchain reads for confirmation-critical wallet flows. The same docs also warn not to build the UI by decoding raw Move events everywhere when the public server already exposes the indexed surface. citeturn6view0turn11view4

For PredictPilot, the source-of-truth hierarchy must therefore be:

| Concern | Primary source | Why | Acceptable fallback | Contract rule |
|---|---|---|---|---|
| Public market discovery | Predict Server | Official render-ready surface for market, oracle, vault, manager, and history endpoints | Onchain object reads only for emergency fallback | Server-first |
| Wallet account identity | Wallet Standard / dApp Kit | Official wallet discovery, account authorization, transaction signing, and execution surface | None | Wallet-only |
| Wallet dUSDC balance and spendable coin objects | Sui client core balance/coin methods | Transaction-critical and user-specific | None | Onchain-first |
| PredictManager existence and pre-submit state | Predict Server for discovery, onchain object read before write | Server is best for discovery; onchain is authoritative for transaction-critical checks | None | Hybrid |
| Oracle tradeability and preview-critical data | Onchain read plus live event stream | Oracle status gates mint/redeem behavior | Predict Server after confirmation | Onchain-first for writes |
| Page-level historical rendering | Predict Server | Indexed and paginated history surface | Transaction digest lookup for recent writes | Server-first |
| Transaction outcome | Wallet result plus `waitForTransaction`/`getTransaction` | Official execution result includes digest, status, effects, and events when requested | None | Chain-first |

This hierarchy follows the official Predict integration guidance and Sui’s wallet and client architecture. Sui transactions are PTBs that can compose object operations and Move calls in one transaction, while Sui clients expose transport-agnostic object, balance, transaction, and dynamic-field reads through the Core API. citeturn39view0turn39view1turn44view0

PredictPilot must not create a generic “prediction market API” abstraction that hides the protocol’s actual primitives. DeepBook Predict is built around a shared `Predict` object, per-user shared `PredictManager` objects, `OracleSVI` shared objects, `MarketKey` and `RangeKey` identifiers, a shared `Vault`, and `PLP` LP shares. Positions and ranges are not standalone onchain objects; they are quantities stored inside a `PredictManager`. citeturn3view0turn10search2turn37search1turn21view0turn21view1

## Verified official interfaces

DeepBook Predict is currently documented as a Sui Testnet integration surface, and the docs explicitly say the current package IDs, object layouts, and entry points are provisional before Mainnet. PredictPilot must therefore centralize deployment identifiers and never hardcode them across UI components. citeturn11view0

### Deployment identifiers

The following deployment identifiers are explicitly published in the official Sui DeepBook Predict contract-information page and the `predict-testnet-4-16` branch README. citeturn11view0turn6view0

| Identifier | Verified value |
|---|---|
| Network | `Testnet` |
| Public server | `https://predict-server.testnet.mystenlabs.com` |
| Predict package | `0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138` |
| Predict registry | `0x43af14fed5480c20ff77e2263d5f794c35b9fab7e2212903127062f4fe2a6e64` |
| Predict object | `0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a` |
| Current quote asset type | `0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC` |
| dUSDC currency ID | `0xf3000dff421833d4bb8ed58fac146d691a3aaba2785aa1989af65a7089ca3e9c` |
| PLP coin type | `0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138::plp::PLP` |
| Source branch | `predict-testnet-4-16` |

### Predict Server API catalog

The official Predict docs publish the public server base URL and enumerate the current endpoint surface by path and purpose. Those docs do **not** publish complete response schemas for most endpoints on the page, so PredictPilot must treat exact response shapes as `TODO VERIFY` unless captured from official real responses. The one exception found in official repository materials is `/status`, whose response is described in the server README. citeturn11view1turn11view3turn11view4turn30view0

Verified endpoint inventory:

| Endpoint | Verified purpose | Verified request contract |
|---|---|---|
| `GET /status` | Server health and indexer status | Optional query params: `max_checkpoint_lag`, `max_time_lag_seconds` citeturn11view1turn30view0 |
| `GET /predicts/:predict_id/state` | Predict object state and config | `predict_id` path param required citeturn11view1 |
| `GET /predicts/:predict_id/oracles` | Oracle list for a Predict object | `predict_id` path param required citeturn11view1 |
| `GET /oracles/:oracle_id/state` | Current oracle state | `oracle_id` path param required citeturn11view1 |
| `GET /predicts/:predict_id/quote-assets` | Accepted quote assets | `predict_id` path param required citeturn11view1 |
| `GET /oracles/:oracle_id/ask-bounds` | Resolved oracle ask bounds | `oracle_id` path param required citeturn11view1 |
| `GET /predicts/:predict_id/vault/summary` | Current vault summary | `predict_id` path param required citeturn11view3 |
| `GET /predicts/:predict_id/vault/performance?range=ALL` | Vault performance over selected range | Verified query example only: `range=ALL` citeturn11view3turn24search0 |
| `GET /lp/supplies` | LP supply history | No official query params verified from public docs citeturn11view3 |
| `GET /lp/withdrawals` | LP withdrawal history | No official query params verified from public docs citeturn11view3 |
| `GET /managers` | Predict manager list | No official query params verified from public docs; owner filtering is mentioned conceptually in the branch README but exact parameter name is `TODO VERIFY` citeturn11view3turn6view0 |
| `GET /managers/:manager_id/summary` | Manager summary | `manager_id` path param required citeturn11view3 |
| `GET /managers/:manager_id/positions/summary` | Manager position summary | `manager_id` path param required citeturn11view3 |
| `GET /managers/:manager_id/pnl?range=ALL` | Manager PnL over selected range | Verified query example only: `range=ALL` citeturn11view3turn24search0 |
| `GET /oracles/:oracle_id/prices` | Oracle price history | `oracle_id` path param required citeturn11view4 |
| `GET /oracles/:oracle_id/prices/latest` | Latest indexed price update | `oracle_id` path param required citeturn11view4 |
| `GET /oracles/:oracle_id/svi` | Oracle SVI history | `oracle_id` path param required citeturn11view4 |
| `GET /oracles/:oracle_id/svi/latest` | Latest indexed SVI update | `oracle_id` path param required citeturn11view4 |
| `GET /positions/minted` | Position mint history | No official query params verified from public docs citeturn11view4 |
| `GET /positions/redeemed` | Position redeem history | No official query params verified from public docs citeturn11view4 |
| `GET /ranges/minted` | Range mint history | No official query params verified from public docs citeturn11view4 |
| `GET /ranges/redeemed` | Range redeem history | No official query params verified from public docs citeturn11view4 |
| `GET /trades/:oracle_id` | Trade history for an oracle | `oracle_id` path param required citeturn11view4 |

The official DeepBook server README documents `/status` in more detail. PredictPilot can safely validate it as:

- `status`: `"OK"` or `"UNHEALTHY"`
- `latest_onchain_checkpoint`
- `current_time_ms`
- `earliest_checkpoint`
- `max_lag_pipeline`
- `pipelines[]` containing `pipeline`, `indexed_checkpoint`, `indexed_epoch`, `indexed_timestamp_ms`, `checkpoint_lag`, `time_lag_seconds`, `latest_onchain_checkpoint`
- `max_checkpoint_lag`
- `max_time_lag_seconds` citeturn30view0

### Onchain read catalog

The official docs and source files verify the following onchain primitives and read surfaces. `Predict` is the shared protocol root, `PredictManager` is a per-user shared account object, `OracleSVI` is shared market state for one underlying and one expiry, `MarketKey` identifies binary positions, `RangeKey` identifies vertical ranges, `Vault` tracks balances and liabilities, and `PLP` is the LP share token. citeturn3view0turn8view1turn23view3turn21view0turn21view1turn8view4turn8view5

Verified public Move functions that matter to PredictPilot:

| Module | Verified public function | Purpose |
|---|---|---|
| `deepbook_predict::predict` | `create_manager` | Creates a new shared `PredictManager` for caller citeturn7view0turn37search2 |
| `deepbook_predict::predict` | `get_trade_amounts` | Preview binary mint cost and redeem payout citeturn22view0 |
| `deepbook_predict::predict` | `ask_bounds` | Read resolved ask bounds for an oracle citeturn22view0turn22view1 |
| `deepbook_predict::predict` | `mint`, `redeem`, `redeem_permissionless` | Binary execution flows citeturn22view0turn22view3turn22view4 |
| `deepbook_predict::predict` | `get_range_trade_amounts` | Preview range mint cost and redeem payout citeturn22view0turn22view2 |
| `deepbook_predict::predict` | `mint_range`, `redeem_range` | Range execution flows citeturn22view0turn19view4turn8view0 |
| `deepbook_predict::predict` | `supply`, `withdraw` | LP supply and withdraw flows citeturn19view3turn19view2 |
| `deepbook_predict::predict_manager` | `owner`, `position`, `range_position`, `balance`, `deposit`, `withdraw` | Manager reads and dUSDC movement citeturn8view1turn19view1 |
| `deepbook_predict::oracle` | `activate`, `update_prices`, `update_svi` | Oracle lifecycle and updates citeturn23view0turn23view1turn23view2 |
| `deepbook_predict::oracle` | `id`, `underlying_asset`, `spot_price`, `forward_price`, `prices`, `svi`, `expiry`, `timestamp`, `settlement_price`, `is_settled`, `is_active`, `status`, `status_inactive`, `status_active`, `status_pending_settlement`, `status_settled` | Oracle reads and lifecycle status citeturn19view0 |
| `deepbook_predict::registry` | `predict_id`, `oracle_ids`, `create_predict` | Registry lookup and setup surface citeturn8view3 |
| `deepbook_predict::vault` | `balance`, `asset_balance`, `total_mtm`, `vault_value`, `total_max_payout` | Vault reads used for LP analytics and withdrawal capacity calculations citeturn8view4 |
| `deepbook_predict::market_key` | `up`, `down`, `new`, `oracle_id`, `expiry`, `strike`, `is_up`, `is_down` | Binary key construction and reads citeturn21view0 |
| `deepbook_predict::range_key` | `new`, `oracle_id`, `expiry`, `lower_strike`, `higher_strike` | Range key construction and reads citeturn21view1 |

### Wallet-derived state catalog

Sui Wallet Standard is the official browser-wallet discovery and interaction layer. It defines `standard:connect`, `standard:events`, `sui:signTransaction`, and `sui:signAndExecuteTransaction`, while dApp Kit provides a higher-level instance with `connectWallet`, `disconnectWallet`, `switchAccount`, `switchNetwork`, `signTransaction`, `signAndExecuteTransaction`, and access to the current client and connection state. Wallets automatically restore previously authorized accounts, and apps should only prompt with `connect()` when necessary. citeturn39view4turn39view5turn40view0turn41view1turn41view2

PredictPilot may therefore treat the following as wallet-derived contracts:

| State | Official source | Contract |
|---|---|---|
| Available wallets | `getWallets().get()` / dApp Kit stores | Array of wallet descriptors with `name`, `icon`, `accounts`, `features` citeturn40view0 |
| Current connected account | Wallet Standard `Wallet.accounts` or `useCurrentAccount` | Must provide `address`; `publicKey` is available after authorization citeturn40view0turn41view0 |
| Current network | dApp Kit current network / client | Must match PredictPilot deployment config, which is Testnet for current Predict integration citeturn11view0turn41view0 |
| Transaction execution | `sui:signAndExecuteTransaction` or dApp Kit `signAndExecuteTransaction` | Wallet prompts, signs, and submits PTB; app must inspect success/failure branch citeturn39view5turn41view0turn44view0 |

## Local application contracts

Everything below this point is **local PredictPilot application code**, not an official server schema. It exists to give Codex stable interfaces even when the official public Predict docs only publish endpoint paths and purposes.

### Primitive types and normalization rules

Use the following primitive aliases in local code:

```ts
// Local application code
export type ObjectId = `0x${string}`;
export type SuiAddress = `0x${string}`;
export type MoveType = `${string}::${string}::${string}${string}`;
export type U64String = string;      // raw DTO boundary only
export type I64String = string;      // raw DTO boundary only
export type TimestampMsString = string;
export type QuoteAmount = bigint;    // normalized domain model
export type Price1e9 = bigint;       // normalized oracle prices/SVI params
```

Rationale for PredictPilot:

- Sui objects are addressable by globally unique IDs, and object IDs are stable identifiers even as versions change. citeturn39view2
- `OracleSVI` `PriceData` and `SVIParams` are scaled by `1e9`. citeturn23view3turn23view4
- Vault accounting uses quote units where `1_000_000 = 1 contract = $1 at settlement`, and dUSDC has 6 decimals on Testnet. citeturn8view4turn11view0

**Local normalization rule**: preserve integer-like values as strings at the raw adapter boundary, then convert to `bigint` inside mappers before any financial calculation. This prevents silent precision loss in JavaScript and keeps the app safe if the server emits 64-bit numeric values.

### Official request and response schemas

Officially verified request contracts:

```ts
// Local application code
export interface StatusQuery {
  max_checkpoint_lag?: number;      // verified by server README
  max_time_lag_seconds?: number;    // verified by server README
}

export interface PredictIdPath {
  predictId: ObjectId;
}

export interface OracleIdPath {
  oracleId: ObjectId;
}

export interface ManagerIdPath {
  managerId: ObjectId;
}

export interface RangeQueryVerified {
  range: 'ALL'; // only verified public value today
}
```

Officially verified `/status` response contract:

```ts
// Local application code mirroring the official server README
export interface PredictServerStatusDto {
  status: 'OK' | 'UNHEALTHY';
  latest_onchain_checkpoint: number;
  current_time_ms: number;
  earliest_checkpoint: number;
  max_lag_pipeline: string;
  pipelines: Array<{
    pipeline: string;
    indexed_checkpoint: number;
    indexed_epoch: number;
    indexed_timestamp_ms: number;
    checkpoint_lag: number;
    time_lag_seconds: number;
    latest_onchain_checkpoint: number;
  }>;
  max_checkpoint_lag: number;
  max_time_lag_seconds: number;
}
```

That contract is the only public Predict-server response shape verified from official materials in this document. citeturn30view0

For all other Predict-server routes, use **permissive raw DTO contracts** until exact official payloads are captured from real testnet responses:

```ts
// Local application code
export type UnknownObjectDto = Record<string, unknown>;
export type UnknownListDto = unknown[];

export type PredictStateDto = UnknownObjectDto;                 // TODO VERIFY exact fields
export type PredictOraclesDto = UnknownListDto;                 // TODO VERIFY exact fields
export type OracleStateDto = UnknownObjectDto;                  // TODO VERIFY exact fields
export type QuoteAssetsDto = UnknownListDto;                    // TODO VERIFY exact fields
export type OracleAskBoundsDto = UnknownObjectDto;              // TODO VERIFY exact fields
export type VaultSummaryDto = UnknownObjectDto;                 // TODO VERIFY exact fields
export type VaultPerformanceDto = UnknownListDto;               // TODO VERIFY exact fields
export type ManagersDto = UnknownListDto;                       // TODO VERIFY exact fields
export type ManagerSummaryDto = UnknownObjectDto;               // TODO VERIFY exact fields
export type ManagerPositionsSummaryDto = UnknownObjectDto;      // TODO VERIFY exact fields
export type ManagerPnlDto = UnknownListDto | UnknownObjectDto;  // TODO VERIFY exact fields
export type OraclePricesDto = UnknownListDto;                   // TODO VERIFY exact fields
export type OracleLatestPriceDto = UnknownObjectDto;            // TODO VERIFY exact fields
export type OracleSviDto = UnknownListDto;                      // TODO VERIFY exact fields
export type OracleLatestSviDto = UnknownObjectDto;              // TODO VERIFY exact fields
export type PositionMintHistoryDto = UnknownListDto;            // TODO VERIFY exact fields
export type PositionRedeemHistoryDto = UnknownListDto;          // TODO VERIFY exact fields
export type RangeMintHistoryDto = UnknownListDto;               // TODO VERIFY exact fields
export type RangeRedeemHistoryDto = UnknownListDto;             // TODO VERIFY exact fields
export type LpSuppliesHistoryDto = UnknownListDto;              // TODO VERIFY exact fields
export type LpWithdrawalsHistoryDto = UnknownListDto;           // TODO VERIFY exact fields
export type OracleTradesDto = UnknownListDto;                   // TODO VERIFY exact fields
```

### Domain models

PredictPilot should normalize official data into protocol-specific domain models rather than generic market/bet models.

```ts
// Local application code
export interface PredictDeploymentModel {
  network: 'testnet';
  serverBaseUrl: string;
  packageId: ObjectId;
  registryId: ObjectId;
  predictObjectId: ObjectId;
  quoteAssetType: MoveType;
  quoteCurrencyId: ObjectId;
  plpType: MoveType;
  sourceBranch: 'predict-testnet-4-16';
}

export type OracleLifecycleStatus =
  | 'INACTIVE'
  | 'ACTIVE'
  | 'PENDING_SETTLEMENT'
  | 'SETTLED';

export interface MarketKeyModel {
  oracleId: ObjectId;
  expiryMs: bigint;
  strike1e9: bigint;
  isUp: boolean;
}

export interface RangeKeyModel {
  oracleId: ObjectId;
  expiryMs: bigint;
  lowerStrike1e9: bigint;
  higherStrike1e9: bigint;
}

export interface OracleModel {
  oracleId: ObjectId;
  underlyingAsset: string;
  expiryMs: bigint;
  lastUpdateMs: bigint;
  active: boolean;
  settled: boolean;
  status: OracleLifecycleStatus;
  spot1e9: bigint;
  forward1e9: bigint;
  settlementPrice1e9: bigint | null;
  svi: {
    a1e9: bigint;
    b1e9: bigint;
    rho1e9Signed: string;
    m1e9Signed: string;
    sigma1e9: bigint;
  };
}

export interface BinaryPositionModel {
  key: MarketKeyModel;
  quantityQuote: bigint;
}

export interface RangePositionModel {
  key: RangeKeyModel;
  quantityQuote: bigint;
}

export interface PredictManagerModel {
  managerId: ObjectId;
  owner: SuiAddress;
  availableDusdcQuote: bigint;
  binaryPositions: BinaryPositionModel[];
  rangePositions: RangePositionModel[];
}

export interface VaultModel {
  predictId: ObjectId;
  vaultBalanceQuote: bigint;
  totalMtmQuote: bigint;
  vaultValueQuote: bigint;
  totalMaxPayoutQuote: bigint;
}

export interface PlpModel {
  coinType: MoveType;
  walletBalanceAtomic: bigint;
  impliedVaultShareRatio?: number; // local UI convenience; TODO VERIFY exact server math inputs
}

export interface PortfolioModel {
  manager: PredictManagerModel | null;
  dusdcWalletBalanceQuote: bigint;
  plp: PlpModel | null;
  pnlSeries: PnlPointModel[];
}

export interface PnlPointModel {
  timestampMs: bigint;
  pnlQuote: bigint;
  equityQuote?: bigint; // TODO VERIFY official server field
}

export interface TransactionPreviewModel {
  kind:
    | 'createManager'
    | 'depositManagerDusdc'
    | 'withdrawManagerDusdc'
    | 'mintBinary'
    | 'redeemBinary'
    | 'mintRange'
    | 'redeemRange'
    | 'supplyVault'
    | 'withdrawVault';
  predictId?: ObjectId;
  managerId?: ObjectId;
  oracleId?: ObjectId;
  marketKey?: MarketKeyModel;
  rangeKey?: RangeKeyModel;
  inputDusdcQuote?: bigint;
  outputDusdcQuote?: bigint;
  inputPlpAtomic?: bigint;
  outputPlpAtomic?: bigint;
  warnings: string[];
}
```

These local models deliberately preserve Predict semantics:

- binary positions are keyed by `(oracle_id, expiry, strike, direction)` through `MarketKey`; ranges are keyed by `(oracle_id, expiry, lower_strike, higher_strike)` through `RangeKey`; bull-call and bear-put ranges with the same strikes share the same `RangeKey`; and positions/ranges live inside `PredictManager` rather than as independent objects. citeturn21view0turn21view1turn3view0turn37search1
- Oracle lifecycle is a four-state machine with verified status values `0 = INACTIVE`, `1 = ACTIVE`, `2 = PENDING_SETTLEMENT`, `3 = SETTLED`. citeturn8view2turn19view0
- Vault LP flows use `PLP` minted on `supply` and burned on `withdraw`. citeturn10search5turn19view3turn19view2turn8view5

### Event and transaction models

PredictPilot should treat onchain events as a first-class internal contract because they are the most reliable way to refresh after writes and to power live oracle updates. The official docs tell UIs to watch `oracle::OraclePricesUpdated`, `oracle::OracleSVIUpdated`, `oracle::OracleSettled`, and `oracle::OracleActivated` for low-latency freshness. The Move sources define the rest of the protocol event fields exactly. citeturn11view4turn7view0turn23view3turn20view0turn8view3

```ts
// Local application code
export interface OracleActivatedEvent {
  kind: 'OracleActivated';
  oracleId: ObjectId;
  expiryMs: bigint;
  timestampMs: bigint;
}

export interface OracleSettledEvent {
  kind: 'OracleSettled';
  oracleId: ObjectId;
  expiryMs: bigint;
  settlementPrice1e9: bigint;
  timestampMs: bigint;
}

export interface OraclePricesUpdatedEvent {
  kind: 'OraclePricesUpdated';
  oracleId: ObjectId;
  spot1e9: bigint;
  forward1e9: bigint;
  timestampMs: bigint;
}

export interface OracleSviUpdatedEvent {
  kind: 'OracleSVIUpdated';
  oracleId: ObjectId;
  a1e9: bigint;
  b1e9: bigint;
  rho1e9Signed: string;
  m1e9Signed: string;
  sigma1e9: bigint;
  timestampMs: bigint;
}

export interface PositionMintedEvent {
  kind: 'PositionMinted';
  predictId: ObjectId;
  managerId: ObjectId;
  trader: SuiAddress;
  quoteAsset: MoveType;
  oracleId: ObjectId;
  expiryMs: bigint;
  strike1e9: bigint;
  isUp: boolean;
  quantityQuote: bigint;
  costQuote: bigint;
  askPrice1e9: bigint;
}

export interface PositionRedeemedEvent {
  kind: 'PositionRedeemed';
  predictId: ObjectId;
  managerId: ObjectId;
  owner: SuiAddress;
  executor: SuiAddress;
  quoteAsset: MoveType;
  oracleId: ObjectId;
  expiryMs: bigint;
  strike1e9: bigint;
  isUp: boolean;
  quantityQuote: bigint;
  payoutQuote: bigint;
  bidPrice1e9: bigint;
  isSettled: boolean;
}

export interface RangeMintedEvent {
  kind: 'RangeMinted';
  predictId: ObjectId;
  managerId: ObjectId;
  trader: SuiAddress;
  quoteAsset: MoveType;
  oracleId: ObjectId;
  expiryMs: bigint;
  lowerStrike1e9: bigint;
  higherStrike1e9: bigint;
  quantityQuote: bigint;
  costQuote: bigint;
  askPrice1e9: bigint;
}

export interface RangeRedeemedEvent {
  kind: 'RangeRedeemed';
  predictId: ObjectId;
  managerId: ObjectId;
  trader: SuiAddress;
  quoteAsset: MoveType;
  oracleId: ObjectId;
  expiryMs: bigint;
  lowerStrike1e9: bigint;
  higherStrike1e9: bigint;
  quantityQuote: bigint;
  payoutQuote: bigint;
  bidPrice1e9: bigint;
  isSettled: boolean;
}

export interface SuppliedEvent {
  kind: 'Supplied';
  predictId: ObjectId;
  supplier: SuiAddress;
  quoteAsset: MoveType;
  amountQuote: bigint;
  sharesMintedAtomic: bigint;
}

export interface WithdrawnEvent {
  kind: 'Withdrawn';
  predictId: ObjectId;
  withdrawer: SuiAddress;
  quoteAsset: MoveType;
  amountQuote: bigint;
  sharesBurnedAtomic: bigint;
}

export interface PredictManagerCreatedEvent {
  kind: 'PredictManagerCreated';
  managerId: ObjectId;
  owner: SuiAddress;
}

export interface PredictCreatedEvent {
  kind: 'PredictCreated';
  predictId: ObjectId;
}

export interface OracleCreatedEvent {
  kind: 'OracleCreated';
  oracleId: ObjectId;
  oracleCapId: ObjectId;
  underlyingAsset: string;
  expiryMs: bigint;
  minStrike1e9: bigint;
  tickSize1e9: bigint;
}
```

Transaction records in PredictPilot should also remain protocol-specific:

```ts
// Local application code
export interface PredictTransactionRecord {
  digest: string;
  sender: SuiAddress;
  kind: TransactionPreviewModel['kind'];
  predictId?: ObjectId;
  managerId?: ObjectId;
  oracleId?: ObjectId;
  status: 'success' | 'failure';
  timestampMs?: bigint;
  gasUsed?: string;
  eventKinds: string[];
}
```

## Querying, caching, and runtime safety

PredictPilot should use the public Predict server for render-heavy data and `client.core` object reads for transaction-critical confirmation, because that is exactly how official Predict docs divide responsibilities. Sui’s Core API also recommends `include: { content: true }` plus BCS parsing for transport-consistent object decoding instead of relying on JSON structure, which can differ across transports. citeturn6view0turn44view0

### Query key contracts

```ts
// Local application code
export const predictQueryKeys = {
  root: ['deepbook-predict'] as const,

  status: () => ['deepbook-predict', 'status'] as const,
  deployment: () => ['deepbook-predict', 'deployment'] as const,

  predictState: (predictId: ObjectId) =>
    ['deepbook-predict', 'predict', predictId, 'state'] as const,
  predictOracles: (predictId: ObjectId) =>
    ['deepbook-predict', 'predict', predictId, 'oracles'] as const,
  predictQuoteAssets: (predictId: ObjectId) =>
    ['deepbook-predict', 'predict', predictId, 'quote-assets'] as const,

  oracleState: (oracleId: ObjectId) =>
    ['deepbook-predict', 'oracle', oracleId, 'state'] as const,
  oracleAskBounds: (oracleId: ObjectId) =>
    ['deepbook-predict', 'oracle', oracleId, 'ask-bounds'] as const,
  oraclePrices: (oracleId: ObjectId) =>
    ['deepbook-predict', 'oracle', oracleId, 'prices'] as const,
  oracleLatestPrice: (oracleId: ObjectId) =>
    ['deepbook-predict', 'oracle', oracleId, 'prices', 'latest'] as const,
  oracleSvi: (oracleId: ObjectId) =>
    ['deepbook-predict', 'oracle', oracleId, 'svi'] as const,
  oracleLatestSvi: (oracleId: ObjectId) =>
    ['deepbook-predict', 'oracle', oracleId, 'svi', 'latest'] as const,
  oracleTrades: (oracleId: ObjectId) =>
    ['deepbook-predict', 'oracle', oracleId, 'trades'] as const,

  vaultSummary: (predictId: ObjectId) =>
    ['deepbook-predict', 'predict', predictId, 'vault', 'summary'] as const,
  vaultPerformance: (predictId: ObjectId, range: 'ALL') =>
    ['deepbook-predict', 'predict', predictId, 'vault', 'performance', range] as const,

  managers: (owner?: SuiAddress) =>
    ['deepbook-predict', 'managers', { owner: owner ?? null }] as const, // owner filter TODO VERIFY
  managerSummary: (managerId: ObjectId) =>
    ['deepbook-predict', 'manager', managerId, 'summary'] as const,
  managerPositionsSummary: (managerId: ObjectId) =>
    ['deepbook-predict', 'manager', managerId, 'positions-summary'] as const,
  managerPnl: (managerId: ObjectId, range: 'ALL') =>
    ['deepbook-predict', 'manager', managerId, 'pnl', range] as const,

  walletDusdcBalance: (owner: SuiAddress, coinType: MoveType) =>
    ['deepbook-predict', 'wallet', owner, 'balance', coinType] as const,
  walletDusdcCoins: (owner: SuiAddress, coinType: MoveType) =>
    ['deepbook-predict', 'wallet', owner, 'coins', coinType] as const,
  walletPlpCoins: (owner: SuiAddress, coinType: MoveType) =>
    ['deepbook-predict', 'wallet', owner, 'coins', coinType] as const,

  historyPositionsMinted: () =>
    ['deepbook-predict', 'history', 'positions', 'minted'] as const,
  historyPositionsRedeemed: () =>
    ['deepbook-predict', 'history', 'positions', 'redeemed'] as const,
  historyRangesMinted: () =>
    ['deepbook-predict', 'history', 'ranges', 'minted'] as const,
  historyRangesRedeemed: () =>
    ['deepbook-predict', 'history', 'ranges', 'redeemed'] as const,
  historyLpSupplies: () =>
    ['deepbook-predict', 'history', 'lp', 'supplies'] as const,
  historyLpWithdrawals: () =>
    ['deepbook-predict', 'history', 'lp', 'withdrawals'] as const,

  txByDigest: (digest: string) =>
    ['deepbook-predict', 'tx', digest] as const,
};
```

### Cache invalidation and refresh contracts

PredictPilot should invalidate by **business effect**, not by route count.

| Write flow | Immediately refresh onchain | Then invalidate server-backed queries |
|---|---|---|
| `create_manager` | transaction digest / effects; newly created manager ID | `managers(owner)`, `managerSummary(managerId)`, `managerPositionsSummary(managerId)`, `managerPnl(managerId,'ALL')` |
| `predict_manager::deposit` | wallet dUSDC balance, wallet dUSDC coins, manager object | `managerSummary(managerId)`, optionally `managerPnl(managerId,'ALL')` |
| `predict_manager::withdraw` | wallet dUSDC balance, wallet dUSDC coins, manager object | `managerSummary(managerId)`, optionally `managerPnl(managerId,'ALL')` |
| `predict::mint` | manager object, oracle object | `managerSummary`, `managerPositionsSummary`, `managerPnl`, `oracleState`, `oracleAskBounds`, `predictState`, `vaultSummary`, `historyPositionsMinted`, `oracleTrades` |
| `predict::redeem` / `redeem_permissionless` | manager object, oracle object | `managerSummary`, `managerPositionsSummary`, `managerPnl`, `oracleState`, `vaultSummary`, `historyPositionsRedeemed`, `oracleTrades` |
| `predict::mint_range` | manager object, oracle object | `managerSummary`, `managerPositionsSummary`, `managerPnl`, `oracleState`, `oracleAskBounds`, `vaultSummary`, `historyRangesMinted`, `oracleTrades` |
| `predict::redeem_range` | manager object, oracle object | `managerSummary`, `managerPositionsSummary`, `managerPnl`, `oracleState`, `vaultSummary`, `historyRangesRedeemed`, `oracleTrades` |
| `predict::supply` | wallet dUSDC balance, wallet PLP coins | `vaultSummary`, `vaultPerformance`, `historyLpSupplies` |
| `predict::withdraw` | wallet dUSDC balance, wallet PLP coins | `vaultSummary`, `vaultPerformance`, `historyLpWithdrawals` |

Local freshness policy for PredictPilot:

- `status`: poll every 15–30s while app is open.
- active oracle state on trade screen: server poll every 3–5s in focus, plus live event updates for `OraclePricesUpdated` and `OracleSVIUpdated`.
- wallet balances: refetch on wallet/account/network change and after every confirmed write.
- manager summary/positions/PnL: refetch after every confirmed write and again with a short delayed retry because the Predict README warns server lag is low but not zero-lag. citeturn6view0turn11view4

### API adapter, mapper, and validation layer

PredictPilot should use a strict three-stage contract:

1. **Adapter layer**: fetch raw DTOs from Predict Server or Sui client.
2. **Validation layer**: validate raw DTOs with Zod.
3. **Mapper layer**: convert raw DTOs into stable PredictPilot domain models.

That pattern matches Mysten’s SDK guidance to build transport-agnostic SDKs over `ClientWithCoreApi`, and it avoids tying PredictPilot to JSON-RPC-only response shapes. citeturn43search2turn44view0

Recommended adapter function names:

```ts
// Local application code
fetchPredictServerStatus
fetchPredictStateDto
fetchPredictOraclesDto
fetchPredictQuoteAssetsDto
fetchOracleStateDto
fetchOracleAskBoundsDto
fetchVaultSummaryDto
fetchVaultPerformanceDto
fetchManagersDto
fetchManagerSummaryDto
fetchManagerPositionsSummaryDto
fetchManagerPnlDto
fetchOraclePricesDto
fetchOracleLatestPriceDto
fetchOracleSviDto
fetchOracleLatestSviDto
fetchPositionMintHistoryDto
fetchPositionRedeemHistoryDto
fetchRangeMintHistoryDto
fetchRangeRedeemHistoryDto
fetchLpSuppliesHistoryDto
fetchLpWithdrawalsHistoryDto
fetchOracleTradesDto

readPredictObject
readPredictManagerObject
readOracleObject
readVaultCriticalState
readWalletDusdcBalance
readWalletDusdcCoins
readWalletPlpCoins
simulatePredictTransaction
waitForPredictTransaction
```

Recommended mapper names:

```ts
// Local application code
mapPredictServerStatusDto
mapPredictStateDtoToModel
mapPredictOraclesDtoToModel
mapOracleStateDtoToModel
mapVaultSummaryDtoToModel
mapVaultPerformanceDtoToModel
mapManagerSummaryDtoToModel
mapManagerPositionsSummaryDtoToModel
mapManagerPnlDtoToModel
mapPredictManagerObjectToModel
mapOracleObjectToModel
mapSuiTransactionToPredictTransactionRecord
mapPredictEventToDomainEvent
```

### Error models and testing contracts

PredictPilot needs protocol-specific error classes and testable acceptance rules:

```ts
// Local application code
export type PredictPilotErrorCode =
  | 'WALLET_NOT_CONNECTED'
  | 'WRONG_NETWORK'
  | 'PREDICT_SERVER_UNHEALTHY'
  | 'EXTERNAL_API_SHAPE_CHANGED'
  | 'ONCHAIN_OBJECT_NOT_FOUND'
  | 'MANAGER_NOT_FOUND'
  | 'INSUFFICIENT_WALLET_DUSDC'
  | 'INSUFFICIENT_MANAGER_DUSDC'
  | 'ORACLE_NOT_TRADEABLE'
  | 'PTB_BUILD_FAILED'
  | 'SIMULATION_FAILED'
  | 'TRANSACTION_REJECTED'
  | 'TRANSACTION_FAILED'
  | 'POST_TX_REFRESH_FAILED'
  | 'TODO_VERIFY_PATH_USED';
```

Error-handling pattern:

```ts
// Local application code
type Result<T> =
  | { ok: true; data: T }
  | { ok: false; code: PredictPilotErrorCode; message: string; cause?: unknown };

function externalShapeError(endpoint: string, cause?: unknown): Result<never> {
  return {
    ok: false,
    code: 'EXTERNAL_API_SHAPE_CHANGED',
    message: `Unexpected response shape from ${endpoint}`,
    cause,
  };
}
```

Testing contracts:

- `/status` adapter must validate exact official fields against `PredictServerStatusSchema`. citeturn30view0
- all other Predict-server adapters must validate “object or array” and preserve unknown fields via `.passthrough()` until real payload fixtures are captured.
- mapper tests must use recorded real testnet payloads only.
- onchain object tests must parse `content` BCS, not transport-specific JSON, because Mysten docs warn JSON structure may vary between JSON-RPC, gRPC, and GraphQL. citeturn44view0
- PTB simulation tests must use `simulateTransaction` before wallet signing for preview-critical actions such as mint/redeem/supply/withdraw. Sui Core API explicitly supports simulation and command-result inspection. citeturn44view0

## Implementation examples

The following examples are **local PredictPilot application code**, designed to be stable even while the public Predict server schema remains only partially documented.

### Folder structure

```text
src/integrations/deepbook-predict/
  api.ts
  client.ts
  config.ts
  errors.ts
  events.ts
  index.ts
  mappers.ts
  queryKeys.ts
  refresh.ts
  schemas.ts
  types.ts
```

### Example local TypeScript interfaces

```ts
// Local application code
export interface PredictConfig {
  serverBaseUrl: string;
  network: 'testnet';
  packageId: ObjectId;
  registryId: ObjectId;
  predictObjectId: ObjectId;
  quoteAssetType: MoveType;
  quoteCurrencyId: ObjectId;
  plpType: MoveType;
}

export interface PredictServerEnvelope<T> {
  receivedAtMs: number;
  source: 'predict-server';
  data: T;
}

export interface OnchainEnvelope<T> {
  receivedAtMs: number;
  source: 'sui-onchain';
  data: T;
}
```

### Example local Zod schemas

```ts
// Local application code
import { z } from 'zod';

export const ObjectIdSchema = z.string().regex(/^0x[0-9a-fA-F]+$/);
export const SuiAddressSchema = ObjectIdSchema;
export const U64StringSchema = z.string().regex(/^\d+$/);
export const I64StringSchema = z.string().regex(/^-?\d+$/);

export const PredictServerStatusSchema = z.object({
  status: z.enum(['OK', 'UNHEALTHY']),
  latest_onchain_checkpoint: z.number().int().nonnegative(),
  current_time_ms: z.number().int().nonnegative(),
  earliest_checkpoint: z.number().int().nonnegative(),
  max_lag_pipeline: z.string(),
  pipelines: z.array(
    z.object({
      pipeline: z.string(),
      indexed_checkpoint: z.number().int().nonnegative(),
      indexed_epoch: z.number().int().nonnegative(),
      indexed_timestamp_ms: z.number().int().nonnegative(),
      checkpoint_lag: z.number().int().nonnegative(),
      time_lag_seconds: z.number().int().nonnegative(),
      latest_onchain_checkpoint: z.number().int().nonnegative(),
    }),
  ),
  max_checkpoint_lag: z.number().int().nonnegative(),
  max_time_lag_seconds: z.number().int().nonnegative(),
});

export const UnknownPredictObjectSchema = z.object({}).passthrough();
export const UnknownPredictListSchema = z.array(z.unknown());

export const PathPredictIdSchema = z.object({
  predictId: ObjectIdSchema,
});

export const PathOracleIdSchema = z.object({
  oracleId: ObjectIdSchema,
});

export const PathManagerIdSchema = z.object({
  managerId: ObjectIdSchema,
});

export const RangeQueryVerifiedSchema = z.object({
  range: z.literal('ALL'),
});
```

### Example query keys and adapter names

```ts
// Local application code
export async function fetchPredictStateDto(config: PredictConfig): Promise<PredictStateDto> {
  const res = await fetch(
    `${config.serverBaseUrl}/predicts/${config.predictObjectId}/state`,
  );
  const json = await res.json();
  return UnknownPredictObjectSchema.parse(json);
}

export async function fetchOracleStateDto(
  config: PredictConfig,
  oracleId: ObjectId,
): Promise<OracleStateDto> {
  const res = await fetch(`${config.serverBaseUrl}/oracles/${oracleId}/state`);
  const json = await res.json();
  return UnknownPredictObjectSchema.parse(json);
}
```

### Example error-handling patterns

```ts
// Local application code
export async function safeFetchStatus(baseUrl: string): Promise<Result<PredictServerStatusDto>> {
  try {
    const res = await fetch(`${baseUrl}/status`);
    const json = await res.json();
    return { ok: true, data: PredictServerStatusSchema.parse(json) };
  } catch (cause) {
    return externalShapeError('/status', cause);
  }
}

export function assertTestnet(network: string): Result<true> {
  if (network !== 'testnet') {
    return {
      ok: false,
      code: 'WRONG_NETWORK',
      message: 'DeepBook Predict current official public integration target is Testnet.',
    };
  }
  return { ok: true, data: true };
}
```

## Change management

DeepBook Predict is a moving Testnet integration surface. The docs explicitly say package IDs, object layouts, and entry points can change before Mainnet, and the current docs are sourced from the `predict-testnet-4-16` branch. PredictPilot must therefore assume iterative breaking changes and design the integration boundary accordingly. citeturn11view0turn2view6

### Breaking-change handling

PredictPilot must follow these contract rules:

- Keep all deployment identifiers in one config module.
- Keep all server DTO schemas in one validation module.
- Use `.passthrough()` for undocumented Predict-server responses so additive fields do not break the app.
- Fail closed when a mapper cannot derive a required field for a transaction-critical screen.
- Prefer onchain reads and transaction results over server values for anything the wallet is about to spend or mutate.
- Use `Transaction` objects and wallet `signTransaction` / `signAndExecuteTransaction` flows exactly as current Sui wallet integration docs require; Sui docs explicitly say the app should provide a `Transaction` class, and recommend `serialize()` for wallet handoff rather than building PTB bytes in app code. citeturn39view7turn39view5
- Parse onchain objects from BCS `content` rather than the JSON include shape when exact field layout matters, because Core API docs warn JSON structure can vary across transports. citeturn44view0

### TODO VERIFY

The following items were **not** verified from official public docs or repository materials during this research pass and must remain `TODO VERIFY` in code and documentation until captured from a real official testnet response or source file:

- exact JSON response fields for every Predict-server route except `/status`
- whether `/managers` supports an owner filter, and the exact query-param name
- all pagination, cursor, sorting, `limit`, and time-filter query params for history endpoints
- all accepted `range` enum values beyond the publicly documented example `ALL`
- exact field names returned by `/oracles/:oracle_id/ask-bounds`
- exact field names returned by `/predicts/:predict_id/state`, `/predicts/:predict_id/oracles`, `/oracles/:oracle_id/state`, `/predicts/:predict_id/vault/summary`, `/managers/:manager_id/summary`, `/managers/:manager_id/positions/summary`, and `/managers/:manager_id/pnl`
- exact schema and semantics of `/trades/:oracle_id`
- whether Predict-server emits integers as JSON numbers or strings on all routes
- whether there is an official Predict websocket or SSE API, or whether low-latency updates should always be sourced from Sui checkpoint/event streaming
- any official OpenAPI schema for Predict-server
- any official generated TypeScript SDK specifically for Predict-server responses

### Final API checklist

PredictPilot’s API/data contract layer is only “done” when all of the following are true:

- a single config module contains the verified Testnet package ID, registry ID, Predict object ID, dUSDC type, dUSDC currency ID, PLP type, server base URL, and source branch citeturn11view0turn6view0
- all documented Predict-server routes exist in `api.ts` as explicit adapter functions citeturn11view1turn11view3turn11view4
- `/status` has an exact runtime schema matching the official server README citeturn30view0
- undocumented Predict-server routes use permissive raw schemas plus strict mappers
- wallet connection, account restoration, and transaction execution use Sui Wallet Standard and/or Sui dApp Kit, not custom wallet glue citeturn39view4turn41view2
- object reads rely on `client.core` and use `content` + BCS parsing for transaction-critical objects citeturn44view0
- PTB submission uses `Transaction` objects, not ad hoc serialized bytes built in UI code citeturn39view1turn39view7
- event models exist for `PredictManagerCreated`, binary/range mint/redeem, LP supply/withdraw, and oracle lifecycle/update events citeturn7view0turn23view3turn20view0turn8view3
- query keys and invalidation rules are protocol-specific and do not use generic “market”, “bet”, or “order” abstractions
- the app does **not** model positions or ranges as standalone NFTs or separate wallet-owned objects, because the protocol stores them inside `PredictManager` tables citeturn3view0turn37search1
- all unknown external fields remain tagged `TODO VERIFY`
- all mock fixtures come from captured real official testnet payloads, never invented generic prediction-market JSON