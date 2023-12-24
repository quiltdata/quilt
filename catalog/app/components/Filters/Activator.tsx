import * as React from 'react'
import * as M from '@material-ui/core'

const useStyles = M.makeStyles((t) => ({
  icon: {
    minWidth: t.spacing(4),
  },
}))

interface ActivatorProps {
  disabled?: boolean
  onClick: () => void
  title: React.ReactNode
}

export default React.forwardRef<HTMLDivElement, ActivatorProps>(function Activator(
  { disabled, onClick, title },
  ref,
) {
  const classes = useStyles()
  return (
    <M.ListItem button disableGutters disabled={disabled} onClick={onClick} ref={ref}>
      <M.ListItemIcon className={classes.icon}>
        <M.Icon>add_circle_outline</M.Icon>
      </M.ListItemIcon>
      <M.ListItemText primary={title} />
    </M.ListItem>
  )
})
