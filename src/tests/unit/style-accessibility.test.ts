/// <reference types="node" />

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('global stylesheet accessibility safeguards', () => {
  it('honors reduced-motion preferences for global animation and transition effects', () => {
    const stylesheet = readFileSync(join(process.cwd(), 'src/styles/index.css'), 'utf8');

    expect(stylesheet).toContain('@media (prefers-reduced-motion: reduce)');
    expect(stylesheet).toContain('animation-duration: 0.01ms !important');
    expect(stylesheet).toContain('animation-iteration-count: 1 !important');
    expect(stylesheet).toContain('transition-duration: 0.01ms !important');
    expect(stylesheet).toContain('scroll-behavior: auto !important');
  });
});
