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
  const ref = React.useRef<HTMLIFrameElement>(null)

  const handleReady = React.useCallback(
    (event) => {
      if (!props.data || !ref.current || !props.src) return
      if (event.data !== 'quilt-iframe-ready') return

      const win = ref.current.contentWindow
      if (!win) return

      const { hostname } = new URL(props.src)
      win.postMessage(
        {
          data: props.data,
          name: 'quilt-data',
        },
        `https://${hostname}`,
      )
    },
    [props.data, props.src],
  )

  React.useEffect(() => {
    window.addEventListener('message', handleReady)
    return () => window.removeEventListener('message', handleReady)
  }, [handleReady])

  const classes = useStyles()
  return (
    <iframe
      ref={ref}
      className={classes.root}
      title="Preview"
      sandbox="allow-scripts allow-same-origin"
      {...props}
    />
  )
}

export default (
  ifr: React.HTMLProps<HTMLIFrameElement>,
  props: React.HTMLProps<HTMLIFrameElement>,
) => <IFrame {...ifr} {...props} />
