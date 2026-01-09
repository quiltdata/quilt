import * as React from 'react'
import { beforeEach, describe, it, expect, vi, afterEach, type Mock } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { renderHook } from '@testing-library/react-hooks'

import * as BucketPreferences from 'utils/BucketPreferences'
import { extendDefaults } from 'utils/BucketPreferences/BucketPreferences'
import noop from 'utils/noop'

import * as DirToolbar from './Toolbar'

vi.mock('constants/config', () => ({ default: {} }))

vi.mock('./Add', () => ({
  Context: {
    Provider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  },
  Options: () => <>"Add" popover</>,
}))

vi.mock('./Get', () => ({
  Options: () => <div>"Get" popover</div>,
}))

vi.mock('./Organize', () => ({
  Context: {
    Provider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  },
  Options: ({ canDelete }: { canDelete?: boolean }) => (
    <div data-testid="organize-options" data-can-delete={canDelete}>
      "Organize" popover
    </div>
  ),
}))

vi.mock('./CreatePackage', () => ({
  Options: () => <>"Create package" popover</>,
  useSuccessors: noop,
}))

vi.mock('containers/Bucket/PackageDialog', () => ({
  useCreateDialog: () => ({
    open: vi.fn(),
    render: vi.fn(),
  }),
}))

vi.mock('@material-ui/lab', () => ({
  Skeleton: () => <i>⌛</i>,
}))

vi.mock('components/Buttons', () => ({
  WithPopover: ({
    label,
    children,
    disabled,
  }: {
    disabled: boolean
    label: string
    children: React.ReactNode
  }) => (
    <button title={label} disabled={disabled}>
      {children}
    </button>
  ),
}))

const prefsHook: Mock<() => { prefs: BucketPreferences.Result }> = vi.fn(() => ({
  prefs: BucketPreferences.Result.Init(),
}))

vi.mock('utils/BucketPreferences', async () => ({
  ...(await vi.importActual('utils/BucketPreferences')),
  use: () => prefsHook(),
}))

describe('useFeatures', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
      organize: { delete: false }, // deleteObject defaults to false
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
              deleteObject: true,
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
      organize: { delete: true },
      createPackage: true,
    })
  })
})

const handle = DirToolbar.CreateHandle('test-bucket', 'test/path')

describe('Toolbar', () => {
  afterEach(cleanup)

  it('should render skeleton buttons when features is null', () => {
    const { getAllByText } = render(
      <DirToolbar.Toolbar features={null} handle={handle} onReload={vi.fn()} />,
    )
    const skeletonTexts = getAllByText('⌛')
    expect(skeletonTexts.length).toBeGreaterThan(0)
  })

  it('should render all buttons when all features are enabled', () => {
    const { getByTitle } = render(
      <DirToolbar.Toolbar
        features={{
          add: true,
          get: { code: true },
          organize: { delete: true },
          createPackage: true,
        }}
        handle={handle}
        onReload={vi.fn()}
      />,
    )
    expect(getByTitle('Add files').textContent).toBe('"Add" popover')
    expect(getByTitle('Get files').textContent).toBe('"Get" popover')
    expect(getByTitle('Organize').textContent).toBe('"Organize" popover')
    expect(getByTitle('Create package').textContent).toBe('"Create package" popover')
  })

  it('should render nothing when all features are disabled', () => {
    const { queryByTitle } = render(
      <DirToolbar.Toolbar
        features={{ add: false, get: false, organize: false, createPackage: false }}
        handle={handle}
        onReload={vi.fn()}
      />,
    )
    expect(queryByTitle('Add files')).toBeFalsy()
    expect(queryByTitle('Get files')).toBeFalsy()
    expect(queryByTitle('Organize')).toBeFalsy()
    expect(queryByTitle('Create package')).toBeFalsy()
  })

  it('should render buttons for enabled features: add, organize', () => {
    const { getByTitle, queryByTitle } = render(
      <DirToolbar.Toolbar
        features={{
          add: true,
          get: false,
          organize: { delete: true },
          createPackage: false,
        }}
        handle={handle}
        onReload={vi.fn()}
      />,
    )
    expect(getByTitle('Add files').textContent).toBe('"Add" popover')
    expect(getByTitle('Organize').textContent).toBe('"Organize" popover')
    expect(queryByTitle('Get files')).toBeFalsy()
    expect(queryByTitle('Create package')).toBeFalsy()
  })

  it('should pass canDelete=true to Organize.Options when delete feature is enabled', () => {
    const { getByTestId } = render(
      <DirToolbar.Toolbar
        features={{
          add: false,
          get: false,
          organize: { delete: true },
          createPackage: false,
        }}
        handle={handle}
        onReload={vi.fn()}
      />,
    )
    const organizeOptions = getByTestId('organize-options')
    expect(organizeOptions.getAttribute('data-can-delete')).toBe('true')
  })

  it('should pass canDelete=false to Organize.Options when delete feature is disabled', () => {
    const { getByTestId } = render(
      <DirToolbar.Toolbar
        features={{
          add: false,
          get: false,
          organize: { delete: false },
          createPackage: false,
        }}
        handle={handle}
        onReload={vi.fn()}
      />,
    )
    const organizeOptions = getByTestId('organize-options')
    expect(organizeOptions.getAttribute('data-can-delete')).toBe('false')
  })
})
