import * as React from 'react'

import type * as FileEditor from 'components/FileEditor'
import assertNever from 'utils/assertNever'

import type { Handle } from '../types'

import * as ContextDir from './ContextDir'
import * as ContextFile from './ContextFile'

interface ProviderProps {
  children: React.ReactNode
  onReload: () => void
  handle: Handle
  editorState?: FileEditor.EditorState
}

export function Provider({ handle, ...props }: ProviderProps) {
  switch (handle._tag) {
    case 'file':
      return <ContextFile.Provider handle={handle} {...props} />
    case 'dir':
      return <ContextDir.Provider {...props} />
    default:
      assertNever(handle)
  }
}
