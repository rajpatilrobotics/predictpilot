import { InlineStateNotice, StatePanel } from '@/components/states/StatePrimitives';
import { TerminalDatum, TerminalPanel } from '@/components/terminal/TerminalPanels';
import type { PayoffVisualizerModel } from './payoff-visualizer';

export interface PayoffRiskVisualizerProps {
  className?: string;
  compact?: boolean;
  fallbackDescription?: string;
  model: PayoffVisualizerModel | null;
  title?: string;
}

export function PayoffRiskVisualizer({
  className = '',
  compact = false,
  fallbackDescription = 'Payoff recap is available after a binary or range strategy review records enough local context.',
  model,
  title = 'Payoff + risk',
}: PayoffRiskVisualizerProps) {
  if (model === null) {
    return (
      <StatePanel
        className={className}
        description={fallbackDescription}
        label="Payoff recap unavailable"
        title="Payoff recap unavailable"
        tone="empty"
      />
    );
  }

  const content = (
    <div className={className}>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <section
          aria-label="Payoff conditions"
          className="border border-[#d9dfdc] bg-[#fbfcfc] p-4"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#446b5e]">
            {model.title}
          </p>
          <p className="mt-3 text-lg font-semibold leading-7 text-[#17211d]">
            {model.winCondition}
          </p>
          <p className="mt-2 text-sm leading-6 text-[#53645f]">{model.lossCondition}</p>
        </section>

        <section aria-label="Payoff estimate" className="border border-[#d9dfdc] bg-white p-4">
          <TerminalDatum label={model.estimateLabel} value={model.estimateValue} />
          <p className="mt-2 text-xs leading-5 text-[#64736e]">
            PredictPilot only shows cost or payout after an existing preview or simulation provides
            it.
          </p>
        </section>
      </div>

      <dl className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {model.facts.map((fact) => (
          <TerminalDatum key={fact.label} label={fact.label} value={fact.value} />
        ))}
      </dl>

      {model.warnings.length === 0 ? (
        <InlineStateNotice className="mt-4" tone="success">
          Payoff semantics are protocol-defined. Exact amounts still come from simulation or onchain
          confirmation.
        </InlineStateNotice>
      ) : (
        <ul className="mt-4 grid gap-2" aria-label="Payoff warnings">
          {model.warnings.map((warning) => (
            <li key={`${warning.level}:${warning.code}:${warning.message}`}>
              <InlineStateNotice tone={warning.level === 'blocked' ? 'blocked' : 'warning'}>
                {warning.message}
              </InlineStateNotice>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  if (compact) {
    return (
      <section aria-label={title} className="border border-[#d9dfdc] bg-white p-4">
        <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-[#446b5e]">
          {title}
        </h3>
        <div className="mt-3">{content}</div>
      </section>
    );
  }

  return <TerminalPanel title={title}>{content}</TerminalPanel>;
}
