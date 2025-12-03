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
      'app/components/Layout/Container.spec.tsx',
      'app/components/Buttons/Skeleton.spec.tsx',
      'app/components/Buttons/Iconized.spec.tsx',
      'app/components/Buttons/WithPopover.spec.tsx',

      // Container tests:
      'app/containers/Bucket/PackageCompare/Diff/compareJsons.spec.ts',
      'app/containers/Bucket/PackageCompare/Diff/diffJsons.spec.ts',
      'app/containers/Bucket/PackageCompare/Diff/Summary/comparePackageEntries.spec.ts',
      'app/containers/Bucket/PackageDialog/State/form.spec.ts',
      'app/containers/Bucket/PackageDialog/State/schema.spec.ts',
      'app/containers/Bucket/Selection/utils.spec.ts',
      'app/components/FileEditor/routes.spec.ts',
      'app/components/Markdown/parseTasklist.spec.ts',
      'app/containers/Bucket/PackageDialog/Layout.spec.ts',
      'app/containers/Redir/Redir.spec.tsx',
      'app/components/Filters/DatesRange.spec.tsx',
      'app/containers/Search/Table/index.spec.tsx',
      'app/containers/Bucket/Queries/QuerySelect.spec.tsx',
      'app/components/FileEditor/HelpLinks.spec.tsx',
      'app/components/JsonEditor/State.spec.js',
      'app/components/Preview/quick/index.spec.tsx',
      // 'app/components/Preview/loaders/Vega.spec.js', // Blocked by JSX in utils/string.js
      // 'app/containers/Bucket/Selection/Dashboard.spec.tsx', // Blocked by JSX in FileView.js
      // 'app/components/FileEditor/CreateFile.spec.tsx', // Blocked by JSX in utils/string.js
      // 'app/containers/Bucket/Dir/Toolbar/Toolbar.spec.tsx', // Blocked by JSX in utils/string.js
      // 'app/containers/Bucket/CodeSamples.spec.tsx', // Blocked by JSX in Notifications/index.js
      // 'app/components/Filters/NumbersRange.spec.tsx', // Blocked by JSX in utils/string.js
      // 'app/containers/Bucket/Overview/Downloads.spec.ts', // Blocked by JSX in StackedAreaChart.js
      // Temporarily disabled due to JSX parsing issues in dependencies:
      // 'app/containers/Bucket/PackageDialog/State/meta.spec.ts',
      // 'app/containers/Bucket/PackageDialog/State/name.spec.ts',
      // 'app/containers/Bucket/PackageDialog/State/params.spec.ts',

      // Remaining test files from Jest config (not yet attempted):
      'app/components/Assistant/Model/GlobalContext/navigation.spec.ts',
      // 'app/components/FileEditor/FileEditor.spec.tsx',
      // 'app/components/FileEditor/loader.spec.ts', // Blocked by JSX in Preview/loaders/Markdown.js
      // 'app/components/FileEditor/QuiltConfigEditor/BucketPreferences/BucketPreferences.spec.tsx',
      // 'app/components/FileEditor/QuiltConfigEditor/BucketPreferences/State.spec.ts',
      // 'app/components/FileEditor/QuiltConfigEditor/QuiltSummarize/QuiltSummarize.spec.tsx',
      // 'app/components/FileEditor/QuiltConfigEditor/QuiltSummarize/State.spec.tsx',
      'app/components/Logo/index.spec.tsx',
      'app/components/Markdown/Markdown.spec.ts',
      // 'app/components/Preview/loaders/Ngl.spec.ts', // Blocked by JSX in utils/AWS/Config.js
      // 'app/components/Preview/loaders/useGate.spec.ts', // Blocked by JSX in utils/string.js
      // 'app/components/Preview/loaders/useSignObjectUrls.spec.ts', // Blocked by JSX in utils/string.js
      // 'app/components/Preview/quick/Markdown/Render.spec.tsx', // Blocked by JSX in Preview/loaders/Markdown.js
      // 'app/containers/Bucket/Dir/Toolbar/Get/Options.spec.tsx', // Blocked by JSX in utils/AWS/Config.js
      'app/containers/Bucket/Download/PackageCodeSamples.spec.tsx',
      // 'app/containers/Bucket/File/Toolbar/Toolbar.spec.tsx', // Blocked by JSX in components/Thumbnail/Thumbnail.js
      // 'app/containers/Bucket/ListingActions.spec.tsx', // Blocked by JSX in components/Thumbnail/Thumbnail.js
      'app/containers/Bucket/PackageDialog/Inputs/Files/State.spec.ts',
      'app/containers/Bucket/PackageDialog/Inputs/Files/stats.spec.ts',
      // 'app/containers/Bucket/Queries/Athena/Database.spec.tsx', // Blocked by JSX in utils/AWS/Config.js
      'app/containers/Bucket/Queries/Athena/model/createPackage.spec.ts',
      'app/containers/Bucket/Queries/Athena/model/requests.spec.ts',
      'app/containers/Bucket/Queries/Athena/model/state.spec.tsx',
      // 'app/containers/Bucket/requests/object.spec.ts', // Blocked by JSX in components/Thumbnail/Thumbnail.js
      // 'app/containers/Bucket/Successors.spec.tsx', // Blocked by JSX in utils/AWS/Config.js
      // 'app/containers/Bucket/Summarize.spec.tsx', // Blocked by JSX in Notifications/index.js
      'app/containers/Bucket/Toolbar/Toolbar.spec.tsx',
      'app/containers/Bucket/Toolbar/types.spec.ts',
      'app/containers/Bucket/viewModes.spec.ts',
      'app/containers/Search/Layout/Results.spec.tsx',
      // 'app/containers/Search/List/Hit.spec.tsx',
      // 'app/containers/Search/List/index.spec.tsx',
      'app/containers/Search/model.spec.ts',
      // 'app/containers/Search/Table/CellValue.spec.tsx', // Blocked by JSX in utils/string.js
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
  },

  // Module name mapping (equivalent to Jest's moduleNameMapper)
  server: {
    deps: {
      // Handle ESM modules that Jest had issues with
      inline: ['p-limit'],
    },
  },
})
