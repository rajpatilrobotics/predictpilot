# PredictPilot User Guide

This guide explains what PredictPilot is, why it exists, and how to use it from the first screen to a real Testnet proof.

PredictPilot is built for **Sui Testnet** and **DeepBook Predict**. It is not a Mainnet app, and it is not a fake demo. Real actions require a connected Sui wallet, Testnet SUI for gas, and DeepBook Predict DUSDC for trading or vault actions.

## 1. What PredictPilot Is

PredictPilot is a DeepBook Predict terminal. It helps a user:

1. Inspect live DeepBook Predict oracle markets.
2. Check oracle freshness, lifecycle, and SVI context.
3. Create or discover a reusable `PredictManager`.
4. Deposit DeepBook Predict DUSDC into that manager.
5. Preview binary, range, or vault actions before signing.
6. Submit a wallet transaction on Sui Testnet.
7. Verify the result with a transaction digest, portfolio refresh, and history refresh.

The main idea is simple:

> PredictPilot helps you go from market understanding to safe wallet execution to proof.

## 2. What The App Is Used For

PredictPilot is useful for three kinds of users.

### Traders

Traders can inspect active oracle markets, choose a direction or range, preview risk, and mint or redeem DeepBook Predict positions through a Sui wallet.

### Liquidity Providers

Liquidity providers can inspect the Predict vault, supply DUSDC, receive PLP shares, and later withdraw when available.

### Judges, Developers, And Reviewers

Judges and developers can see that the app is DeepBook-native. It uses real protocol concepts such as:

- `Predict`
- `PredictManager`
- `OracleSVI`
- `MarketKey`
- `RangeKey`
- DUSDC
- PLP
- transaction simulation
- Sui Explorer digest proof

## 3. Before You Start

You need these items before trying real execution.

1. Open the live app:
   - `https://predictpilot.vercel.app`
2. Use a Sui wallet such as Slush.
3. Set the wallet network to `testnet`.
4. Keep some Testnet SUI in the wallet for gas.
5. Keep DeepBook Predict DUSDC in the wallet for deposits and trades.

If you only want to understand the app without signing anything, open `Demo Mode`.

## 4. Important Safety Rules

Follow these rules every time:

1. Only approve wallet transactions on `testnet`.
2. Only approve a transaction if the wallet action matches what you intended.
3. Use small amounts while testing, such as `1 DUSDC`.
4. Do not treat a transaction as successful unless the app or wallet shows a digest.
5. After a transaction, wait for portfolio/history refresh. Indexing can take a little time.
6. Demo Mode is only an offline walkthrough. It is not live Testnet proof.

## 5. App Layout

The app has three main areas.

### Top Bar

The top bar shows:

- app name
- current page guidance
- Testnet / DUSDC / manager / alert status
- wallet connection status

Use this area to confirm you are connected and on Testnet.

### Left Navigation

The left navigation is where you switch between screens.

Main groups:

- `Overview`
- `Execute`
- `Assets`
- `Demo`

### Main Screen

The main screen changes based on the selected tab. This is where you inspect markets, manage your PredictManager, preview trades, and review history.

## 6. A To Z User Flow

This is the normal full journey.

### Step 1: Open The App

1. Go to `https://predictpilot.vercel.app`.
2. Wait for the terminal shell to load.
3. Confirm the top bar says `Sui Testnet`.

### Step 2: Connect Wallet

1. Click `Connect Wallet` in the top-right wallet box.
2. Select your Sui wallet, for example Slush.
3. Approve the connection in the wallet popup.
4. Confirm the top bar shows:
   - wallet connected
   - account address
   - network `testnet`
   - status `Connected`

If the app says wrong network, switch the wallet to Sui Testnet.

### Step 3: Open PredictManager

1. In the left navigation, click `PredictManager`.
2. Look at the `Manager lifecycle` panel.

You will see one of these states:

- `No wallet`: connect wallet first.
- `Create needed`: no manager exists yet.
- `Ready`: manager exists and is selected.
- `Ambiguous`: multiple managers were found; do not auto-select.
- `Loading`: wait for indexed discovery.

### Step 4: Create PredictManager

Do this only if the page says no manager was found.

1. Click `Create PredictManager`.
2. The execution modal opens.
3. Read the action summary.
4. Confirm the action is manager creation.
5. Wait for simulation/readiness to finish.
6. Click `Request wallet signature`.
7. In your wallet, approve only if it is a Testnet manager creation transaction.
8. Wait for the digest.
9. Save the digest for proof.
10. Revisit or refresh `PredictManager` if indexing takes time.

You only need one reusable PredictManager per wallet.

### Step 5: Deposit DUSDC Into PredictManager

Trades use DUSDC inside the PredictManager. Wallet DUSDC alone is not enough for minting.

1. Stay on `PredictManager`.
2. Find `Deposit DUSDC to PredictManager`.
3. Enter a small amount, for example `1`.
4. Click `Open execution review`.
5. Read the modal carefully.
6. Confirm the action is `DEPOSIT_QUOTE` or DUSDC deposit.
7. Click `Request wallet signature`.
8. Approve in the wallet.
9. Wait for the digest.
10. Confirm the manager DUSDC balance updates.

If wallet DUSDC is missing or too low, deposit will stay blocked.

### Step 6: Open Markets

1. In the left navigation, click `Markets`.
2. Look for active oracle markets.
3. Prefer an oracle marked active or potentially live.
4. On a market row, use:
   - `Strategy` to open the trade builder.
   - `SVI` to inspect volatility/price context.
   - `Oracle Status` to inspect lifecycle and freshness.

For the first real test, choose a simple active BTC oracle if one is available.

### Step 7: Inspect Oracle Status

Before signing any trade, check the market health.

1. From `Markets`, click `Oracle Status`.
2. Confirm lifecycle and freshness look safe.
3. Avoid stale, inactive, or settled oracles for minting.
4. If the oracle looks wrong, go back to `Markets` and choose another one.

### Step 8: Open Strategy Builder

1. From an active market row, click `Strategy`.
2. You should land on `Market Detail / Strategy`.
3. Confirm the selected oracle appears on the page.
4. Find the `Strategy builder` panel.

### Step 9: Mint A Binary Position

This is the simplest trade flow.

1. In `Strategy builder`, select `Binary`.
2. Under `Binary action`, choose `Mint binary`.
3. Under `Direction`, choose:
   - `UP` if you think settlement will be above the strike.
   - `DOWN` if you think settlement will be below the strike.
4. Enter a `Binary strike`.
5. Enter `Quantity (DUSDC atomic)`.

Important: this field is atomic units. DUSDC has 6 decimals.

- `1 DUSDC` = `1000000`
- `0.5 DUSDC` = `500000`
- `10 DUSDC` = `10000000`

For testing, use `1000000`.

6. Click `Preview strategy`.
7. Read the preview and warnings.
8. If the execution modal opens, read:
   - action
   - network
   - sender
   - manager ID
   - oracle ID
   - simulation status
   - safety warnings
9. Click `Request wallet signature` only when the preview is ready.
10. Approve in the wallet.
11. Wait for the digest.
12. Save the digest.

### Step 10: Check Portfolio

After a mint, check whether the app refreshed state.

1. Click `Portfolio`.
2. Confirm the manager is loaded.
3. Look for:
   - manager DUSDC balance
   - open binary positions
   - position counts

If the page is empty immediately after signing, wait and refresh. Indexed server updates can lag behind the transaction.

### Step 11: Check History

1. Click `History`.
2. Look for the new mint or redeem event.
3. Confirm the activity matches your wallet/manager.
4. Use the digest link if shown.

History is important because it proves the action was indexed after execution.

### Step 12: Check PnL

1. Click `PnL`.
2. If there is enough indexed activity, the page shows performance data.
3. If it is empty, that usually means there is not enough historical activity yet.

### Step 13: Redeem A Binary Position

Redeem requires an existing open position.

1. Open the same market or position context.
2. Go to `Market Detail / Strategy`.
3. Select `Binary`.
4. Under `Binary action`, choose `Redeem binary`.
5. Use the same direction and strike as the open position.
6. Enter quantity in atomic DUSDC units.
7. Click `Preview strategy`.
8. Review the modal.
9. Click `Request wallet signature`.
10. Approve in the wallet.
11. Save the digest.
12. Check `Portfolio` and `History`.

If the app says no owned position exists, you cannot redeem that selected market/strike/direction yet.

## 7. Range Trade Flow

Range positions are more advanced than binary positions.

Use this when you want exposure to a settlement landing inside a strike band.

1. Open `Markets`.
2. Pick an active oracle.
3. Click `Strategy`.
4. Select `Range`.
5. Choose:
   - `Mint range`
   - or `Redeem range`
6. Enter:
   - `Lower strike`
   - `Higher strike`
   - quantity in atomic DUSDC units
7. Click `Preview strategy`.
8. Review the modal.
9. Sign only if the preview is ready and the wallet transaction matches the intended action.

Range rules:

- lower strike must be below higher strike.
- strikes must align with the oracle tick size.
- minting needs an active/tradeable oracle.
- redeeming needs a matching owned range position.

## 8. Vault / PLP Flow

The vault is the shared liquidity side of DeepBook Predict. Supplying DUSDC can mint PLP shares.

### Supply DUSDC To Vault

1. Click `Vault / PLP`.
2. Review vault value, utilization, and performance.
3. Find the supply panel.
4. Enter a small amount, for example `1`.
5. Click `Review supply execution`.
6. Review the modal.
7. Approve in the wallet only if the action is vault supply.
8. Wait for digest.
9. Confirm PLP balance or vault/history state refreshes.

### Withdraw From Vault

Withdraw requires PLP balance.

1. Click `Vault / PLP`.
2. Find the withdraw panel.
3. Enter PLP amount.
4. Click `Review withdraw execution`.
5. Review the modal.
6. Approve in the wallet only if the action is vault withdraw.
7. Wait for digest.
8. Confirm DUSDC returned after refresh.

Exact PLP or DUSDC output should be treated as simulation/onchain-confirmed, not guessed.

## 9. Demo Mode

Use Demo Mode when:

- wallet is not ready,
- DUSDC has not arrived,
- Predict server data is unavailable,
- you need to explain the app quickly to judges.

Steps:

1. Click `Demo Mode`.
2. Read the labels carefully:
   - Demo mode
   - Offline fixture
   - Not live Testnet proof
   - No wallet signature will be requested
3. Step through the guided walkthrough.
4. Use the links to open live routes such as:
   - `Open live markets`
   - `Open PredictManager`
   - `Open Vault / PLP`

Demo Mode is helpful for explanation, but it is not a substitute for a real transaction digest.

## 10. Route-By-Route Cheat Sheet

### Dashboard

Use this first. It gives a quick overview of market status, manager readiness, vault context, and next safe actions.

Click this when you are not sure where to start.

### Markets

Use this to find active oracle markets.

Best actions:

- click `Strategy` to trade
- click `SVI` to inspect price/volatility context
- click `Oracle Status` to check lifecycle/freshness

### SVI Surface

Use this to understand oracle pricing context. This is mostly analysis, not execution.

### Oracle Status

Use this before trading. It tells you whether an oracle looks active, stale, pending settlement, or settled.

### Market Detail / Strategy

Use this to build a binary or range strategy. This is where trade preview and wallet signing begin.

### PredictManager

Use this to:

- create a manager
- confirm manager ID
- deposit DUSDC
- withdraw DUSDC
- check manager readiness

### Portfolio

Use this after trades. It shows manager balances and open position state when indexed data is available.

### PnL

Use this after activity exists. It shows performance context.

### Vault / PLP

Use this for liquidity provider actions:

- supply DUSDC
- receive PLP
- withdraw with PLP

### History

Use this for proof. It should show indexed activity after transactions.

### Proof Mode

Use this after a transaction once the Proof Mode feature is available. It will summarize whether the app has enough evidence to call the action verified.

Proof Mode should show:

- wallet readiness
- Testnet status
- PredictManager ID
- selected oracle ID
- dUSDC readiness
- simulation readiness
- transaction digest
- Sui Explorer link
- portfolio refresh status
- history refresh status

### Demo Mode

Use this for safe explanation without real wallet execution.

## 11. How To Use Proof Mode

When Proof Mode is available, use it as the final check after a real wallet transaction.

1. Complete the intended action, such as manager creation, DUSDC deposit, binary mint, range mint, or vault supply.
2. Wait for the transaction digest.
3. Open `Proof Mode`.
4. Read the top verdict first.
5. Confirm the page separates evidence by source:
   - `Wallet`
   - `Chain`
   - `Predict server`
   - `Local`
6. Open the Sui Explorer link if a digest is shown.
7. Check whether portfolio and history refresh are complete.
8. Click `Copy proof summary` if available.
9. Save the copied proof in your submission notes.

### How To Read Proof States

- `Blocked`: something required is missing, such as wallet, Testnet, manager, dUSDC, oracle, or simulation.
- `Ready`: inputs are valid, but no wallet transaction has been submitted yet.
- `Ready but Not Submitted`: a transaction was prepared and simulated, but you have not approved it in the wallet.
- `Pending Index`: chain proof exists, but Predict server portfolio/history has not refreshed yet.
- `Verified`: chain confirmation exists and the required refresh checks are visible.
- `Failed`: simulation, wallet signing, transaction, or refresh failed.

Important rule:

> A digest is real chain evidence. A copied proof summary is only a convenient note. Demo Mode is never live proof.

## 12. What To Capture For Hackathon Proof

For a strong demo, capture these items:

1. Live app URL.
2. Wallet connected on Testnet.
3. PredictManager ID.
4. DUSDC deposit digest.
5. Binary mint digest.
6. Portfolio refresh screenshot.
7. History refresh screenshot.
8. Sui Explorer page for the digest.
9. Optional vault supply/withdraw digest.
10. Proof Mode screenshot if available.
11. Copied proof summary if available.

Store proof in:

- `docs/submission/proof/digests.md`
- `docs/submission/screenshots/`

## 13. Common Problems

### Wallet Is Not Connected

Click `Connect Wallet` in the top bar.

### Wrong Network

Open your wallet and switch to Sui Testnet.

### No PredictManager Found

Open `PredictManager` and click `Create PredictManager`.

### DUSDC Missing

You can connect and create a manager with SUI gas, but deposits and trades require DeepBook Predict DUSDC.

### Deposit Button Is Disabled

Check:

- wallet connected
- Testnet selected
- wallet DUSDC balance loaded
- amount is positive
- amount is not more than wallet DUSDC

### Trade Preview Is Blocked

Check:

- manager exists
- manager has DUSDC deposited
- oracle is active/fresh
- strike is valid
- quantity is positive
- range lower strike is below higher strike

### Digest Does Not Show Immediately

Wait a little. Wallet return or indexed refresh can lag. Do not retry blindly if the wallet already approved. Check wallet activity or Sui Explorer if needed.

### Portfolio Or History Does Not Update Immediately

Wait and refresh. Indexed server data can take time after the onchain transaction succeeds.

### Proof Mode Says Pending Index

This means the transaction digest exists, but the Predict server has not shown the refreshed portfolio or history row yet.

Do this:

1. Keep the digest.
2. Open the explorer link.
3. Wait and refresh the app.
4. Do not call it fully `Verified` until the required refresh checks are visible.

## 14. Beginner Testing Path

Use this safe path while learning:

1. Connect wallet.
2. Confirm Testnet.
3. Open `PredictManager`.
4. Create manager if missing.
5. Deposit `1` DUSDC.
6. Open `Markets`.
7. Pick an active BTC oracle.
8. Click `Strategy`.
9. Select `Binary`.
10. Select `Mint binary`.
11. Select `UP` or `DOWN`.
12. Enter a valid strike.
13. Enter quantity `1000000`.
14. Click `Preview strategy`.
15. Review the modal.
16. Click `Request wallet signature`.
17. Approve in wallet.
18. Save digest.
19. Open `Portfolio`.
20. Open `History`.

That is the simplest A-to-Z proof path.
