'use client';

import { App } from '../src/App';
import { Providers } from './providers';

export default function Home() {
  return (
    <Providers>
      <App />
    </Providers>
  );
}
