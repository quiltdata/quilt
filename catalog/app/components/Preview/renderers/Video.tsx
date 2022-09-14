import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

const useStyles = M.makeStyles((t) => ({
  root: {
    position: 'relative',
  },
  video: {
    display: 'block',
    height: '240px', // default transcoded video height
    margin: 'auto',
    maxWidth: '100%',
  },
  hidden: {
    opacity: 0,
    position: 'absolute',
  },
  spinner: {
    display: 'block',
    margin: t.spacing(12, 'auto'),
  },
}))

interface VideoProps extends React.HTMLAttributes<HTMLVideoElement> {
  className?: string
  src: string
}

function Video({ src, className, ...props }: VideoProps) {
  const classes = useStyles()
  const [videoEl, setVideoEl] = React.useState<HTMLVideoElement | null>(null)
  const [sourceEl, setSourceEl] = React.useState<HTMLSourceElement | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [failed, setFailed] = React.useState(false)
  const handleLoad = React.useCallback(() => setLoading(false), [setLoading])
  const handleError = React.useCallback(() => {
    setFailed(true)
    setLoading(false)
  }, [setLoading, setFailed])
  React.useEffect(() => {
    sourceEl?.addEventListener('error', handleError)
    videoEl?.addEventListener('canplay', handleLoad)
    return () => {
      sourceEl?.removeEventListener('error', handleError)
      videoEl?.removeEventListener('canplay', handleLoad)
    }
  }, [handleError, handleLoad, sourceEl, videoEl])
  return (
    <div className={cx(className, classes.root)}>
      <video
        ref={setVideoEl}
        controls
        muted
        className={cx(classes.video, { [classes.hidden]: loading || failed })}
        {...props}
      >
        <source src={src} ref={setSourceEl} />
        <p>Sorry, your browser doesn't support embedded videos</p>
      </video>

      {loading && <M.CircularProgress className={classes.spinner} size={48} />}

      {failed && (
        <M.Typography variant="body1" gutterBottom>
          Something went wrong while loading preview
        </M.Typography>
      )}
    </div>
  )
}

export default (img: VideoProps, props: VideoProps) => <Video {...img} {...props} />
