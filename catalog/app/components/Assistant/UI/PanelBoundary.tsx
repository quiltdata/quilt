import * as React from 'react'
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'
import * as Sentry from '@sentry/react'

// The panel mounts above `Errors.ErrorBoundary` and the root Suspense (the
// `nest` order in app.tsx), so a chat read that throws or suspends would
// replace the whole catalog. Suspense too: a boundary does not catch suspension.
const useStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
    gap: t.spacing(2),
    padding: t.spacing(2),
  },
  fallbackTitle: {
    alignItems: 'center',
    display: 'flex',
    gap: t.spacing(1),
  },
  message: {
    // Prose runs <=75ch.
    maxWidth: '75ch',
  },
  skeletons: {
    display: 'flex',
    flexDirection: 'column',
    gap: t.spacing(2),
  },
  srOnly: {
    clip: 'rect(0 0 0 0)',
    clipPath: 'inset(50%)',
    height: 1,
    overflow: 'hidden',
    position: 'absolute',
    whiteSpace: 'nowrap',
    width: 1,
  },
}))

// `aria-busy` with a live region, not just an `aria-hidden` skeleton: the panel
// is the payload of an explicit "Ask Qurator" activation, so an empty expanded
// region would leave a screen-reader user with nothing to wait on.
function Placeholder() {
  const classes = useStyles()
  return (
    <div aria-busy aria-live="polite" className={classes.root}>
      <M.Typography className={classes.srOnly} variant="body2">
        Loading Qurator
      </M.Typography>
      <div aria-hidden className={classes.skeletons}>
        <Lab.Skeleton height={40} variant="rect" />
        <Lab.Skeleton height={24} width="60%" />
        <Lab.Skeleton height={24} width="80%" />
      </div>
    </div>
  )
}

const errorMessage = (e: unknown) => {
  if (e instanceof Error) return e.message || e.name
  return typeof e === 'string' ? e : ''
}

interface FallbackComponentProps extends FallbackProps {
  onRetry?: () => void
}

function Fallback({ error, resetErrorBoundary, onRetry }: FallbackComponentProps) {
  const classes = useStyles()
  const detail = errorMessage(error)
  const retry = React.useCallback(() => {
    onRetry?.()
    resetErrorBoundary()
  }, [onRetry, resetErrorBoundary])
  return (
    <div className={classes.root}>
      <M.Typography className={classes.fallbackTitle} variant="subtitle1" component="h2">
        <M.Icon color="error" fontSize="small">
          error_outline
        </M.Icon>
        Qurator could not load
      </M.Typography>
      {!!detail && (
        <M.Typography className={classes.message} color="textSecondary" variant="body2">
          {detail}
        </M.Typography>
      )}
      <div>
        <M.Button
          onClick={retry}
          size="small"
          startIcon={<M.Icon>refresh</M.Icon>}
          variant="outlined"
        >
          Retry
        </M.Button>
      </div>
    </div>
  )
}

const onError = (error: Error) => Sentry.captureException(error)

interface PanelBoundaryProps {
  children?: React.ReactNode
  /**
   * Clears the state a throw was rendered from. The conversation lives in
   * `Assistant.Provider`, above this boundary, so resetting alone would remount
   * Chat onto the same failing events -- a Retry that cannot succeed.
   */
  onRetry?: () => void
}

export default function PanelBoundary({ children, onRetry }: PanelBoundaryProps) {
  const FallbackComponent = React.useCallback(
    (props: FallbackProps) => <Fallback {...props} onRetry={onRetry} />,
    [onRetry],
  )
  return (
    <ErrorBoundary FallbackComponent={FallbackComponent} onError={onError}>
      <React.Suspense fallback={<Placeholder />}>{children}</React.Suspense>
    </ErrorBoundary>
  )
}
