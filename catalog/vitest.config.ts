/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'jsdom',
    environmentOptions: {
      jsdom: {
        url: 'https://quilt-test',
      },
    },

    // Node 25+ enables the Web Storage API by default; its built-in
    // `localStorage` global reads as undefined without --localstorage-file and
    // shadows jsdom's, so app code using the bare `localStorage` global sees
    // undefined. Disable Node's webstorage (the forks pool reads NODE_OPTIONS
    // at spawn) so jsdom owns localStorage again — no test-side storage mock.
    // See https://github.com/vitest-dev/vitest/issues/8757.
    env: {
      NODE_OPTIONS: '--no-webstorage',
    },

    setupFiles: ['./setup-vitest.ts'],

    include: ['app/**/*.spec.{js,ts,tsx}'],

    exclude: ['node_modules/**'],

    coverage: {
      provider: 'v8',
      include: ['app/**/*.{j,t}s{,x}'],
      exclude: ['app/**/*.spec.{js,ts,tsx}', 'app/**/mocks/*.{j,t}s{,x}'],
      thresholds: {
        statements: 4,
        branches: 3,
        functions: 2,
        lines: 4,
      },
    },
  },

  resolve: {
    alias: {
      utils: path.resolve(__dirname, './app/utils'),
      components: path.resolve(__dirname, './app/components'),
      containers: path.resolve(__dirname, './app/containers'),
      constants: path.resolve(__dirname, './app/constants'),
      schemas: path.resolve(__dirname, '../shared/schemas'),
      model: path.resolve(__dirname, './app/model'),
      website: path.resolve(__dirname, './app/website'),
    },
  },
})
