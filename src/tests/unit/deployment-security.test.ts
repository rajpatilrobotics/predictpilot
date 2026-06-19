/// <reference types="node" />

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

interface VercelHeader {
  key: string;
  value: string;
}

interface VercelConfig {
  headers?: Array<{
    headers: VercelHeader[];
    source: string;
  }>;
  rewrites?: Array<{
    destination: string;
    source: string;
  }>;
}

describe('deployment security config', () => {
  it('keeps SPA route fallback and safe static security headers configured', () => {
    const config = JSON.parse(
      readFileSync(join(process.cwd(), 'vercel.json'), 'utf8'),
    ) as VercelConfig;

    expect(config.rewrites).toContainEqual({
      destination: '/index.html',
      source: '/(.*)',
    });

    const allRouteHeaders = config.headers?.find((entry) => entry.source === '/(.*)')?.headers;
    expect(allRouteHeaders).toEqual(
      expect.arrayContaining([
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
        {
          key: 'Permissions-Policy',
          value: 'camera=(), microphone=(), geolocation=(), usb=(), serial=(), bluetooth=()',
        },
      ]),
    );
  });
});
