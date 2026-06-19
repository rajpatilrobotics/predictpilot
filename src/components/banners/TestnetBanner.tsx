import { suiConfig } from '@/config/sui';

export function TestnetBanner() {
  return (
    <section
      aria-label="Testnet status"
      className="mt-5 rounded border border-[#a8b7b0] bg-[#edf5f1] px-4 py-3 text-sm text-[#243832]"
      role="status"
    >
      <p className="font-semibold text-[#17211d]">Sui Testnet only</p>
      <p className="mt-1 text-[#445750]">
        PredictPilot is pinned to {suiConfig.network}. Mainnet and devnet execution are out of scope
        for this DeepBook Predict build.
      </p>
    </section>
  );
}
