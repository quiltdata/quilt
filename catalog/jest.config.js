const path = require('path')

module.exports = {
  preset: 'ts-jest/presets/js-with-ts',
  testEnvironment: 'jsdom',
  testEnvironmentOptions: {
    url: 'https://quilt-test',
  },
  collectCoverageFrom: [
    'app/**/*.{j,t}s{,x}',
    '!app/**/*.test.{j,t}s{,x}',
    '!app/**/mocks/*.{j,t}s{,x}',
    '!app/*/RbGenerated*/*.{j,t}s{,x}',
    '!app/app.{j,t}s{,x}',
    '!app/global-styles.{j,t}s{,x}',
    '!app/*/*/Loadable.{j,t}s{,x}',
  ],
  // TODO: increase this gradually while writing the new tests
  coverageThreshold: {
    global: {
      statements: 4,
      branches: 3,
      functions: 2,
      lines: 4,
    },
  },
  moduleDirectories: ['node_modules', 'app', path.resolve(__dirname, '../shared')],
  // TODO: convert mocks to ts?
  moduleNameMapper: {
    '.*\\.(css|less|styl|scss|sass)$': '<rootDir>/internals/mocks/cssModule.js',
    '.*\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$':
      '<rootDir>/internals/mocks/image.js',
    '^p-limit$': '<rootDir>/internals/mocks/p-limit.js', // XXX: use ESM
    '^msgpackr$': require.resolve('msgpackr'), // ESM issue
  },
  setupFiles: ['jest-localstorage-mock', './setup-jest.ts'],
  // Explicitly list all test files (for gradual migration to Vitest)
  testMatch: [
    // '<rootDir>/app/components/Assistant/Model/GlobalContext/navigation.spec.ts', // Migrated to Vitest
    // '<rootDir>/app/components/BreadCrumbs/BreadCrumbs.spec.tsx', // Migrated to Vitest
    // '<rootDir>/app/components/BucketIcon/BucketIcon.spec.tsx', // Migrated to Vitest
    // '<rootDir>/app/components/Buttons/Iconized.spec.tsx', // Migrated to Vitest
    // '<rootDir>/app/components/Buttons/Skeleton.spec.tsx', // Migrated to Vitest
    // '<rootDir>/app/components/Buttons/WithPopover.spec.tsx', // Migrated to Vitest
    '<rootDir>/app/components/FileEditor/CreateFile.spec.tsx',
    '<rootDir>/app/components/FileEditor/FileEditor.spec.tsx',
    // '<rootDir>/app/components/FileEditor/HelpLinks.spec.tsx', // Migrated to Vitest
    '<rootDir>/app/components/FileEditor/loader.spec.ts',
    '<rootDir>/app/components/FileEditor/QuiltConfigEditor/BucketPreferences/BucketPreferences.spec.tsx',
    '<rootDir>/app/components/FileEditor/QuiltConfigEditor/BucketPreferences/State.spec.ts',
    '<rootDir>/app/components/FileEditor/QuiltConfigEditor/QuiltSummarize/QuiltSummarize.spec.tsx',
    '<rootDir>/app/components/FileEditor/QuiltConfigEditor/QuiltSummarize/State.spec.tsx',
    // '<rootDir>/app/components/FileEditor/routes.spec.ts', // Migrated to Vitest
    // '<rootDir>/app/components/Filters/DatesRange.spec.tsx', // Migrated to Vitest
    '<rootDir>/app/components/Filters/NumbersRange.spec.tsx',
    // '<rootDir>/app/components/JsonEditor/State.spec.js', // Migrated to Vitest
    // '<rootDir>/app/components/Layout/Container.spec.tsx', // Migrated to Vitest
    // '<rootDir>/app/components/Logo/index.spec.tsx', // Migrated to Vitest
    // '<rootDir>/app/components/Markdown/Markdown.spec.ts', // Migrated to Vitest
    // '<rootDir>/app/components/Markdown/parseTasklist.spec.ts', // Migrated to Vitest
    '<rootDir>/app/components/Preview/loaders/Ngl.spec.ts',
    '<rootDir>/app/components/Preview/loaders/useGate.spec.ts',
    '<rootDir>/app/components/Preview/loaders/useSignObjectUrls.spec.ts',
    '<rootDir>/app/components/Preview/loaders/Vega.spec.js',
    // '<rootDir>/app/components/Preview/quick/index.spec.tsx', // Migrated to Vitest
    '<rootDir>/app/components/Preview/quick/Markdown/Render.spec.tsx',
    // '<rootDir>/app/constants/routes.spec.ts', // Migrated to Vitest
    '<rootDir>/app/containers/Bucket/CodeSamples.spec.tsx',
    '<rootDir>/app/containers/Bucket/Dir/Toolbar/Get/Options.spec.tsx',
    '<rootDir>/app/containers/Bucket/Dir/Toolbar/Toolbar.spec.tsx',
    // '<rootDir>/app/containers/Bucket/Download/PackageCodeSamples.spec.tsx', // Migrated to Vitest
    '<rootDir>/app/containers/Bucket/File/Toolbar/Toolbar.spec.tsx',
    '<rootDir>/app/containers/Bucket/ListingActions.spec.tsx',
    '<rootDir>/app/containers/Bucket/Overview/Downloads.spec.ts',
    // '<rootDir>/app/containers/Bucket/PackageCompare/Diff/compareJsons.spec.ts', // Migrated to Vitest
    // '<rootDir>/app/containers/Bucket/PackageCompare/Diff/diffJsons.spec.ts', // Migrated to Vitest
    // '<rootDir>/app/containers/Bucket/PackageCompare/Diff/Summary/comparePackageEntries.spec.ts', // Migrated to Vitest
    // '<rootDir>/app/containers/Bucket/PackageDialog/Inputs/Files/State.spec.ts', // Migrated to Vitest
    // '<rootDir>/app/containers/Bucket/PackageDialog/Inputs/Files/stats.spec.ts', // Migrated to Vitest
    // '<rootDir>/app/containers/Bucket/PackageDialog/Layout.spec.ts', // Migrated to Vitest
    // '<rootDir>/app/containers/Bucket/PackageDialog/State/form.spec.ts', // Migrated to Vitest
    '<rootDir>/app/containers/Bucket/PackageDialog/State/meta.spec.ts',
    '<rootDir>/app/containers/Bucket/PackageDialog/State/name.spec.ts',
    '<rootDir>/app/containers/Bucket/PackageDialog/State/params.spec.ts',
    // '<rootDir>/app/containers/Bucket/PackageDialog/State/schema.spec.ts', // Migrated to Vitest
    '<rootDir>/app/containers/Bucket/Queries/Athena/Database.spec.tsx',
    // '<rootDir>/app/containers/Bucket/Queries/Athena/model/createPackage.spec.ts', // Migrated to Vitest
    // '<rootDir>/app/containers/Bucket/Queries/Athena/model/requests.spec.ts', // Migrated to Vitest
    // '<rootDir>/app/containers/Bucket/Queries/Athena/model/state.spec.tsx', // Migrated to Vitest
    // '<rootDir>/app/containers/Bucket/Queries/QuerySelect.spec.tsx', // Migrated to Vitest
    '<rootDir>/app/containers/Bucket/requests/object.spec.ts',
    '<rootDir>/app/containers/Bucket/Selection/Dashboard.spec.tsx',
    // '<rootDir>/app/containers/Bucket/Selection/utils.spec.ts', // Migrated to Vitest
    '<rootDir>/app/containers/Bucket/Successors.spec.tsx',
    '<rootDir>/app/containers/Bucket/Summarize.spec.tsx',
    // '<rootDir>/app/containers/Bucket/Toolbar/Toolbar.spec.tsx', // Migrated to Vitest
    // '<rootDir>/app/containers/Bucket/Toolbar/types.spec.ts', // Migrated to Vitest
    // '<rootDir>/app/containers/Bucket/viewModes.spec.ts', // Migrated to Vitest
    // '<rootDir>/app/containers/Redir/Redir.spec.tsx', // Migrated to Vitest
    // '<rootDir>/app/containers/Search/Layout/Results.spec.tsx', // Migrated to Vitest
    '<rootDir>/app/containers/Search/List/Hit.spec.tsx',
    '<rootDir>/app/containers/Search/List/index.spec.tsx',
    // '<rootDir>/app/containers/Search/model.spec.ts', // Migrated to Vitest
    '<rootDir>/app/containers/Search/Table/CellValue.spec.tsx',
    // '<rootDir>/app/containers/Search/Table/index.spec.tsx', // Migrated to Vitest
    // '<rootDir>/app/utils/AWS/Bedrock/History.spec.ts', // Migrated to Vitest
    // '<rootDir>/app/utils/AWS/Bedrock/Message.spec.ts', // Migrated to Vitest
    // '<rootDir>/app/utils/BucketPreferences/BucketPreferences.spec.ts', // Migrated to Vitest
    // '<rootDir>/app/utils/checksums/checksums.spec.ts', // Migrated to Vitest
    // '<rootDir>/app/utils/defer.spec.ts', // Migrated to Vitest
    // '<rootDir>/app/utils/error.spec.ts', // Migrated to Vitest
    // '<rootDir>/app/utils/format.spec.tsx', // Migrated to Vitest
    // '<rootDir>/app/utils/JSONOneliner.spec.ts', // Migrated to Vitest
    // '<rootDir>/app/utils/JSONPointer.spec.ts', // Migrated to Vitest
    // '<rootDir>/app/utils/JSONSchema/JSONSchema.spec.ts', // Migrated to Vitest
    // '<rootDir>/app/utils/MetaTitle.spec.tsx', // Migrated to Vitest
    // '<rootDir>/app/utils/packageHandle.spec.ts', // Migrated to Vitest
    // '<rootDir>/app/utils/PackageUri.spec.ts', // Migrated to Vitest
    // '<rootDir>/app/utils/Resource.spec.ts', // Migrated to Vitest
    // '<rootDir>/app/utils/s3paths.spec.ts', // Migrated to Vitest
    // '<rootDir>/app/utils/spreadsheets/spreadsheets.spec.ts', // Migrated to Vitest
    // '<rootDir>/app/utils/tagged.spec.js', // Migrated to Vitest
    // '<rootDir>/app/utils/taggedV2.spec.ts', // Migrated to Vitest
    // '<rootDir>/app/utils/validators.spec.js', // Migrated to Vitest
    // '<rootDir>/app/utils/workflows.spec.ts', // Migrated to Vitest
  ],
  snapshotSerializers: [],
}
