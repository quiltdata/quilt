import * as React from 'react'
import { render } from '@testing-library/react'
import { renderHook } from '@testing-library/react-hooks'

import * as BucketPreferences from 'utils/BucketPreferences'
import { extendDefaults } from 'utils/BucketPreferences/BucketPreferences'

import * as DirToolbar from './Toolbar'

jest.mock(
  'constants/config',
  jest.fn(() => ({})),
)

jest.mock(
  './Add',
  jest.fn(() => ({
    Context: () => ({
      Provider: (children: React.ReactNode) => <>{children}</>,
    }),
    Options: () => <>"Add" popover</>,
  })),
)
jest.mock(
  './Get',
  jest.fn(() => ({
    Options: () => <>"Add" popover</>,
  })),
)
jest.mock(
  './Organize',
  jest.fn(() => ({
    Context: () => ({
      Provider: (children: React.ReactNode) => <>{children}</>,
    }),
    Options: () => <>"Organize" popover</>,
  })),
)
jest.mock(
  './CreatePackage',
  jest.fn(() => ({
    Options: () => <>"Create package" popover</>,
    useSuccessors: jest.fn(() => {}),
  })),
)

jest.mock('containers/Bucket/PackageDialog', () => ({
  usePackageCreationDialog: jest.fn(() => ({
    open: jest.fn(),
    render: jest.fn(),
  })),
}))

jest.mock(
  'components/Buttons',
  jest.fn(() => ({
    Skeleton: () => <i>⌛</i>,
  })),
)

const prefsHook: jest.Mock<{ prefs: BucketPreferences.Result }> = jest.fn(() => ({
  prefs: BucketPreferences.Result.Init(),
}))

jest.mock('utils/BucketPreferences', () => ({
  ...jest.requireActual('utils/BucketPreferences'),
  use: () => prefsHook(),
}))

describe('useFeatures', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return null when preferences are loading', () => {
    prefsHook.mockImplementationOnce(() => ({
      prefs: BucketPreferences.Result.Pending(),
    }))

    const { result } = renderHook(() => DirToolbar.useFeatures())

    expect(result.current).toBeNull()
  })

  it('should return all features disabled when all permissions are false', () => {
    prefsHook.mockImplementationOnce(() => ({
      prefs: BucketPreferences.Result.Ok(
        extendDefaults({
          ui: {
            actions: {
              writeFile: false,
              downloadObject: false,
              createPackage: false,
            },
            blocks: {
              code: false,
            },
          },
        }),
      ),
    }))

    const { result } = renderHook(() => DirToolbar.useFeatures())

    expect(result.current).toEqual({
      add: false,
      get: false,
      organize: true, // Always true in the implementation
      createPackage: false,
    })
  })

  it('should return all features enabled when all permissions are true', () => {
    prefsHook.mockImplementationOnce(() => ({
      prefs: BucketPreferences.Result.Ok(
        extendDefaults({
          ui: {
            actions: {
              writeFile: true,
              downloadObject: true,
              createPackage: true,
            },
            blocks: {
              code: true,
            },
          },
        }),
      ),
    }))

    const { result } = renderHook(() => DirToolbar.useFeatures())

    expect(result.current).toEqual({
      add: true,
      get: { code: true },
      organize: true,
      createPackage: true,
    })
  })
})

const handle = DirToolbar.CreateHandle('test-bucket', 'test/path')

describe('Toolbar', () => {
  it('should render skeleton buttons when features is null', () => {
    const { container } = render(
      <DirToolbar.Toolbar features={null} handle={handle} onReload={jest.fn()} />,
    )

    expect(container.firstChild).toMatchSnapshot()
  })
})
