import * as React from 'react'
import { renderHook } from '@testing-library/react-hooks'
import { describe, it, expect, vi } from 'vitest'

import { useState as useEditorState } from 'components/FileEditor/State'
import * as PackageUri from 'utils/PackageUri'

import * as FileToolbar from '../Toolbar'

import * as Organize from './Context'

vi.mock('constants/config', () => ({ default: {} }))
vi.mock('containers/Bookmarks', () => ({ use: () => null }))
vi.mock('containers/Bucket/Toolbar/DeleteDialog', () => ({ default: () => null }))
vi.mock('utils/Dialogs', () => ({ use: () => ({ open: vi.fn(), render: () => null }) }))
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useHistory: () => ({ push: vi.fn() }),
  useLocation: () => ({ search: route.search }),
}))
vi.mock('utils/NamedRoutes', () => ({ use: () => ({ urls: {} }) }))
vi.mock('components/FileEditor/loader', async () => ({
  ...(await vi.importActual('components/FileEditor/loader')),
  useWriteData: () => vi.fn(),
}))
vi.mock('utils/PackageLock', async () => ({
  ...(await vi.importActual('utils/PackageLock')),
  useLockStatus: () => route.lock,
}))
vi.mock('utils/BucketPreferences', async () => {
  const BP = await vi.importActual<typeof import('utils/BucketPreferences')>(
    'utils/BucketPreferences',
  )
  const prefs = BP.Result.Ok({ ui: { actions: { writeFile: false } } } as never)
  return { ...BP, use: () => ({ prefs }), useForBucket: () => prefs }
})

const { route } = vi.hoisted(() => ({ route: { search: '', lock: 'unlocked' } }))

const handle = { bucket: 'b', key: 'team/ds/README.md' }

// Renders the Provider over the real editor state, so the plain-file case runs
// through the same writability the editor itself uses.
function organize(search: string, lock: string) {
  route.search = search
  route.lock = lock
  const Inner = ({ children }: React.PropsWithChildren<{}>) => {
    const editorState = useEditorState(handle)
    return (
      <Organize.Provider
        editorState={editorState}
        handle={FileToolbar.CreateHandle(handle.bucket, handle.key)}
        onReload={() => {}}
      >
        {children}
      </Organize.Provider>
    )
  }
  return renderHook(() => Organize.use(), { wrapper: Inner }).result.current.editTypes
}

describe('containers/Bucket/File/Toolbar/Organize/Context', () => {
  it('keeps the Edit entries of a plain bucket file with writeFile off', () => {
    expect(organize('', 'unlocked').map((t) => t.brace)).toEqual(['markdown'])
  })

  it('hides the Edit entries of a file added to a locked package', () => {
    const add = PackageUri.stringify({ bucket: 'b', name: 'team/ds', path: 'README.md' })
    expect(organize(`?add=${encodeURIComponent(add)}`, 'locked')).toEqual([])
  })
})
