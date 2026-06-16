import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';
import { defaultPublicRuntimeEnv } from '@/config/env';

for (const [key, value] of Object.entries(defaultPublicRuntimeEnv)) {
  vi.stubEnv(key, value);
}
