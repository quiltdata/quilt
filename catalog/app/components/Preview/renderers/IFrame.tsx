import * as React from 'react'
import * as M from '@material-ui/core'

const useStyles = M.makeStyles({
  root: {
    border: 'none',
    height: '90vh',
    width: '100%',
  },
})

type IFrameProps = React.HTMLProps<HTMLIFrameElement>

function IFrame(props: IFrameProps) {
  const classes = useStyles()
  return (
    <iframe className={classes.root} sandbox="allow-scripts" title="Preview" {...props} />
  )
}

export default (ifr: IFrameProps, props: IFrameProps) => <IFrame {...ifr} {...props} />
