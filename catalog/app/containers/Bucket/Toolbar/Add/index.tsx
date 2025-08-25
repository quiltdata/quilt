import * as React from 'react'

import { AddOutlined as IconAddOutlined } from '@material-ui/icons'

import * as Buttons from 'components/Buttons'

export * as ContextDir from './ContextDir'

export { default as BucketDirOptions } from './BucketDirOptions'
export { default as UploadDialog } from './UploadDialog'

interface ButtonProps {
  children: NonNullable<React.ReactNode>
  className?: string
  label?: string
}

export function Button({ children, label = 'Add files', ...props }: ButtonProps) {
  return (
    <Buttons.WithPopover icon={IconAddOutlined} label={label} {...props}>
      {children}
    </Buttons.WithPopover>
  )
}
