import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

const useStyles = M.makeStyles((t) => ({
  root: {
    position: 'relative',
  },
  audio: {
    display: 'block',
    margin: t.spacing(10, 'auto'),
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

interface AudioProps extends React.HTMLAttributes<HTMLAudioElement> {
  className?: string
  src: string
}

function Audio({ src, className, ...props }: AudioProps) {
  const classes = useStyles()
  const [audioEl, setAudioEl] = React.useState<HTMLAudioElement | null>(null)
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
    audioEl?.addEventListener('canplay', handleLoad)
    return () => {
      sourceEl?.removeEventListener('error', handleError)
      audioEl?.removeEventListener('canplay', handleLoad)
    }
  }, [handleError, handleLoad, sourceEl, audioEl])
  return (
    <div className={cx(className, classes.root)}>
      <audio
        ref={setAudioEl}
        controls
        className={cx(classes.audio, { [classes.hidden]: loading || failed })}
        {...props}
      >
        <source src={src} ref={setSourceEl} />
        <p>Sorry, your browser doesn't support embedded audios</p>
      </audio>

      {loading && <M.CircularProgress className={classes.spinner} size={48} />}

      {failed && (
        <M.Typography variant="body1" gutterBottom>
          Something went wrong while loading preview
        </M.Typography>
      )}
    </div>
  )
}

export default (img: AudioProps, props: AudioProps) => <Audio {...img} {...props} />
