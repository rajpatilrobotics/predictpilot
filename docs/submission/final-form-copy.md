# PredictPilot Final Form Copy

Use this as the paste-ready source for the live submission portal after field lengths and required fields are verified.

## Project Name

PredictPilot

## Repository URL

https://github.com/rajpatilrobotics/predictpilot

## Live Demo URL

TODO VERIFY

## Demo Video URL

TODO VERIFY

## Short Description

PredictPilot is a DeepBook Predict intelligence and execution terminal on Sui Testnet. It helps users discover Predict markets, inspect oracle freshness and risk, preview PTBs before signing, execute wallet-controlled trading or vault actions, and verify results through transaction digests plus refreshed portfolio and history state.

## Longer Description

PredictPilot is built specifically for the Sui Overflow DeepBook track. Instead of acting like a generic prediction-market frontend, it is shaped around DeepBook Predict primitives: `Predict`, `PredictManager`, `OracleSVI`, `MarketKey`, `RangeKey`, the shared vault, and `PLP`.

The app uses the official Predict server for render-ready market, oracle, manager, vault, PnL, and history data. Wallet-critical flows use Sui Testnet configuration, dApp Kit wallet connection, PTB builders, pre-sign risk and transaction previews, simulation boundaries, and post-transaction refresh orchestration. Demo mode is clearly labeled as an offline fallback and never substitutes mock proof for real Testnet execution.

Before final submission, update this copy with the deployed app URL, demo video URL, selected oracle/market, and at least one real Testnet digest from `docs/submission/proof/digests.md`.

## Track Fit

PredictPilot belongs in the DeepBook track because it is a trading and liquidity terminal for DeepBook Predict, using wallet-controlled Sui PTBs and the official DeepBook Predict Testnet integration surface.

## Proof To Mention

- TODO VERIFY deployed URL
- TODO VERIFY demo video URL
- TODO VERIFY real Testnet digest
- TODO VERIFY screenshot pack
