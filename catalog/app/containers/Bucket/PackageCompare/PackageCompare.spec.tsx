import * as React from 'react'
import renderer from 'react-test-renderer'

import { RevisionsCompare } from './PackageCompare'

// Mock config
jest.mock('constants/config', () => ({}))

// Mock Material-UI components
jest.mock('@material-ui/core', () => ({
  ...jest.requireActual('@material-ui/core'),
  makeStyles: () => () => ({
    table: {},
    mono: {},
    hash: {},
  }),
  useTheme: () => ({}),
  useMediaQuery: () => false,
}))

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

// Mock format utilities
jest.mock('utils/string', () => ({
  readableBytes: (bytes: number) => `${bytes} bytes`,
  readableQuantity: (qty: number) => `${qty}`,
  trimCenter: (str: string, maxLength: number = 20) =>
    str.length > maxLength
      ? `${str.substring(0, Math.floor(maxLength / 2) - 1)}...${str.substring(str.length - Math.floor(maxLength / 2) + 1)}`
      : str,
}))

// Mock date-fns
jest.mock('date-fns', () => ({
  format: (date: Date) => date.toISOString(),
}))

// Mock MANIFEST_QUERY - will be handled by the existing GQL.useQuery mock

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

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should render without crashing', () => {
    const tree = renderer.create(<RevisionsCompare {...mockPackageHandles} />)
    expect(tree).toBeTruthy()
  })

  it('should render comparison table with both revisions', () => {
    const tree = renderer.create(<RevisionsCompare {...mockPackageHandles} />)
    const instance = tree.root

    // Check that table structure exists
    expect(instance.findAllByType('table')).toHaveLength(1)

    // Check that comparison rows exist
    expect(instance.findAllByType('tr').length).toBeGreaterThan(1)
  })

  it('should match snapshot', () => {
    const tree = renderer.create(<RevisionsCompare {...mockPackageHandles} />)
    expect(tree).toMatchSnapshot()
  })
})
