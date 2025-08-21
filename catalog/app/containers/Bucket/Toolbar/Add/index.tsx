import * as React from 'react'

import { AddOutlined as IconAddOutlined } from '@material-ui/icons'

import * as Buttons from 'components/Buttons'

import type { DirHandle } from '../types'

import * as Context from './ContextDir'

export { default as BucketDirOptions } from './BucketDirOptions'
export { default as UploadDialog } from './UploadDialog'

interface ButtonProps {
  children: NonNullable<React.ReactNode>
  className?: string
  handle: DirHandle
  label?: string
}

export function Button({ children, handle, label = 'Add files', ...props }: ButtonProps) {
  return (
    <Context.Provider handle={handle}>
      <Buttons.WithPopover icon={IconAddOutlined} label={label} {...props}>
        {children}
      </Buttons.WithPopover>
    </Context.Provider>
  )
}
