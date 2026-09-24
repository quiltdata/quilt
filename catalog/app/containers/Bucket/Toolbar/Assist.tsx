import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import * as Assistant from 'components/Assistant'

// A class, not an inline style: toolbars neutralize their children's margins
// at stacked breakpoints, and inline styles are unreachable from a stylesheet.
const useStyles = M.makeStyles({
  root: {
    marginBottom: -12,
    marginTop: -12,
  },
})

interface AssistButtonProps extends M.IconButtonProps {
  title?: string
  message?: string
}

export default function AssistButton({
  className,
  message,
  title,
  ...props
}: AssistButtonProps) {
  const classes = useStyles()
  const assist = Assistant.use()
  if (!assist) return null
  return (
    <M.IconButton
      className={cx(classes.root, className)}
      color="primary"
      onClick={() => assist(message || 'Summarize this document')}
      edge="end"
      {...props}
    >
      <M.Tooltip title={title || 'Summarize and chat with AI'}>
        <M.Icon>assistant</M.Icon>
      </M.Tooltip>
    </M.IconButton>
  )
}
