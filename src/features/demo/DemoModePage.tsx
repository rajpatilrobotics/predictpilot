import { featureFlags, type FeatureFlags } from '@/config/feature-flags';
import { InlineStateNotice, StatePanel } from '@/components/states/StatePrimitives';
import {
  TerminalDatum,
  TerminalMetricCard,
  TerminalPageHeader,
  TerminalPanel,
} from '@/components/terminal/TerminalPanels';
import { DemoModeProvider } from '@/features/demo/DemoModeProvider';
import { useDemoMode, type DemoFixtureCard } from '@/features/demo/demo-mode-context';

interface DemoModePageProps {
  flags?: FeatureFlags;
  onNavigate?: (path: string) => void;
}

export function DemoModePage({ flags = featureFlags, onNavigate }: DemoModePageProps) {
  if (!flags.enableJudgeMode) {
    return (
      <StatePanel
        action={
          <button
            className="border border-[#a7b8b1] bg-white px-3 py-2 text-sm font-semibold text-[#17211d]"
            onClick={() => onNavigate?.('/dashboard')}
            type="button"
          >
            Back to dashboard
          </button>
        }
        description="The judge walkthrough is disabled by the public runtime feature flag. Live Testnet routes remain available."
        headingLevel={1}
        title="Demo mode disabled"
        tone="blocked"
      />
    );
  }

  return (
    <DemoModeProvider>
      <DemoModePageContent onNavigate={onNavigate} />
    </DemoModeProvider>
  );
}

function DemoModePageContent({ onNavigate }: { onNavigate?: (path: string) => void }) {
  const demo = useDemoMode();

  return (
    <article
      aria-labelledby="demo-mode-title"
      className="space-y-4 border border-[#c8d3ce] bg-white p-5 shadow-sm"
    >
      <TerminalPageHeader
        eyebrow="Demo Mode"
        source="Offline fallback"
        title="Demo Mode"
        titleId="demo-mode-title"
      />

      <InlineStateNotice label="Demo mode proof boundary" tone="warning">
        Demo mode uses curated offline fixtures for judge narration. It is not live Testnet proof,
        never requests wallet signatures, and never displays a fabricated transaction digest.
      </InlineStateNotice>

      <section aria-label="Demo mode labels" className="flex flex-wrap gap-2">
        {demo.metadata.labels.map((label) => (
          <span
            className="border border-[#b8c6c0] bg-[#edf5f1] px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#315447]"
            key={label}
          >
            {label}
          </span>
        ))}
      </section>

      <section aria-label="Demo mode overview metrics" className="grid gap-3 md:grid-cols-3">
        <TerminalMetricCard
          helper="All sample data stays inside this route."
          label="Data source"
          value={demo.metadata.dataSource}
        />
        <TerminalMetricCard
          helper="The demo explains flows but does not execute them."
          label="Execution"
          value={demo.metadata.executionMode}
        />
        <TerminalMetricCard
          helper="Use live routes for wallet-confirmed proof."
          label="Current step"
          value={`${demo.currentStepIndex + 1} / ${demo.steps.length}`}
        />
      </section>

      <TerminalPanel title="Jump to live proof routes">
        <div className="flex flex-wrap gap-2">
          <DemoRouteButton label="Start Judge Demo" onClick={() => onNavigate?.('/judge-demo')} />
          <DemoRouteButton label="Open live markets" onClick={() => onNavigate?.('/markets')} />
          <DemoRouteButton label="Open PredictManager" onClick={() => onNavigate?.('/manager')} />
          <DemoRouteButton label="Open Vault / PLP" onClick={() => onNavigate?.('/vault')} />
        </div>
        <p className="mt-3 text-sm leading-6 text-[#52615c]">
          These routes use the real Testnet app state. Demo fixtures stay isolated and never seed
          live wallet, digest, or query state.
        </p>
      </TerminalPanel>

      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <TerminalPanel title="Judge timeline">
          <ol className="space-y-2">
            {demo.steps.map((step, index) => {
              const isActive = step.id === demo.currentStep.id;

              return (
                <li key={step.id}>
                  <button
                    aria-current={isActive ? 'step' : undefined}
                    className={`w-full border px-3 py-2 text-left text-sm font-semibold ${
                      isActive
                        ? 'border-[#557a6d] bg-[#edf5f1] text-[#17211d]'
                        : 'border-[#d9dfdc] bg-white text-[#445750]'
                    }`}
                    onClick={() => demo.goToStep(index)}
                    type="button"
                  >
                    Step {index + 1}: {step.label}
                  </button>
                </li>
              );
            })}
          </ol>
        </TerminalPanel>

        <TerminalPanel title="Current walkthrough step">
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#64736e]">
                Step {demo.currentStepIndex + 1}
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-[#17211d]">
                {demo.currentStep.title}
              </h2>
              <p className="mt-2 leading-7 text-[#3f514b]">{demo.currentStep.description}</p>
            </div>

            <InlineStateNotice label="Live boundary" tone="success">
              {demo.currentStep.liveBoundary}
            </InlineStateNotice>

            <div className="flex flex-wrap gap-2">
              <button
                className="border border-[#a7b8b1] bg-white px-3 py-2 text-sm font-semibold text-[#17211d] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={demo.isFirstStep}
                onClick={demo.previousStep}
                type="button"
              >
                Previous step
              </button>
              <button
                className="border border-[#315447] bg-[#315447] px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                disabled={demo.isLastStep}
                onClick={demo.nextStep}
                type="button"
              >
                Next step
              </button>
              <button
                className="border border-[#a7b8b1] bg-white px-3 py-2 text-sm font-semibold text-[#17211d]"
                onClick={demo.reset}
                type="button"
              >
                Reset demo
              </button>
              <button
                className="border border-[#a7b8b1] bg-[#fbfcfc] px-3 py-2 text-sm font-semibold text-[#315447]"
                onClick={() => onNavigate?.(demo.currentStep.routeHref)}
                type="button"
              >
                {demo.currentStep.routeLabel}
              </button>
            </div>
          </div>
        </TerminalPanel>
      </div>

      <section aria-label="Curated fixture snapshot" className="grid gap-4 xl:grid-cols-3">
        <DemoFixturePanel cards={demo.fixture.oracle} title="Oracle fixture" />
        <DemoFixturePanel cards={demo.fixture.manager} title="Manager fixture" />
        <DemoFixturePanel cards={demo.fixture.vault} title="Vault fixture" />
      </section>

      <TerminalPanel title="Fixture history notes">
        <ul className="grid gap-3">
          {demo.fixture.history.map((item) => (
            <li className="border border-[#d9dfdc] bg-[#fbfcfc] p-3" key={item.kind}>
              <p className="text-xs uppercase tracking-[0.12em] text-[#64736e]">{item.timestamp}</p>
              <p className="mt-1 font-semibold text-[#17211d]">{item.kind}</p>
              <p className="mt-1 text-sm leading-6 text-[#52615c]">{item.note}</p>
            </li>
          ))}
        </ul>
      </TerminalPanel>

      <StatePanel
        description="For submission proof, switch from this demo route to the live Testnet flows. Only wallet-confirmed transactions should produce a digest and explorer link."
        label="Demo mode live execution boundary"
        title="Live execution remains separate"
        tone="warning"
      />
    </article>
  );
}

function DemoRouteButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      className="border border-[#315447] bg-[#edf5f1] px-3 py-2 text-sm font-semibold text-[#17211d]"
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function DemoFixturePanel({ cards, title }: { cards: readonly DemoFixtureCard[]; title: string }) {
  return (
    <TerminalPanel title={title}>
      <dl className="grid gap-3">
        {cards.map((card) => (
          <TerminalDatum key={card.label} label={card.label} value={card.value} />
        ))}
      </dl>
      <ul className="mt-4 space-y-2 text-xs leading-5 text-[#64736e]">
        {cards.map((card) => (
          <li key={card.helper}>{card.helper}</li>
        ))}
      </ul>
    </TerminalPanel>
  );
}
