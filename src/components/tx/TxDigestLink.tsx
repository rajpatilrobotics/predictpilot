import {
  buildTxDigestExplorerUrl,
  formatExplorerText,
} from '@/lib/sui/explorer';

interface TxDigestLinkProps {
  className?: string;
  digest: string;
  label?: string;
}

export function TxDigestLink({ className, digest, label }: TxDigestLinkProps) {
  const displayLabel = label ?? formatExplorerText(digest);

  return (
    <a
      aria-label={`View transaction ${displayLabel} on Sui Explorer`}
      className={className}
      href={buildTxDigestExplorerUrl(digest)}
      rel="noreferrer noopener"
      target="_blank"
    >
      {displayLabel}
    </a>
  );
}
