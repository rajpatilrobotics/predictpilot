# PredictPilot Deployment Runbook

## Goal

Deploy PredictPilot as a static Vite frontend for the Sui Testnet DeepBook Predict demo. The app should call the public Predict server and Sui Testnet directly from the browser. Do not add a custom backend for the hackathon deployment path.

## Deployment Target

Primary target: Vercel static frontend deployment.

Fallback target: any static host that can serve the Vite `dist/` folder and route unknown paths back to `index.html`.

Recommended settings:

| Setting | Value |
| --- | --- |
| Root directory | repository root |
| Node.js | `24` |
| Package manager | `pnpm@10.34.3` |
| Install command | `corepack enable && corepack prepare pnpm@10.34.3 --activate && pnpm install --frozen-lockfile` |
| Build command | `pnpm build` |
| Output directory | `dist` |
| Framework preset | Vite |

## Environment Variables

Use the values from `.env.example` unless the official DeepBook Predict Testnet contract page has newer verified values.

Browser runtime variables:

```bash
VITE_SUI_NETWORK=testnet
VITE_SUI_GRPC_URL=https://fullnode.testnet.sui.io:443
VITE_PREDICT_SERVER_URL=https://predict-server.testnet.mystenlabs.com

VITE_PREDICT_PACKAGE_ID=0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138
VITE_PREDICT_REGISTRY_ID=0x43af14fed5480c20ff77e2263d5f794c35b9fab7e2212903127062f4fe2a6e64
VITE_PREDICT_OBJECT_ID=0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a

VITE_PREDICT_QUOTE_TYPE=0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC
VITE_PREDICT_QUOTE_CURRENCY_ID=0xf3000dff421833d4bb8ed58fac146d691a3aaba2785aa1989af65a7089ca3e9c
VITE_PREDICT_QUOTE_DECIMALS=6
VITE_PLP_TYPE=0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138::plp::PLP

VITE_DEFAULT_ORACLE_ID=TODO_VERIFY
VITE_DEFAULT_MARKET_ID=TODO_VERIFY
VITE_SUI_EXPLORER_URL=https://explorer.sui.io
VITE_ENABLE_JUDGE_MODE=true
```

Test-only variables:

```bash
E2E_BASE_URL=https://your-preview-url.example
PLAYWRIGHT_HEADLESS=true
```

Do not add secrets, private keys, seed phrases, wallet backups, cookies, or Playwright auth state to Vercel or to the repository. This is a static app and should not need secret runtime values.

## Vercel Steps

1. Import the GitHub repository into Vercel.
2. Set the root directory to the repository root.
3. Confirm the build command is `pnpm build`.
4. Confirm the output directory is `dist`.
5. Add the `VITE_*` environment variables listed above.
6. Deploy a preview build.
7. Open the preview URL and confirm the app shows Sui Testnet and the wallet area.

`vercel.json` keeps client-side routes working on page refresh by rewriting all route paths to `index.html`.

## Static Host Fallback

For any non-Vercel static host:

```bash
corepack enable
corepack prepare pnpm@10.34.3 --activate
pnpm install --frozen-lockfile
pnpm build
```

Upload the `dist/` directory. Configure the host to serve `index.html` for unknown routes so `/dashboard`, `/markets`, `/vault`, and `/demo` work on direct reload.

## Local Verification

Run these checks before publishing or updating a preview:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:ptb
pnpm build
pnpm test:e2e
```

To smoke test a deployed preview:

```bash
E2E_BASE_URL=https://your-preview-url.example pnpm test:e2e
```

When `E2E_BASE_URL` is set, Playwright targets that URL and does not start the local Vite dev server.

## Manual Demo Smoke

Open the deployed URL and verify:

1. `/dashboard` renders inside the shared shell.
2. `/markets` loads without a blank state.
3. `/strategy` explains that a market must be selected first.
4. `/portfolio`, `/pnl`, `/history`, and `/vault` render their current read/execution surfaces.
5. `/demo` clearly labels fixture/demo content as not live Testnet proof.
6. Direct route reload works for `/vault`, `/demo`, and a selected `/markets/:oracleId` URL.
7. The wallet status remains Testnet-only.
8. No page asks for private keys, seed phrases, or wallet backups.

Live transaction proof still requires a funded Testnet wallet with SUI gas and current DeepBook Predict dUSDC/PLP setup.

## Rollback

If a preview deploy fails:

1. Keep the previous working preview URL available for judges.
2. Revert the Vercel deployment to the previous successful build from the Vercel dashboard.
3. Re-check environment variables against `.env.example`.
4. Run `pnpm build` locally before redeploying.
5. If a protocol value changed, verify it against the official DeepBook Predict docs before updating deployment envs.
