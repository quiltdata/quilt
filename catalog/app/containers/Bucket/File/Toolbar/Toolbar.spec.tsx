import * as React from 'react'
import { render, cleanup } from '@testing-library/react'
import { renderHook } from '@testing-library/react-hooks'
import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest'

import * as BucketPreferences from 'utils/BucketPreferences'
import { extendDefaults } from 'utils/BucketPreferences/BucketPreferences'

import * as FileToolbar from './Toolbar'

vi.mock('constants/config', () => ({ default: {} }))

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

vi.mock('@material-ui/lab', async () => ({
  ...(await vi.importActual('@material-ui/lab')),
  Skeleton: () => <i>⌛</i>,
}))

vi.mock('components/Buttons', async () => ({
  ...(await vi.importActual('components/Buttons')),
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

vi.mock('containers/Bucket/Toolbar', async () => ({
  ...(await vi.importActual('containers/Bucket/Toolbar')),
  Assist: () => <button>Assist</button>,
}))

const prefsHook: Mock<() => { prefs: BucketPreferences.Result }> = vi.fn(() => ({
  prefs: BucketPreferences.Result.Init(),
}))

vi.mock('utils/BucketPreferences', async () => ({
  ...(await vi.importActual('utils/BucketPreferences')),
  use: () => prefsHook(),
}))

const viewModes = { modes: [], mode: null, handlePreviewResult: vi.fn() }

const editorState = {
  editing: null,
  error: null,
  onCancel: vi.fn(),
  onChange: vi.fn(),
  onEdit: vi.fn(),
  onPreview: vi.fn(),
  onSave: vi.fn(),
  preview: false,
  saving: false,
  types: [],
  value: 'test content',
}

describe('useFeatures', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return null when preferences are loading', () => {
    prefsHook.mockImplementationOnce(() => ({
      prefs: BucketPreferences.Result.Pending(),
    }))

    const { result } = renderHook(() => FileToolbar.useFeatures())

    expect(result.current).toBeNull()
  })

  it('should return all features disabled when all permissions are false', () => {
    prefsHook.mockImplementationOnce(() => ({
      prefs: BucketPreferences.Result.Ok(
        extendDefaults({
          ui: {
            actions: {
              downloadObject: false,
            },
            blocks: {
              code: false,
              qurator: false,
            },
          },
        }),
      ),
    }))

    const { result } = renderHook(() => FileToolbar.useFeatures(false))

    expect(result.current).toEqual({
      get: false,
      organize: { delete: false }, // deleteObject defaults to false
      qurator: false,
    })
  })

  it('should return all features enabled when all permissions are true', () => {
    prefsHook.mockImplementationOnce(() => ({
      prefs: BucketPreferences.Result.Ok(
        extendDefaults({
          ui: {
            actions: {
              downloadObject: true,
              deleteObject: true,
            },
            blocks: {
              code: true,
              qurator: true,
            },
          },
        }),
      ),
    }))

    const { result } = renderHook(() => FileToolbar.useFeatures(false))

    expect(result.current).toEqual({
      get: { code: true },
      organize: { delete: true },
      qurator: true,
    })
  })

  it('should return get as false when file is deleted', () => {
    prefsHook.mockImplementationOnce(() => ({
      prefs: BucketPreferences.Result.Ok(
        extendDefaults({
          ui: {
            actions: {
              downloadObject: true,
            },
            blocks: {
              code: true,
              qurator: true,
            },
          },
        }),
      ),
    }))

    const { result } = renderHook(() => FileToolbar.useFeatures(true))

    expect(result.current).toEqual({
      get: false,
      organize: false,
      qurator: true,
    })
  })
})

const handle = FileToolbar.CreateHandle('test-bucket', 'test/file.txt')

describe('Toolbar', () => {
  afterEach(cleanup)

  it('should render skeleton buttons when features is null', () => {
    const { getAllByText } = render(
      <FileToolbar.Toolbar
        features={null}
        handle={handle}
        onReload={vi.fn()}
        viewModes={viewModes}
      />,
    )
    const skeletonTexts = getAllByText('⌛')
    expect(skeletonTexts.length).toBeGreaterThan(0)
  })

  it('should render all buttons when all features are enabled', () => {
    const { getByTitle, getByText } = render(
      <FileToolbar.Toolbar
        features={{ get: { code: true }, organize: { delete: true }, qurator: true }}
        handle={handle}
        onReload={vi.fn()}
        viewModes={viewModes}
        editorState={editorState}
      />,
    )
    expect(getByTitle('Get file').textContent).toBe('"Get" popover')
    expect(getByTitle('Organize').textContent).toBe('"Organize" popover')
    expect(getByText('Assist')).toBeTruthy()
  })

  it('should render nothing when all features are disabled', () => {
    const { container, queryByTitle, queryByText } = render(
      <FileToolbar.Toolbar
        features={{ get: false, organize: false, qurator: false }}
        handle={handle}
        onReload={vi.fn()}
        viewModes={viewModes}
      />,
    )
    expect(queryByTitle('Get file')).toBeFalsy()
    expect(queryByTitle('Organize')).toBeFalsy()
    expect(queryByText('Assist')).toBeFalsy()
    expect((container.firstChild as HTMLElement).children).toHaveLength(0)
  })

  it('should render buttons for enabled features: get, qurator', () => {
    const { getByTitle, queryByTitle, getByText } = render(
      <FileToolbar.Toolbar
        features={{ get: { code: true }, organize: false, qurator: true }}
        handle={handle}
        onReload={vi.fn()}
        viewModes={viewModes}
      />,
    )
    expect(getByTitle('Get file').textContent).toBe('"Get" popover')
    expect(queryByTitle('Organize')).toBeFalsy()
    expect(getByText('Assist')).toBeTruthy()
  })

  it('should not render organize button when editorState is not provided', () => {
    const { container, queryByTitle } = render(
      <FileToolbar.Toolbar
        features={{ get: false, organize: { delete: true }, qurator: false }}
        handle={handle}
        onReload={vi.fn()}
        viewModes={viewModes}
      />,
    )
    expect(queryByTitle('Organize')).toBeFalsy()
    expect((container.firstChild as HTMLElement).children).toHaveLength(0)
  })

  it('should pass canDelete=true to Organize.Options when delete feature is enabled', () => {
    const { getByTestId } = render(
      <FileToolbar.Toolbar
        features={{ get: false, organize: { delete: true }, qurator: false }}
        handle={handle}
        onReload={vi.fn()}
        viewModes={viewModes}
        editorState={editorState}
      />,
    )
    const organizeOptions = getByTestId('organize-options')
    expect(organizeOptions.getAttribute('data-can-delete')).toBe('true')
  })

  it('should pass canDelete=false to Organize.Options when delete feature is disabled', () => {
    const { getByTestId } = render(
      <FileToolbar.Toolbar
        features={{ get: false, organize: { delete: false }, qurator: false }}
        handle={handle}
        onReload={vi.fn()}
        viewModes={viewModes}
        editorState={editorState}
      />,
    )
    const organizeOptions = getByTestId('organize-options')
    expect(organizeOptions.getAttribute('data-can-delete')).toBe('false')
  })
})
