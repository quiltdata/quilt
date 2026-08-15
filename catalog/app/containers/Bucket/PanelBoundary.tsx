import * as React from 'react'
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary'
import * as M from '@material-ui/core'
import * as Sentry from '@sentry/react'

// Panel-scoped containment for the bucket pages.
//
// Almost nothing under `Bucket/**` had an error boundary of its own, so a
// routine per-panel failure -- an object head that fails, a preview that can't
// load, a `BUCKET_QUERY` that doesn't answer -- unwound all the way to
// `Errors.ErrorBoundary` in app.tsx and replaced the entire catalog with the
// app-level error screen. `mkLazy` (how Bucket.tsx loads every route) supplies
// only Suspense, so it does not stop this.
//
// The granularity is deliberate: one boundary per independently-loaded panel,
// so a failing Overview summary costs the summary and nothing else. This
// follows the two existing in-repo patterns -- `Bucket/Toolbar/ErrorBoundary`
// (per-toolbar, retry via `resetErrorBoundary`) and the front door's
// `TileBoundary` (per-tile, error + suspense together).
const useStyles = M.makeStyles((t) => ({
  // Border-delineated, no resting shadow (Elevation: the Overlay-Only Rule).
  root: {
    padding: t.spacing(2),
  },
  // Icon *and* text: state is never signalled by colour alone.
  title: {
    alignItems: 'center',
    display: 'flex',
    gap: t.spacing(1),
  },
  message: {
    marginTop: t.spacing(0.5),
    // Prose runs <=75ch.
    maxWidth: '75ch',
  },
  actions: {
    marginTop: t.spacing(2),
  },
}))

const errorMessage = (e: unknown) => {
  if (e instanceof Error) return e.message || e.name
  return typeof e === 'string' ? e : ''
}

interface PanelFallbackProps extends FallbackProps {
  title: string
  onRetry?: () => void
}

function PanelFallback({
  error,
  resetErrorBoundary,
  title,
  onRetry,
}: PanelFallbackProps) {
  const classes = useStyles()
  const detail = errorMessage(error)
  // `resetErrorBoundary` is the right retry only when the failed state lives
  // *below* this boundary, where clearing the error remounts the reader and it
  // reads again (true for `useQueryS`: urql does not cache failures, so a fresh
  // mount refetches). When the failed result is held above the boundary -- e.g.
  // File.jsx keeps it in `useData` state -- a reset re-renders the same failure,
  // so those call sites pass an `onRetry` that actually refetches. A retry that
  // cannot succeed would be a dead affordance, which PRODUCT.md calls a defect.
  const retry = onRetry || resetErrorBoundary
  return (
    <M.Paper className={classes.root} elevation={0} variant="outlined">
      <M.Typography className={classes.title} variant="h6" component="h2">
        <M.Icon color="error" fontSize="small">
          error_outline
        </M.Icon>
        {title}
      </M.Typography>
      {!!detail && (
        <M.Typography className={classes.message} color="textSecondary" variant="body2">
          {detail}
        </M.Typography>
      )}
      <div className={classes.actions}>
        <M.Button
          onClick={retry}
          size="small"
          startIcon={<M.Icon>refresh</M.Icon>}
          variant="outlined"
        >
          Retry
        </M.Button>
      </div>
    </M.Paper>
  )
}

const onError = (error: Error) => Sentry.captureException(error)

// Calls `render()` during *its own* render pass.
//
// This exists because a boundary only catches what throws below it, and JSX
// children are evaluated as arguments in the parent's render: in
// `<PanelBoundary>{data.case({ Err: () => { throw e } })}</PanelBoundary>` the
// `.case(...)` call runs while the *parent* renders, before the boundary
// element is even constructed, so the throw sails straight past it. Passing a
// thunk instead defers the call to here -- inside the boundary's subtree -- so
// it is caught. Component children (`<Header />`) already throw in their own
// render and need none of this.
function Invoke({ render }: { render: () => React.ReactNode }) {
  return <>{render()}</>
}

interface PanelBoundaryProps {
  /** Component children. Use `render` instead for inline expressions that throw. */
  children?: React.ReactNode
  /**
   * A thunk rendered inside the boundary. Use this when the throwing code is an
   * inline expression rather than a component, so the throw happens below the
   * boundary rather than in the caller's render pass.
   */
  render?: () => React.ReactNode
  /** Names what failed, in the user's terms. */
  title: string
  /**
   * Holds the panel's silhouette while its data is in flight. Pass this
   * whenever anything below suspends: an error boundary does *not* catch
   * suspension, so without it a cold read unwinds to a Suspense boundary above
   * (mkLazy's, or app.tsx's) and replaces the whole page instead of this panel.
   */
  suspenseFallback?: React.ReactNode
  /** Bumping any of these clears the error state. Pair with `onRetry`. */
  resetKeys?: unknown[]
  /** Refetches the failed data. Omit when a plain reset is enough. */
  onRetry?: () => void
}

export default function PanelBoundary({
  children,
  render,
  title,
  suspenseFallback,
  resetKeys,
  onRetry,
}: PanelBoundaryProps) {
  const Fallback = React.useCallback(
    (props: FallbackProps) => (
      <PanelFallback {...props} title={title} onRetry={onRetry} />
    ),
    [title, onRetry],
  )
  const content = render ? <Invoke render={render} /> : children
  return (
    <ErrorBoundary FallbackComponent={Fallback} onError={onError} resetKeys={resetKeys}>
      {suspenseFallback === undefined ? (
        content
      ) : (
        <React.Suspense fallback={suspenseFallback}>{content}</React.Suspense>
      )}
    </ErrorBoundary>
  )
}
