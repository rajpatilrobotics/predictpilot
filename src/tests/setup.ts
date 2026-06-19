import '@testing-library/jest-dom/vitest';
import { configure } from '@testing-library/react';
import { vi } from 'vitest';
import { defaultPublicRuntimeEnv } from '@/config/env';

configure({
  asyncUtilTimeout: 5_000,
});

for (const [key, value] of Object.entries(defaultPublicRuntimeEnv)) {
  vi.stubEnv(key, value);
}
