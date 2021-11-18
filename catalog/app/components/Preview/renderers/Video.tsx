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
  const videoRef = React.useRef<HTMLVideoElement | null>(null)
  const sourceRef = React.useRef<HTMLSourceElement | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [failed, setFailed] = React.useState(false)
  const handleLoad = React.useCallback(() => setLoading(false), [setLoading])
  const handleError = React.useCallback(() => {
    setFailed(true)
    setLoading(false)
  }, [setLoading, setFailed])
  React.useEffect(() => {
    const videoEl = videoRef.current
    const sourceEl = sourceRef.current
    videoEl?.addEventListener('canplay', handleLoad)
    sourceEl?.addEventListener('error', handleError)
    return () => {
      videoEl?.removeEventListener('canplay', handleLoad)
      sourceEl?.removeEventListener('error', handleError)
    }
  }, [handleError, handleLoad, videoRef])
  return (
    <div className={cx(className, classes.root)}>
      <video
        ref={videoRef}
        controls
        muted
        className={cx(classes.video, { [classes.hidden]: loading || failed })}
        {...props}
      >
        <source src={src} ref={sourceRef} />
        <p>Sorry, your browser doesn't support embedded videos</p>
      </video>

      {loading && <M.CircularProgress className={classes.spinner} size={96} />}

      {failed && (
        <M.Typography variant="body1" gutterBottom>
          Something went wrong while loading preview
        </M.Typography>
      )}
    </div>
  )
}

export default (img: VideoProps, props: VideoProps) => <Video {...img} {...props} />
