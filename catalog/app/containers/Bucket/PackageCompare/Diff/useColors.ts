import * as React from 'react'
import * as M from '@material-ui/core'

const useStyles = M.makeStyles((t) => ({
  added: {
    backgroundColor: M.fade(t.palette.success.light, 0.3),
  },
  removed: {
    backgroundColor: M.fade(t.palette.error.light, 0.3),
  },
  modified: {
    backgroundColor: M.fade(t.palette.warning.dark, 0.15),
  },
  inline: {
    borderRadius: '2px',
    padding: t.spacing(0, 0.25),
  },
}))

export default function useColors() {
  const classes = useStyles()
  return React.useMemo(() => ({ ...classes, '': '' }), [classes])
}
