# PredictPilot Environment Setup

This file defines the local, testnet, testing, and deployment environment for PredictPilot on macOS. It is written for a Sui Testnet first workflow because DeepBook Predict is currently documented as a Testnet integration surface, with the public integration targets pinned to the `predict-testnet-4-16` branch and explicitly marked provisional until Mainnet launch. citeturn4view5turn5view0turn10view0

PredictPilot should follow a config driven setup. Do not hardcode package IDs, object IDs, coin types, or server URLs inside UI components or transaction builders. DeepBook Predict’s current package IDs and entry points can change before Mainnet, so all integration constants must live in environment files and typed config modules. citeturn5view0turn4view5

This guide assumes an Apple Silicon macOS machine, including a MacBook Air M2, a Node plus pnpm JavaScript toolchain, a React based frontend, Sui wallet integration through the Sui Wallet Standard, and Sui Testnet as the only supported execution network for the current hackathon build. Browser extension wallets on Sui use the Wallet Standard, and Mysten’s dApp Kit is the supported path for wallet connection and client management. citeturn16view0turn16view5turn7view4

Where a value is not verified from official DeepBook Predict or Sui documentation, this file marks it as `TODO VERIFY`. That applies in particular to app chosen defaults such as a featured oracle or a featured market, because those are product selections, not protocol wide constants. citeturn5view0turn5view1

## Setup policy and supported environment

### Who this guide is for

This guide is for three audiences: you as the primary builder and demo operator, Codex as the implementation agent, and any teammate who needs a clean and repeatable PredictPilot setup. The goal is the same for all three: identical local commands, identical config file names, and a single source of truth for Testnet constants. citeturn15view2turn15view3

### Supported operating system

The supported setup target is macOS on Apple Silicon. The practical expectation is a recent macOS version with Terminal access, Chrome or Brave for browser wallet testing, and enough free disk space for Node dependencies, Playwright browser binaries, and one or more wallet profiles. Playwright officially supports macOS for local and CI runs. citeturn15view0

### Required accounts

Prepare these accounts before coding or demo rehearsal:

- GitHub, for source control and Actions CI. GitHub Actions provides the standard Node.js build and test workflow path. citeturn15view2
- Vercel, if you deploy the frontend there. Vercel can detect the package manager from the lockfile and or `packageManager` field. citeturn15view3turn15view4
- A Sui wallet, preferably Slush as the primary demo wallet because it is Mysten’s official Sui wallet, with Phantom as an additional compatibility wallet if you want cross wallet validation. citeturn16view1turn16view2
- Access to the official Sui faucet for Testnet SUI gas. SUI on Testnet is free and intended for development. citeturn7view1
- Access to the official DeepBook Predict Testnet token request form for DUSDC and other test assets. DeepBook Predict docs explicitly direct builders to that form. citeturn4view5

### Required tools

Use this toolchain baseline:

- Node.js: use current LTS, recommended local baseline `24.x LTS`. Node’s official downloads page shows `24.16.0` as the latest LTS at the time of research. citeturn9search15turn9search17
- pnpm: pin `10.x` in the repository, not `11.x`, because Vercel’s package manager support page currently documents pnpm support through version 10, while pnpm’s own install docs recommend Corepack and require Node 22 or newer when not using the standalone installer. citeturn15view3turn15view5
- Sui CLI: use the latest stable Sui CLI available when you set up the machine. Sui docs explicitly recommend installing the latest version and upgrading stale installs. Use `sui --version` to verify. Exact patch pin: `TODO VERIFY`. citeturn18search11turn6search4
- Git: use a current stable Git version and verify with `git --version`. Exact minimum version: `TODO VERIFY`.
- Vercel CLI, if deploying from terminal: `pnpm i -g vercel`. citeturn15view4

### Required CLI tools and browser extensions

Install or verify these:

```bash
node -v
npm -v
git --version
sui --version
pnpm --version
```

These verification commands correspond to the official toolchains referenced by Node, pnpm, and Sui documentation. citeturn9search13turn15view5turn6search4

For the wallet environment, install at least one browser extension wallet that supports the Sui Wallet Standard. Slush is the official Sui wallet built by Mysten Labs and is available as a Chrome extension. Phantom also supports connecting to Sui apps through the Wallet Standard. citeturn16view1turn16view2turn16view0

## Toolchain bootstrap on macOS

### Fresh machine setup path

Use this path on a clean Mac.

```bash
# verify Node after installing the official LTS build
node -v

# enable Corepack and pin pnpm for this repo
npm install --global corepack@latest
corepack enable pnpm
corepack use pnpm@10

# verify pnpm
pnpm --version

# install Sui CLI on macOS if needed
brew install sui

# verify Sui CLI
sui --version
```

Sui docs list `brew install sui` for macOS quick install and recommend verifying with `sui --version`. pnpm docs recommend updating Corepack first, then enabling pnpm, and note that Corepack can pin the package manager in `package.json`. Vercel currently documents pnpm support through version 10, which is why this guide pins `10.x` rather than jumping to `11.x`. citeturn18search11turn15view5turn15view3

If Homebrew is not already installed on your Mac, install Homebrew first using its official instructions. That specific step is outside the DeepBook Predict or Sui documentation surface, so keep it as a standard macOS prerequisite.

### Required repository files to create or edit

Codex should create or maintain these files exactly:

```text
.nvmrc
package.json
.env.example
.env.local
.env.test
.env.production
src/config/env.ts
src/config/networks.ts
src/config/deepbookPredict.ts
src/lib/sui/client.ts
playwright.config.ts
vitest.config.ts
.github/workflows/ci.yml
```

The reason for splitting config this way is simple: DeepBook Predict currently relies on a provisional Testnet deployment, the public server should be the primary indexed data path, and direct onchain reads should be isolated to explicit wallet flows and confirmation critical logic. citeturn5view0turn5view1turn5view2

### Clone instructions and branch setup

Use this exact terminal flow on macOS:

```bash
git clone TODO_VERIFY_REPO_URL predictpilot
cd predictpilot
git checkout -b feat/setup-testnet-environment
```

Use a feature branch for environment work so Codex changes stay reviewable and reversible. The exact repository URL is intentionally left as `TODO VERIFY` because it is not available from the official public sources reviewed here.

### Node and package manager pinning

Create `.nvmrc` with this content:

```text
24
```

In `package.json`, pin the package manager:

```json
{
  "packageManager": "pnpm@10"
}
```

Node 24 is the current official LTS at the time of research, and Vercel uses the lockfile and or `packageManager` field to determine install behavior. citeturn9search15turn15view3

### Dependency installation

After cloning and pinning the package manager:

```bash
pnpm install
```

For the frontend and Sui integration layer, the official package families are `@mysten/dapp-kit-react` plus `@mysten/sui` for React applications. citeturn7view4turn7view5

If the repo uses Next.js, the official dApp Kit setup path includes a dApp Kit instance and a client side provider wrapper because wallet detection must happen in the browser. citeturn7view5turn6search7

## Environment files and verified Testnet configuration

### Environment variable design rules

Use these rules everywhere:

1. Public, non secret values go in `NEXT_PUBLIC_*`.
2. Secrets live only in `.env.local`, CI secret stores, or deployment secret managers.
3. User specific runtime objects, such as a created `PredictManager`, must not be committed into `.env.example`.
4. The app may reuse the env name `NEXT_PUBLIC_SUI_RPC_URL`, but the actual recommended Sui client transport is gRPC, not legacy JSON RPC, because the Sui TypeScript SDK now recommends `SuiGrpcClient` and marks `SuiJsonRpcClient` deprecated. citeturn16view3turn16view5

### `.env.example`

Create `.env.example` with this content:

```bash
NEXT_PUBLIC_SUI_NETWORK=testnet
NEXT_PUBLIC_SUI_RPC_URL=https://fullnode.testnet.sui.io:443
NEXT_PUBLIC_PREDICT_SERVER_URL=https://predict-server.testnet.mystenlabs.com

NEXT_PUBLIC_PREDICT_PACKAGE_ID=0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138
NEXT_PUBLIC_PREDICT_REGISTRY_ID=0x43af14fed5480c20ff77e2263d5f794c35b9fab7e2212903127062f4fe2a6e64
NEXT_PUBLIC_PREDICT_OBJECT_ID=0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a

NEXT_PUBLIC_DUSDC_COIN_TYPE=0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC
NEXT_PUBLIC_DUSDC_CURRENCY_ID=0xf3000dff421833d4bb8ed58fac146d691a3aaba2785aa1989af65a7089ca3e9c
NEXT_PUBLIC_PLP_COIN_TYPE=0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138::plp::PLP

NEXT_PUBLIC_DEFAULT_ORACLE_ID=TODO_VERIFY
NEXT_PUBLIC_DEFAULT_MARKET_ID=TODO_VERIFY
NEXT_PUBLIC_SUI_EXPLORER_URL=https://explorer.sui.io

TESTNET_PRIVATE_KEY=
TESTNET_WALLET_ADDRESS=
E2E_BASE_URL=http://localhost:3000
PLAYWRIGHT_HEADLESS=true
```

The package ID, registry ID, Predict object ID, DUSDC coin type, DUSDC currency ID, PLP coin type, and public server URL above are the current public DeepBook Predict Testnet integration targets documented by Sui’s DeepBook Predict contract information. The official Sui Explorer base URL is `https://explorer.sui.io`. citeturn5view0turn11search2

### `.env.local`

Use `.env.local` for local development only. It should contain the same public defaults plus any local secret material needed for script based PTB testing, never a real wallet you care about.

```bash
NEXT_PUBLIC_SUI_NETWORK=testnet
NEXT_PUBLIC_SUI_RPC_URL=https://fullnode.testnet.sui.io:443
NEXT_PUBLIC_PREDICT_SERVER_URL=https://predict-server.testnet.mystenlabs.com
NEXT_PUBLIC_PREDICT_PACKAGE_ID=0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138
NEXT_PUBLIC_PREDICT_REGISTRY_ID=0x43af14fed5480c20ff77e2263d5f794c35b9fab7e2212903127062f4fe2a6e64
NEXT_PUBLIC_PREDICT_OBJECT_ID=0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a
NEXT_PUBLIC_DUSDC_COIN_TYPE=0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC
NEXT_PUBLIC_DUSDC_CURRENCY_ID=0xf3000dff421833d4bb8ed58fac146d691a3aaba2785aa1989af65a7089ca3e9c
NEXT_PUBLIC_PLP_COIN_TYPE=0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138::plp::PLP
NEXT_PUBLIC_DEFAULT_ORACLE_ID=TODO_VERIFY
NEXT_PUBLIC_DEFAULT_MARKET_ID=TODO_VERIFY
NEXT_PUBLIC_SUI_EXPLORER_URL=https://explorer.sui.io

# burner wallet only
TESTNET_PRIVATE_KEY=TODO_VERIFY_BURNER_PRIVATE_KEY
TESTNET_WALLET_ADDRESS=TODO_VERIFY_BURNER_ADDRESS

E2E_BASE_URL=http://localhost:3000
PLAYWRIGHT_HEADLESS=false
```

The Sui TypeScript SDK recommends `SuiGrpcClient` as the default client, and dApp Kit examples use the Testnet fullnode `https://fullnode.testnet.sui.io:443`. DeepBook Predict docs explicitly say the public server should be used for render ready data, with direct onchain reads reserved for confirmation critical wallet flows. citeturn16view3turn16view5turn5view1turn5view2

### `.env.test`

Use `.env.test` for automated integration and Playwright runs. Keep it deterministic and separate from your personal wallet:

```bash
NEXT_PUBLIC_SUI_NETWORK=testnet
NEXT_PUBLIC_SUI_RPC_URL=https://fullnode.testnet.sui.io:443
NEXT_PUBLIC_PREDICT_SERVER_URL=https://predict-server.testnet.mystenlabs.com
NEXT_PUBLIC_PREDICT_PACKAGE_ID=0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138
NEXT_PUBLIC_PREDICT_REGISTRY_ID=0x43af14fed5480c20ff77e2263d5f794c35b9fab7e2212903127062f4fe2a6e64
NEXT_PUBLIC_PREDICT_OBJECT_ID=0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a
NEXT_PUBLIC_DUSDC_COIN_TYPE=0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC
NEXT_PUBLIC_DUSDC_CURRENCY_ID=0xf3000dff421833d4bb8ed58fac146d691a3aaba2785aa1989af65a7089ca3e9c
NEXT_PUBLIC_PLP_COIN_TYPE=0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138::plp::PLP
NEXT_PUBLIC_DEFAULT_ORACLE_ID=TODO_VERIFY
NEXT_PUBLIC_DEFAULT_MARKET_ID=TODO_VERIFY
NEXT_PUBLIC_SUI_EXPLORER_URL=https://explorer.sui.io

TESTNET_PRIVATE_KEY=TODO_VERIFY_CI_BURNER_KEY
TESTNET_WALLET_ADDRESS=TODO_VERIFY_CI_BURNER_ADDRESS

E2E_BASE_URL=http://localhost:3000
PLAYWRIGHT_HEADLESS=true
```

For PredictPilot, `.env.test` is allowed to target Testnet because DeepBook Predict’s current public integration target is Testnet, and the product’s key proof is real Testnet execution rather than a local mock only demo. citeturn4view5turn5view0

### `.env.production`

If you deploy a public hackathon demo site that still interacts with Testnet, production can still point to Testnet values while keeping all private keys out of runtime:

```bash
NEXT_PUBLIC_SUI_NETWORK=testnet
NEXT_PUBLIC_SUI_RPC_URL=https://fullnode.testnet.sui.io:443
NEXT_PUBLIC_PREDICT_SERVER_URL=https://predict-server.testnet.mystenlabs.com
NEXT_PUBLIC_PREDICT_PACKAGE_ID=0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138
NEXT_PUBLIC_PREDICT_REGISTRY_ID=0x43af14fed5480c20ff77e2263d5f794c35b9fab7e2212903127062f4fe2a6e64
NEXT_PUBLIC_PREDICT_OBJECT_ID=0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a
NEXT_PUBLIC_DUSDC_COIN_TYPE=0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC
NEXT_PUBLIC_DUSDC_CURRENCY_ID=0xf3000dff421833d4bb8ed58fac146d691a3aaba2785aa1989af65a7089ca3e9c
NEXT_PUBLIC_PLP_COIN_TYPE=0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138::plp::PLP
NEXT_PUBLIC_DEFAULT_ORACLE_ID=TODO_VERIFY
NEXT_PUBLIC_DEFAULT_MARKET_ID=TODO_VERIFY
NEXT_PUBLIC_SUI_EXPLORER_URL=https://explorer.sui.io
E2E_BASE_URL=https://TODO_VERIFY_DEPLOYMENT_URL
PLAYWRIGHT_HEADLESS=true
```

Do not ship `TESTNET_PRIVATE_KEY` to the frontend. Wallet initiated signing belongs in the user’s wallet. Backend or CI burner keys, if any, must stay in secret stores only. Sui docs warn to store recovery phrases securely and never share them. citeturn7view0turn16view1

### Typed config modules

Create `src/config/deepbookPredict.ts` and `src/config/env.ts` so every DeepBook Predict value is loaded once and validated at startup. Use Zod if your repo standard already includes it.

A practical pattern is:

```ts
// src/config/deepbookPredict.ts
export const deepbookPredictConfig = {
  network: process.env.NEXT_PUBLIC_SUI_NETWORK!,
  fullnodeUrl: process.env.NEXT_PUBLIC_SUI_RPC_URL!,
  predictServerUrl: process.env.NEXT_PUBLIC_PREDICT_SERVER_URL!,
  predictPackageId: process.env.NEXT_PUBLIC_PREDICT_PACKAGE_ID!,
  predictRegistryId: process.env.NEXT_PUBLIC_PREDICT_REGISTRY_ID!,
  predictObjectId: process.env.NEXT_PUBLIC_PREDICT_OBJECT_ID!,
  dusdcCoinType: process.env.NEXT_PUBLIC_DUSDC_COIN_TYPE!,
  dusdcCurrencyId: process.env.NEXT_PUBLIC_DUSDC_CURRENCY_ID!,
  plpCoinType: process.env.NEXT_PUBLIC_PLP_COIN_TYPE!,
  defaultOracleId: process.env.NEXT_PUBLIC_DEFAULT_ORACLE_ID!,
  defaultMarketId: process.env.NEXT_PUBLIC_DEFAULT_MARKET_ID!,
  explorerUrl: process.env.NEXT_PUBLIC_SUI_EXPLORER_URL!,
} as const;
```

This is local application code, not a protocol source excerpt. It implements the config separation that DeepBook Predict documentation strongly implies by marking deployment values provisional and by separating indexed server reads from direct chain reads. citeturn5view0turn5view1turn5view2

## Sui Testnet, wallet, DUSDC, and protocol verification

### Configure the Sui client

Run:

```bash
sui client
sui client active-env
sui client active-address
```

On first run, Sui creates `~/.sui/sui_config/client.yaml`, stores the active environment there, and stores keys in `~/.sui/sui_config/sui.keystore`. Sui docs show that the initial CLI setup defaults to Testnet if you accept the default endpoint. citeturn7view0turn7view2

If you need to switch back to Testnet:

```bash
sui client switch --env testnet
sui client active-env
```

The Sui CLI cheat sheet documents both `sui client active-env` and `sui client switch --env ENV_ALIAS`, and Sui troubleshooting docs explicitly show `sui client switch --env testnet` as the fix for using the wrong network. citeturn18search0turn18search7

### Testnet SUI funding setup

Use either the online faucet or terminal methods:

```bash
sui client faucet
sui client balance
```

Or use the documented cURL path:

```bash
ADDRESS=$(sui client active-address)
NETWORK=testnet
curl --location --request POST "https://faucet.${NETWORK}.sui.io/v2/gas" \
  --header "Content-Type: application/json" \
  --data-raw "{
    \"FixedAmountRequest\": {
      \"recipient\": \"${ADDRESS}\"
    }
  }"
```

Sui docs state that Testnet SUI is free, that the online faucet supports Testnet, and that `sui client balance` is the canonical balance verification command. They also document the direct cURL faucet request format. citeturn7view1turn18search0

### Wallet setup

For browser based signing, install Slush first. Slush is the official Sui wallet built by Mysten Labs and works automatically through the Wallet Standard. Phantom is a valid second wallet for compatibility checks because it also supports Sui app connections through the Wallet Standard. citeturn16view1turn16view2turn16view0

For PredictPilot demo and testing, use three wallets:

- a personal wallet for manual exploration only
- a dedicated burner demo wallet for live judge flows
- a separate burner automation wallet for CI, Playwright, or backend script tests

This separation is a best practice inference based on Sui’s recovery phrase security model and the fact that PredictPilot needs repeatable testnet execution without risking your personal funds or cluttering your real wallet state. citeturn7view0turn16view1

### DUSDC funding setup

DeepBook Predict documentation states that builders can request Testnet tokens, including DUSDC, using the official DeepBook Predict Testnet token request form. There is no verified public faucet flow in the reviewed official docs for DUSDC equal to the standard SUI faucet flow, so your DUSDC acquisition process should be treated as manual and pre planned. citeturn4view5

Use this policy:

- request DUSDC early
- fund the burner demo wallet, not a personal wallet
- do not schedule demo recording until DUSDC is visible in the chosen wallet
- keep a reserve amount for repeated mint, redeem, supply, and withdraw rehearsals

### PredictManager, oracle, and vault setup

Do not set `PredictManager` as a committed environment variable. DeepBook Predict docs say each user creates one manager and reuses it, and that binary positions and vertical ranges live inside that manager rather than as separate onchain objects. That makes the manager a per user runtime object, not a repo constant. citeturn4view2turn5view2

Similarly, do not invent a static vault object ID or a default oracle ID unless the current deployment docs or your chosen demo market explicitly verify it. For now:

- `NEXT_PUBLIC_DEFAULT_ORACLE_ID=TODO_VERIFY`
- `NEXT_PUBLIC_DEFAULT_MARKET_ID=TODO_VERIFY`

Discover valid oracles via the public server, then lock one after manual validation:

```bash
curl https://predict-server.testnet.mystenlabs.com/status
curl https://predict-server.testnet.mystenlabs.com/predicts/0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a/oracles
curl https://predict-server.testnet.mystenlabs.com/predicts/0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a/state
```

These are official DeepBook Predict public server endpoints, documented for protocol state and oracle discovery. citeturn5view0turn10view0

### Config verification checklist

Before any coding session, verify these values in order:

```bash
sui client active-env
sui client active-address
sui client balance

curl https://predict-server.testnet.mystenlabs.com/status
curl https://predict-server.testnet.mystenlabs.com/predicts/0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a/state
curl https://predict-server.testnet.mystenlabs.com/predicts/0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a/quote-assets
```

Use the public server for render ready state and quote asset validation. DeepBook Predict specifically recommends the public server for market lists, portfolio summaries, vault summaries, and history, while keeping onchain reads for confirmation critical flows. citeturn5view1turn5view2turn10view0

## Local development, PTB testing, CI, and deployment

### Daily development startup path

Use this workflow every day:

```bash
git pull
pnpm install
pnpm dev
```

In a second terminal, keep these available:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:unit
pnpm test:integration
pnpm test:ptb
pnpm test:e2e
```

These script names should be treated as repository contracts for Codex and CI. Even if the internal implementation changes, keep the command names stable.

### Sui client and dApp Kit setup

For the frontend, create the Sui client through dApp Kit and point it at Testnet. The official dApp Kit instance docs and Next.js docs both show `createDAppKit` with `SuiGrpcClient` and the Testnet fullnode `https://fullnode.testnet.sui.io:443`. citeturn16view5turn7view5

A recommended local module layout is:

```text
src/lib/sui/client.ts
src/lib/sui/dapp-kit.ts
src/lib/sui/explorer.ts
src/config/deepbookPredict.ts
```

Use `src/lib/sui/client.ts` for low level client creation, `src/lib/sui/dapp-kit.ts` for wallet provider bootstrapping, and `src/config/deepbookPredict.ts` for protocol constants.

### PTB testing and transaction simulation

PredictPilot should preview or simulate transactions before submit. Sui’s current TypeScript SDK documents `simulateTransaction` for dry runs, gas estimation, return values, and validation before execution. The Sui CLI PTB docs also document `sui client ptb --preview` for PTB inspection without execution. citeturn16view4turn1search13

For local PTB validation, keep both a TypeScript path and a CLI path:

```bash
pnpm test:ptb
sui client ptb --help
```

For app logic, prefer TypeScript simulation in the UI or integration layer. For raw operator debugging, keep CLI PTB preview available.

### Unit, integration, and E2E setup

Install Playwright browsers once per machine:

```bash
pnpm playwright install
```

Playwright supports macOS and is intended for local and CI browser testing. Vitest is a modern test framework commonly paired with Vite based toolchains and is suitable for the unit and integration layers in PredictPilot. citeturn15view0turn15view1

A practical script contract is:

```json
{
  "scripts": {
    "dev": "TODO VERIFY",
    "build": "TODO VERIFY",
    "lint": "TODO VERIFY",
    "typecheck": "TODO VERIFY",
    "test": "vitest run",
    "test:unit": "vitest run src/tests/unit",
    "test:integration": "vitest run src/tests/integration",
    "test:ptb": "vitest run src/tests/ptb",
    "test:e2e": "playwright test"
  }
}
```

This script block is local repository guidance. Adjust the exact `dev`, `build`, `lint`, and `typecheck` commands to match your chosen frontend framework.

### GitHub Actions setup

Create `.github/workflows/ci.yml` and keep the pipeline minimal but strict:

```yaml
name: ci

on:
  push:
  pull_request:

jobs:
  build-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm

      - name: Enable Corepack
        run: |
          npm install --global corepack@latest
          corepack enable pnpm
          corepack use pnpm@10

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Lint
        run: pnpm lint

      - name: Typecheck
        run: pnpm typecheck

      - name: Unit and integration tests
        run: pnpm test

      - name: Build
        run: pnpm build
```

GitHub Docs provide the standard Node.js build and test workflow pattern, and the Vercel package manager docs make it important to keep pnpm pinned consistently across local and CI environments. citeturn15view2turn15view3

If you later add Playwright to CI, add a second job that installs browser dependencies and runs `pnpm test:e2e` against a preview deployment or a local server.

### Vercel deployment setup

Install and verify Vercel CLI locally if you use terminal based deployment:

```bash
pnpm i -g vercel
vercel --version
```

Vercel documents both commands, and also documents that package manager detection comes from the lockfile and or `packageManager` field. citeturn15view4turn15view3

For deployment, use this rule set:

- store all `NEXT_PUBLIC_*` values in Vercel project environment variables
- never store burner private keys in client side runtime
- if you need a CI deployment token, use Vercel’s token based CI authentication
- if using a monorepo, confirm the Vercel root directory points to the actual frontend app directory

Vercel’s docs explicitly cover CLI token authentication for CI and package manager detection behavior. citeturn15view4turn15view3

### Production deployment notes

If the public demo remains on Testnet, say that clearly in the app and docs. DeepBook Predict is documented today as a Testnet integration surface, and its current deployment identifiers are provisional. PredictPilot should present this honestly instead of pretending to be a Mainnet product. citeturn4view5turn5view0

## Demo readiness, troubleshooting, and security

### Demo environment setup

For demo day, prepare the environment in this order:

1. Confirm the deployed app points to Testnet.
2. Confirm the wallet browser profile contains only the burner demo wallet.
3. Confirm the burner demo wallet has Testnet SUI for gas.
4. Confirm the wallet also holds DUSDC.
5. Confirm the chosen manager already exists or that manager creation has been rehearsed.
6. Confirm a target oracle has fresh data from the server and is not stale.
7. Confirm one full mint or supply flow succeeds before recording.
8. Confirm the explorer link pattern opens correctly from the app.

This order follows DeepBook Predict’s documented user flow, which starts with public server market data, then manager creation or discovery, quote asset deposit, preview, transaction execution, and post confirmation refresh. citeturn5view1turn4view5

### Demo day setup path

Use this exact terminal path on the morning of the demo:

```bash
git pull
pnpm install
pnpm build
pnpm test:integration
pnpm test:ptb
pnpm dev
```

In another terminal:

```bash
sui client active-env
sui client active-address
sui client balance
curl https://predict-server.testnet.mystenlabs.com/status
curl https://predict-server.testnet.mystenlabs.com/predicts/0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a/state
```

This catches the most common failures early: wrong network, empty gas wallet, server outage, or stale local dependencies. The server status and Predict state endpoints are officially documented. citeturn5view0turn18search0turn17view3

### Post transaction verification steps

After any mint, redeem, supply, or withdraw demo action:

- capture the wallet transaction digest
- open the digest in the Sui Explorer
- refresh the current portfolio and history server endpoints
- verify that the UI reflects the new balance, position quantity, or PLP balance

DeepBook Predict’s recommended integration model is to refresh both the relevant onchain objects and the indexed server endpoints after confirmation. The public server exposes manager summary, positions summary, PnL, history, LP supply, and LP withdraw endpoints for exactly this kind of refresh. citeturn5view1turn5view0

### Sui Explorer verification steps

The official explorer base URL is:

```bash
https://explorer.sui.io
```

Use it to verify transaction digests, shared object IDs, and address state. Keep your app’s explorer URL builder in one file, for example `src/lib/sui/explorer.ts`, so links cannot drift between environments. citeturn11search2

### Common setup errors

If `sui --version` fails, the CLI is not installed correctly or is not on your `PATH`. Sui’s installation docs say this explicitly and tell you to verify the binaries directory is in your `PATH`. citeturn18search11

If `sui client active-env` is not `testnet`, switch it:

```bash
sui client switch --env testnet
```

The Sui CLI cheat sheet and Sui troubleshooting docs both document this exact fix. citeturn18search0turn18search7

If Predict endpoints return errors, check `/status` first. If the public server is degraded, fall back to direct onchain reads only for confirmation critical actions and avoid loading the entire UI from raw chain scans. That fallback strategy is directly aligned with DeepBook Predict’s documented data flow model. citeturn5view0turn5view2

If DUSDC is missing, do not improvise a fake local token and do not swap in a different quote asset. The current documented quote asset for the public DeepBook Predict Testnet deployment is DUSDC, with the specific coin type and currency ID listed in contract information. Use the official token request path instead. citeturn5view0

If the wallet is not detected in browser, confirm that the wallet extension is installed, unlocked, and operating through the Wallet Standard compatible browser context. Sui browser extension wallets use the Wallet Standard, and dApp Kit is designed to discover them automatically. citeturn16view0turn7view4

### Security notes and secrets handling

Never commit any of the following:

```text
.env.local
.env.test
.env.production
TESTNET_PRIVATE_KEY values
wallet recovery phrases
~/.sui/sui_config/client.yaml
~/.sui/sui_config/sui.keystore
playwright auth state files with real wallets
Vercel deployment tokens
```

Sui docs explicitly warn that recovery phrases provide access to owned objects and tokens and must be stored securely and never shared. Vercel docs explicitly describe token based authentication for CI, which means those tokens must be treated as secrets. citeturn7view0turn15view4

For PredictPilot specifically, also never commit a personal wallet private key for automated PTB tests. If script based execution is needed, use a burner Testnet wallet only, and keep that key in local env files or CI secret managers.

### Final environment readiness checklist

Use this as the final pass before handing the repo to Codex or recording the demo.

```text
[ ] macOS machine verified
[ ] Node 24.x LTS installed
[ ] pnpm 10.x pinned through Corepack
[ ] Sui CLI installed and verified
[ ] Testnet is active in Sui CLI
[ ] Burner demo wallet created
[ ] Burner automation wallet created
[ ] Testnet SUI funded
[ ] DUSDC requested and received
[ ] .env.example created
[ ] .env.local created
[ ] .env.test created
[ ] .env.production created
[ ] src/config/env.ts created
[ ] src/config/networks.ts created
[ ] src/config/deepbookPredict.ts created
[ ] src/lib/sui/client.ts created
[ ] Predict package ID verified
[ ] Predict registry ID verified
[ ] Predict object ID verified
[ ] DUSDC coin type verified
[ ] DUSDC currency ID verified
[ ] PLP coin type verified
[ ] default oracle ID manually validated or left as TODO VERIFY
[ ] default market ID manually validated or left as TODO VERIFY
[ ] public server /status verified
[ ] public server predict state verified
[ ] public server oracle list verified
[ ] wallet connection works in browser
[ ] pnpm dev works
[ ] pnpm build works
[ ] pnpm lint works
[ ] pnpm typecheck works
[ ] pnpm test works
[ ] pnpm playwright install completed
[ ] .github/workflows/ci.yml added
[ ] Vercel envs configured if deploying
[ ] no secrets committed
```

If every checkbox above is true, the environment is ready for PredictPilot implementation, real Testnet integration, testing, and hackathon demo rehearsal. The list reflects the currently documented DeepBook Predict Testnet deployment, the Sui client setup model, the public server integration model, and the Node plus pnpm plus CI deployment path documented by the official tool providers. citeturn5view0turn5view1turn7view0turn7view1turn16view3turn15view2turn15view3turn15view4