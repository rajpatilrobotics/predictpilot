import { describe, expect, it } from 'vitest';
import {
  createDraftPayoffVisualizerModel,
  createPayoffVisualizerModelFromSnapshot,
} from '@/features/trade/payoff-visualizer';
import { tradeTestManagerId, tradeTestOracleId, tradeTestNowMs } from './trade-test-helpers';

describe('PP-064 payoff visualizer model', () => {
  it('explains binary UP as strict-above strike', () => {
    const model = createPayoffVisualizerModelFromSnapshot({
      action: 'MINT',
      direction: 'UP',
      expiryMs: BigInt(tradeTestNowMs + 3_600_000),
      kind: 'binary',
      managerBalanceQuote: 5_000_000n,
      managerId: tradeTestManagerId,
      oracleFreshness: 'FRESH',
      oracleId: tradeTestOracleId,
      oracleStatus: 'ACTIVE',
      quantityQuote: 1_000_000n,
      strike1e9: 50_000_000_000_000n,
      underlyingAsset: 'BTC',
    });

    expect(model.winCondition).toContain('settlement > strike');
    expect(model.lossCondition).toContain('at or below');
  });

  it('explains binary DOWN as at-or-below strike', () => {
    const model = createPayoffVisualizerModelFromSnapshot({
      action: 'REDEEM',
      direction: 'DOWN',
      estimatedPayoutQuote: 750_000n,
      expiryMs: BigInt(tradeTestNowMs + 3_600_000),
      kind: 'binary',
      oracleId: tradeTestOracleId,
      oracleStatus: 'ACTIVE',
      quantityQuote: 1_000_000n,
      strike1e9: 50_000_000_000_000n,
      underlyingAsset: 'BTC',
    });

    expect(model.winCondition).toContain('settlement <= strike');
    expect(model.estimateLabel).toBe('Estimated payout');
    expect(model.estimateValue).toBe('0.75 DUSDC');
  });

  it('explains range payoff using the protocol (lower, higher] interval', () => {
    const model = createPayoffVisualizerModelFromSnapshot({
      action: 'MINT_RANGE',
      expiryMs: BigInt(tradeTestNowMs + 3_600_000),
      higherStrike1e9: 51_000_000_000_000n,
      kind: 'range',
      lowerStrike1e9: 50_000_000_000_000n,
      oracleId: tradeTestOracleId,
      oracleStatus: 'ACTIVE',
      quantityQuote: 1_000_000n,
      underlyingAsset: 'BTC',
    });

    expect(model.winCondition).toContain('settlement is in (');
    expect(model.winCondition).toContain(']');
  });

  it('shows simulation-required copy when no estimate exists', () => {
    const model = createPayoffVisualizerModelFromSnapshot({
      action: 'MINT',
      direction: 'UP',
      kind: 'binary',
      oracleId: tradeTestOracleId,
      quantityQuote: 1_000_000n,
      strike1e9: 50_000_000_000_000n,
      underlyingAsset: 'BTC',
    });

    expect(model.estimateValue).toBe('Simulation required');
    expect(model.warnings.map((warning) => warning.code)).toContain('SIMULATION_REQUIRED');
  });

  it('surfaces invalid range and ask-bounds warnings without fake pricing', () => {
    const model = createDraftPayoffVisualizerModel({
      action: 'MINT_RANGE',
      expiryMs: BigInt(tradeTestNowMs + 3_600_000),
      higherStrike1e9: 50_000_000_000_000n,
      kind: 'range',
      lowerStrike1e9: 51_000_000_000_000n,
      oracleId: tradeTestOracleId,
      quantityQuote: 1_000_000n,
      underlyingAsset: 'BTC',
      validationErrors: [
        {
          code: 'INVALID_RANGE',
          message: 'Lower strike must be below higher strike.',
        },
      ],
      validationWarnings: [
        {
          code: 'ASK_BOUNDS_UNAVAILABLE',
          message: 'Ask bounds are unavailable for this oracle.',
        },
      ],
    });

    expect(model.estimateValue).toBe('Simulation required');
    expect(model.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'INVALID_RANGE', level: 'blocked' }),
        expect.objectContaining({ code: 'ASK_BOUNDS_UNAVAILABLE', level: 'caution' }),
      ]),
    );
  });
});
