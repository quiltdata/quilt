import * as React from 'react'
import * as M from '@material-ui/core'

const useStyles = M.makeStyles((t) => ({
  icon: {
    minWidth: t.spacing(4),
  },
}))

interface ActivatorProps {
  title: React.ReactNode
  onClick: () => void
}

export default React.forwardRef<HTMLDivElement, ActivatorProps>(function Activator(
  { title, onClick },
  ref,
) {
  const classes = useStyles()
  return (
    <M.ListItem button disableGutters onClick={onClick} ref={ref}>
      <M.ListItemIcon className={classes.icon}>
        <M.Icon>add_circle_outline</M.Icon>
      </M.ListItemIcon>
      <M.ListItemText primary={title} />
    </M.ListItem>
  )
})
