import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TxDigestLink } from '@/components/tx/TxDigestLink';
import {
  buildAddressExplorerUrl,
  buildObjectExplorerUrl,
  buildPackageExplorerUrl,
  buildTxDigestExplorerUrl,
  formatExplorerText,
} from '@/lib/sui/explorer';

const objectId = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
const digest = 'GZ8pT3vW9yH1xY7kLmN4qRsUvA2bCdEfGhJ5mNpQrSt';

describe('Sui Explorer utilities', () => {
  it('builds transaction digest URLs with the Testnet query param', () => {
    expect(buildTxDigestExplorerUrl(digest)).toBe(
      `https://explorer.sui.io/txblock/${digest}?network=testnet`,
    );
  });

  it('builds object, package, and address URLs from the shared explorer config', () => {
    expect(buildObjectExplorerUrl(objectId)).toBe(
      `https://explorer.sui.io/object/${objectId}?network=testnet`,
    );
    expect(buildPackageExplorerUrl(objectId)).toBe(
      `https://explorer.sui.io/object/${objectId}?network=testnet`,
    );
    expect(buildAddressExplorerUrl(objectId)).toBe(
      `https://explorer.sui.io/address/${objectId}?network=testnet`,
    );
  });

  it('shortens long explorer labels without changing short values', () => {
    expect(formatExplorerText('short-digest')).toBe('short-digest');
    expect(formatExplorerText(digest)).toBe('GZ8pT3vW...NpQrSt');
    expect(formatExplorerText(objectId, { prefixLength: 6, suffixLength: 4 })).toBe(
      '0x1234...cdef',
    );
  });
});

describe('TxDigestLink', () => {
  it('renders an external Sui Explorer link with a shortened digest label', () => {
    render(<TxDigestLink className="digest-link" digest={digest} />);

    const link = screen.getByRole('link', {
      name: 'View transaction GZ8pT3vW...NpQrSt on Sui Explorer',
    });

    expect(link).toHaveAttribute(
      'href',
      `https://explorer.sui.io/txblock/${digest}?network=testnet`,
    );
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noreferrer noopener');
    expect(link).toHaveClass('digest-link');
    expect(link).toHaveTextContent('GZ8pT3vW...NpQrSt');
  });

  it('uses a custom label when supplied', () => {
    render(<TxDigestLink digest={digest} label="View digest proof" />);

    expect(screen.getByRole('link', { name: /View digest proof/ })).toHaveTextContent(
      'View digest proof',
    );
  });
});
