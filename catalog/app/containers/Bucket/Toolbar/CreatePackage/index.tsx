import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import * as Buttons from 'components/Buttons'

import { useSelection } from '../../Selection/Provider'

export { default as BucketDirOptions } from './BucketDirOptions'
export { default as useSuccessors } from './useSuccessors'

const useStyles = M.makeStyles({
  root: {
    transitionProperty: 'background-color, box-shadow', // Disable border-width transition
  },
})

interface ButtonProps {
  children: NonNullable<React.ReactNode>
  className?: string
  label?: string
}

export function Button({ className, ...props }: ButtonProps) {
  const classes = useStyles()
  const slt = useSelection()
  // FIXME: if slt == null => File button
  // FIXME: make WithPopover#icon optional
  return (
    <Buttons.WithPopover
      className={cx(classes.root, className)}
      label="Create package"
      variant={slt.isEmpty ? 'outlined' : 'contained'}
      color={slt.isEmpty ? 'default' : 'primary'}
      {...props}
    />
  )
}
