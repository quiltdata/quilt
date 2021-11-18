import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

const useStyles = M.makeStyles((t) => ({
  root: {
    position: 'relative',
    height: '240px',
  },
  video: {
    display: 'block',
    height: '240px',
    margin: 'auto',
    maxWidth: '100%',
  },
  hidden: {
    position: 'absolute',
    opacity: 0,
  },
  spinner: {
    margin: t.spacing(9, 'auto', 0),
    display: 'block',
  },
}))

interface VideoProps extends React.HTMLAttributes<HTMLVideoElement> {
  className?: string
  src: string
}

function Video({ src, className, ...props }: VideoProps) {
  const classes = useStyles()
  const ref = React.useRef<HTMLVideoElement | null>(null)
  const [loading, setLoading] = React.useState(true)
  const handleLoad = React.useCallback(
    () => setTimeout(() => setLoading(false), 500),
    [setLoading],
  )
  React.useEffect(() => {
    const videoEl = ref.current
    videoEl?.addEventListener('canplay', handleLoad)
    return () => videoEl?.removeEventListener('canplay', handleLoad)
  }, [handleLoad, ref])
  return (
    <div className={cx(className, classes.root)}>
      <video
        ref={ref}
        controls
        muted
        className={cx(classes.video, { [classes.hidden]: loading })}
        {...props}
      >
        <source src={src} />
        <p>Sorry, your browser doesn't support embedded videos</p>
      </video>
      {loading && <M.CircularProgress className={classes.spinner} size={96} />}
    </div>
  )
}

export default (img: VideoProps, props: VideoProps) => <Video {...img} {...props} />
