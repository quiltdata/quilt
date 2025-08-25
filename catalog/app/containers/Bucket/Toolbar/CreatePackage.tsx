import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import * as Buttons from 'components/Buttons'
import { useSelection } from 'containers/Bucket/Selection/Provider'

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

export default function Button({ className, ...props }: ButtonProps) {
  const classes = useStyles()
  const slt = useSelection()
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
