import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/app/App';
import { AppProviders } from '@/app/providers';
import { installBigIntJsonSerialization } from '@/lib/bigint-json';
import '@/styles/index.css';

installBigIntJsonSerialization();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </StrictMode>,
);
