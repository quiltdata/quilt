/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  // Configure esbuild to handle JSX in .js files
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        '.js': 'jsx',
      },
    },
  },
  test: {
    // Environment setup
    environment: 'jsdom',
    environmentOptions: {
      jsdom: {
        url: 'https://quilt-test',
      },
    },

    // Setup files
    setupFiles: ['./setup-vitest.ts'],

    // Test file patterns - start empty, add files during migration
    include: [
      // Utils tests migrated from Jest:
      'app/utils/validators.spec.js',
      'app/utils/defer.spec.ts',
      'app/utils/error.spec.ts',
      'app/utils/format.spec.tsx',
      'app/utils/JSONOneliner.spec.ts',
      'app/utils/JSONPointer.spec.ts',
      'app/utils/JSONSchema/JSONSchema.spec.ts',
      'app/utils/MetaTitle.spec.tsx',
      'app/utils/packageHandle.spec.ts',
      'app/utils/PackageUri.spec.ts',
      'app/utils/Resource.spec.ts',
      'app/utils/s3paths.spec.ts',
      'app/utils/spreadsheets/spreadsheets.spec.ts',
      'app/utils/tagged.spec.js',
      'app/utils/taggedV2.spec.ts',
      'app/utils/workflows.spec.ts',
      'app/utils/AWS/Bedrock/History.spec.ts',
      'app/utils/AWS/Bedrock/Message.spec.ts',
      'app/utils/BucketPreferences/BucketPreferences.spec.ts',
      'app/utils/checksums/checksums.spec.ts',

      // Constants tests:
      'app/constants/routes.spec.ts',

      // Component tests:
      'app/components/BreadCrumbs/BreadCrumbs.spec.tsx',
      'app/components/BucketIcon/BucketIcon.spec.tsx',
      'app/components/Buttons/Skeleton.spec.tsx',
      'app/components/Buttons/Iconized.spec.tsx',
      'app/components/Buttons/WithPopover.spec.tsx',
    ],

    // Exclude patterns
    exclude: [
      'node_modules/**',
      'build/**',
      '**/*.test.{j,t}s{,x}', // Keep Jest's .test. files excluded for now
    ],

    // Coverage configuration (matching Jest setup)
    coverage: {
      provider: 'v8',
      include: ['app/**/*.{j,t}s{,x}'],
      exclude: [
        'app/**/*.{test,spec}.{j,t}s{,x}',
        'app/**/mocks/*.{j,t}s{,x}',
        'app/*/RbGenerated*/*.{j,t}s{,x}',
        'app/app.{j,t}s{,x}',
        'app/global-styles.{j,t}s{,x}',
        'app/*/*/Loadable.{j,t}s{,x}',
      ],
      thresholds: {
        statements: 4,
        branches: 3,
        functions: 2,
        lines: 4,
      },
    },

    // Global setup for mocking
    globals: true,
  },

  // Module resolution (matching webpack/tsconfig setup)
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

  // Define to handle environment variables
  define: {
    // Match webpack's environment plugin
    'process.env.LOGGER_REDUX': JSON.stringify(process.env.LOGGER_REDUX || 'enabled'),
  },

  // ESM handling (addresses current p-limit and msgpackr workarounds)
  esbuild: {
    target: 'es2020',
    // Handle JSX in .js files (like Message.js)
    jsxInject: "import React from 'react'",
  },

  // Module name mapping (equivalent to Jest's moduleNameMapper)
  server: {
    deps: {
      // Handle ESM modules that Jest had issues with
      inline: ['p-limit'],
    },
  },
})
