import * as React from 'react'
import * as M from '@material-ui/core'

const useStyles = M.makeStyles({
  root: {
    border: 'none',
    height: '90vh',
    width: '100%',
  },
})

function IFrame(props: React.HTMLProps<HTMLIFrameElement>) {
  const classes = useStyles()
  return <iframe className={classes.root} title="Preview" {...props} />
}

export default (
  ifr: React.HTMLProps<HTMLIFrameElement>,
  props: React.HTMLProps<HTMLIFrameElement>,
) => <IFrame {...ifr} {...props} />
