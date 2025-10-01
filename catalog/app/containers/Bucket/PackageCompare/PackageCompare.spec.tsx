import * as React from 'react'
import renderer from 'react-test-renderer'

import { RevisionsCompare } from './PackageCompare'

jest.mock('@material-ui/core', () => ({
  ...jest.requireActual('@material-ui/core'),
  makeStyles: () => () => ({}),
}))

// Mock config
jest.mock('constants/config', () => ({}))

// Mock GraphQL hook
jest.mock('utils/GraphQL', () => ({
  useQuery: jest.fn((_query, variables) => {
    // Return different mock data based on the query type
    if (variables.max !== undefined) {
      // This is a manifest query
      return {
        data: {
          package: {
            revision: {
              contentsFlatMap: {
                'file1.txt': { size: 100 },
                'file2.txt': { size: 200 },
              },
            },
          },
        },
      }
    }
    // This is a revision list query
    return {
      data: {
        package: {
          revisions: {
            page: [
              {
                hash: 'hash1',
                modified: new Date('2023-01-01'),
                message: 'Test message 1',
                userMeta: { test: 'meta1' },
                totalBytes: 1000,
                totalEntries: 5,
              },
              {
                hash: 'hash2',
                modified: new Date('2023-01-02'),
                message: 'Test message 2',
                userMeta: { test: 'meta2' },
                totalBytes: 2000,
                totalEntries: 10,
              },
            ],
          },
        },
      },
    }
  }),
  fold: jest.fn((query, cases) => cases.data(query.data)),
}))

// Mock NamedRoutes
jest.mock('utils/NamedRoutes', () => ({
  use: jest.fn(() => ({
    urls: {
      bucketPackageTree: (bucket: string, name: string, hash: string) =>
        `/b/${bucket}/packages/${name}/tree/${hash}`,
      bucketPackageDetail: (bucket: string, name: string) =>
        `/b/${bucket}/packages/${name}`,
    },
  })),
}))

// Mock copyToClipboard
jest.mock('utils/clipboard', () => jest.fn())

// Mock JsonDisplay component
jest.mock('components/JsonDisplay', () =>
  jest.fn(({ value }: { value: any }) => (
    <div data-testid="json-display">{JSON.stringify(value)}</div>
  )),
)

// Mock Skeleton component
jest.mock('components/Skeleton', () => jest.fn(() => <div data-testid="skeleton" />))

// Mock StyledLink component
jest.mock('utils/StyledLink', () =>
  jest.fn(({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  )),
)

// Mock react-diff-viewer-continued
jest.mock('react-diff-viewer-continued', () =>
  jest.fn(
    ({
      oldValue,
      newValue,
      leftTitle,
      rightTitle,
    }: {
      oldValue: string
      newValue: string
      leftTitle: string
      rightTitle: string
    }) => (
      <div data-testid="diff-viewer">
        <div>{leftTitle}</div>
        <div>{rightTitle}</div>
        <pre>{oldValue}</pre>
        <pre>{newValue}</pre>
      </div>
    ),
  ),
)

describe('containers/Bucket/PackageCompare/PackageCompare', () => {
  const mockPackageHandles = {
    left: {
      bucket: 'test-bucket',
      name: 'test-package',
      hash: 'hash1',
    },
    right: {
      bucket: 'test-bucket',
      name: 'test-package',
      hash: 'hash2',
    },
    onLeftChange: () => {},
    onRightChange: () => {},
  }

  it('should render without crashing', () => {
    const tree = renderer.create(<RevisionsCompare {...mockPackageHandles} />)
    expect(tree).toBeTruthy()
  })
})
