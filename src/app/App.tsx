import { runtimeConfig } from '@/config/env';

const foundationItems = [
  { label: 'Stack', value: 'Vite + React + TypeScript' },
  { label: 'Network', value: runtimeConfig.suiNetwork },
  { label: 'Data Layer', value: 'Config ready' },
];

export function App() {
  return (
    <main className="min-h-screen bg-[#f7f9fb] text-[#17211d]">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-8">
        <header className="flex items-center justify-between border-b border-[#d9dfdc] pb-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#446b5e]">
              PredictPilot
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-[#17211d]">
              DeepBook Predict Terminal
            </h1>
          </div>
          <span className="rounded border border-[#a8b7b0] bg-white px-3 py-1 text-sm font-medium text-[#243832]">
            Testnet
          </span>
        </header>

        <div className="grid flex-1 gap-4 py-8 md:grid-cols-3">
          {foundationItems.map((item) => (
            <article
              className="rounded border border-[#d9dfdc] bg-white p-5 shadow-sm"
              key={item.label}
            >
              <p className="text-sm text-[#5d6b66]">{item.label}</p>
              <p className="mt-3 text-lg font-semibold text-[#17211d]">{item.value}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
