import * as React from 'react'
import * as Buttons from 'components/Buttons'

import { useSelection } from '../../Selection/Provider'

export { default as BucketDirOptions } from './BucketDirOptions'
export { default as useSuccessors } from './useSuccessors'

interface ButtonProps {
  children: NonNullable<React.ReactNode>
  className?: string
  label?: string
}

export function Button(props: ButtonProps) {
  const slt = useSelection()
  // FIXME: if slt == null => File button
  // FIXME: make WithPopover#icon optional
  return (
    <Buttons.WithPopover
      label="Create package"
      variant={slt.isEmpty ? 'outlined' : 'contained'}
      color={slt.isEmpty ? 'default' : 'primary'}
      {...props}
    />
  )
}
