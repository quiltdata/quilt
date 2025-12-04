import * as React from 'react'
import { render } from '@testing-library/react'
import { renderHook } from '@testing-library/react-hooks'
import { describe, it, expect, vi, beforeEach } from 'vitest'

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
  Options: () => <>"Organize" popover</>,
}))

vi.mock('@material-ui/lab', async () => {
  const actual = await vi.importActual('@material-ui/lab')
  return {
    ...actual,
    Skeleton: () => <i>⌛</i>,
  }
})

vi.mock('components/Buttons', async () => {
  const actual = await vi.importActual('components/Buttons')
  return {
    ...actual,
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
  }
})

vi.mock('containers/Bucket/Toolbar', async () => {
  const actual = await vi.importActual('containers/Bucket/Toolbar')
  return {
    ...actual,
    Assist: () => <button>Assist</button>,
  }
})

const prefsHook = vi.fn(() => ({
  prefs: BucketPreferences.Result.Init(),
}))

vi.mock('utils/BucketPreferences', async () => {
  const actual = await vi.importActual('utils/BucketPreferences')
  return {
    ...actual,
    use: () => prefsHook(),
  }
})

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
      organize: true, // Always true in the implementation
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
      organize: true,
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
  it('should render skeleton buttons when features is null', () => {
    const { container } = render(
      <FileToolbar.Toolbar
        features={null}
        handle={handle}
        onReload={vi.fn()}
        viewModes={viewModes}
      />,
    )

    expect(container.firstChild).toMatchSnapshot()
  })

  it('should render all buttons when all features are enabled', () => {
    const { container } = render(
      <FileToolbar.Toolbar
        features={{ get: { code: true }, organize: true, qurator: true }}
        handle={handle}
        onReload={vi.fn()}
        viewModes={viewModes}
        editorState={editorState}
      />,
    )

    expect(container.firstChild).toMatchSnapshot()
  })

  it('should render nothing when all features are disabled', () => {
    const { container } = render(
      <FileToolbar.Toolbar
        features={{ get: false, organize: false, qurator: false }}
        handle={handle}
        onReload={vi.fn()}
        viewModes={viewModes}
      />,
    )

    expect(container.firstChild).toMatchSnapshot()
  })

  it('should render buttons for enabled features: get, qurator', () => {
    const { container } = render(
      <FileToolbar.Toolbar
        features={{ get: { code: true }, organize: false, qurator: true }}
        handle={handle}
        onReload={vi.fn()}
        viewModes={viewModes}
      />,
    )

    expect(container.firstChild).toMatchSnapshot()
  })

  it('should not render organize button when editorState is not provided', () => {
    const { container } = render(
      <FileToolbar.Toolbar
        features={{ get: false, organize: true, qurator: false }}
        handle={handle}
        onReload={vi.fn()}
        viewModes={viewModes}
      />,
    )

    expect(container.firstChild).toMatchSnapshot()
  })
})
