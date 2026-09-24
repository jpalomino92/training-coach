import '@testing-library/jest-dom/vitest';
import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// jsdom no siempre expone crypto.subtle: usamos el de Node.
if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

// jsdom no implementa scrollTo ni scrollIntoView
window.scrollTo = () => {};
Element.prototype.scrollIntoView = function () {};
