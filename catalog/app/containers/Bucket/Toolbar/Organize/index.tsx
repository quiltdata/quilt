import * as React from 'react'
import * as M from '@material-ui/core'

import { PlaylistAddCheckOutlined as IconPlaylistAddCheckOutlined } from '@material-ui/icons'

import * as Buttons from 'components/Buttons'
import type * as FileEditor from 'components/FileEditor'

import { useSelection } from '../../Selection/Provider'

import type { Handle } from '../types'
import * as Context from './Context'

export { default as BucketDirOptions } from './BucketDirOptions'
export { default as BucketFileOptions } from './BucketFileOptions'

const useBadgeClasses = M.makeStyles({
  badge: {
    right: '4px',
  },
})

interface ButtonProps {
  children: NonNullable<React.ReactNode>
  className?: string
  handle: Handle
  onReload: () => void
  editorState?: FileEditor.EditorState
}

export function Button({ onReload, handle, editorState, ...props }: ButtonProps) {
  const slt = useSelection()
  const classes = useBadgeClasses()
  return (
    <Context.Provider onReload={onReload} handle={handle} editorState={editorState}>
      <M.Badge badgeContent={slt.totalCount} classes={classes} color="primary" max={999}>
        <Buttons.WithPopover
          icon={IconPlaylistAddCheckOutlined}
          label="Organize"
          disabled={slt.inited && !slt.totalCount}
          {...props}
        />
      </M.Badge>
    </Context.Provider>
  )
}
