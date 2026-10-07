import * as React from 'react'
import { renderHook } from '@testing-library/react-hooks'
import { describe, it, expect, vi } from 'vitest'

import type * as FileEditor from 'components/FileEditor'

import * as FileToolbar from '../Toolbar'

import * as Organize from './Context'

vi.mock('constants/config', () => ({ default: {} }))
vi.mock('containers/Bookmarks', () => ({ use: () => null }))
vi.mock('containers/Bucket/Toolbar/DeleteDialog', () => ({ default: () => null }))
vi.mock('utils/Dialogs', () => ({ use: () => ({ open: vi.fn(), render: () => null }) }))
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useLocation: () => ({ search: '' }),
}))

const types = [{ brace: 'markdown' }] as FileEditor.EditorInputType[]

const editTypes = (writable: boolean) =>
  renderHook(() => Organize.use(), {
    wrapper: ({ children }) => (
      <Organize.Provider
        editorState={{ types, writable } as FileEditor.EditorState}
        handle={FileToolbar.CreateHandle('b', 'k')}
        onReload={() => {}}
      >
        {children}
      </Organize.Provider>
    ),
  }).result.current.editTypes

describe('containers/Bucket/File/Toolbar/Organize/Context', () => {
  it('offers the editor types for a writable file', () => {
    expect(editTypes(true)).toEqual(types)
  })

  it('offers no edit entries the editor would refuse', () => {
    expect(editTypes(false)).toEqual([])
  })
})
