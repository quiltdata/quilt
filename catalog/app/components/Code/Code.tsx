import * as React from 'react'
import * as M from '@material-ui/core'

const useCodeStyles = M.makeStyles((t) => ({
  root: {
    background: t.palette.grey[300],
    borderRadius: '2px',
    color: t.palette.text.primary,
    fontFamily: (t.typography as $TSFixMe).monospace.fontFamily,
    padding: '0 3px',
    whiteSpace: 'pre-wrap',
  },
}))

export default function Code({ children }: React.PropsWithChildren<{}>) {
  const classes = useCodeStyles()

  return <code className={classes.root}>{children}</code>
}
