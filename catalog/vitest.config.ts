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

    globals: true,
  },

  resolve: {
    alias: {
      // Match webpack's module resolution
      '~': path.resolve(__dirname, './app'),
      // Add shared folder alias to match tsconfig paths
      '@shared': path.resolve(__dirname, '../shared'),
      // Handle relative utils imports (match baseUrl: './app/' from tsconfig)
      utils: path.resolve(__dirname, './app/utils'),
      components: path.resolve(__dirname, './app/components'),
      containers: path.resolve(__dirname, './app/containers'),
      constants: path.resolve(__dirname, './app/constants'),
      // Add schemas from shared directory (matching webpack modules resolution)
      schemas: path.resolve(__dirname, '../shared/schemas'),
      // Add model directory (matching webpack modules resolution)
      model: path.resolve(__dirname, './app/model'),
    },
  },
})
