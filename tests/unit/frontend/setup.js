// Setup global pour Vitest + Testing Library
import '@testing-library/jest-dom';
import { vi, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => cleanup());

// Mock IntersectionObserver / ResizeObserver
global.IntersectionObserver = class {
  observe() {}; unobserve() {}; disconnect() {};
};
global.ResizeObserver = class {
  observe() {}; unobserve() {}; disconnect() {};
};

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(q => ({
    matches: false, media: q, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  })),
});

// Mock scrollIntoView (jsdom ne l'a pas)
Element.prototype.scrollIntoView = vi.fn();

// Mock URL.createObjectURL
global.URL.createObjectURL = vi.fn(() => 'blob:mock');
global.URL.revokeObjectURL = vi.fn();

// Stub fetch global pour que les composants ne plantent pas si non mocke
global.fetch = vi.fn(() => Promise.resolve({
  ok: true, status: 200,
  json: () => Promise.resolve({}),
  text: () => Promise.resolve(''),
  blob: () => Promise.resolve(new Blob([''])),
  headers: new Headers(),
}));

// Mock EventSource (utilise pour SSE)
global.EventSource = class {
  constructor(url) { this.url = url; this.readyState = 0; }
  close() { this.readyState = 2; }
};

// localStorage mock (jsdom le fournit mais on s'assure)
if (!global.localStorage) {
  let store = {};
  global.localStorage = {
    getItem: k => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
    clear: () => { store = {}; },
  };
}
