import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

// Renders a Material icon in the Outlined variant. The outlined font is loaded
// after the filled one in index.html, so `material-icons-outlined` wins the
// font-family cascade over MUI's built-in `material-icons` class.
export default function OutlinedIcon({
  className,
  ...props
}: React.ComponentProps<typeof M.Icon>) {
  return <M.Icon className={cx('material-icons-outlined', className)} {...props} />
}
