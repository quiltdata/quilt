import cx from 'classnames'
import * as React from 'react'
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary'
import * as M from '@material-ui/core'
import * as Sentry from '@sentry/react'

// Error *and* suspense containment for one independently-loaded panel, so a
// routine read failure costs that panel and not the catalog. Everything here
// mounts above `Errors.ErrorBoundary` and the root Suspense (the `nest` order in
// app.tsx), which replace the whole page; `mkLazy` supplies only Suspense, so it
// does not stop this either.
const useStyles = M.makeStyles((t) => ({
  // Border-delineated, no resting shadow (DESIGN.md, the Overlay-Only Rule).
  paper: {
    padding: t.spacing(2),
  },
  plain: {
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
    gap: t.spacing(2),
    padding: t.spacing(2),
  },
  // Icon *and* text: DESIGN.md never signals state by colour alone.
  title: {
    alignItems: 'center',
    display: 'flex',
    gap: t.spacing(1),
  },
  message: {
    // Prose runs <=75ch.
    maxWidth: '75ch',
  },
  // `plain` spaces its rows with `gap`; the Paper has none of its own.
  messageSpaced: {
    marginTop: t.spacing(0.5),
  },
  actionsSpaced: {
    marginTop: t.spacing(2),
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

/**
 * `paper` is a card in a column of panels; `plain` fills a container that is
 * the panel.
 */
type Variant = 'paper' | 'plain'

interface ShellProps extends React.PropsWithChildren<{}> {
  variant: Variant
  'aria-busy'?: boolean
  'aria-live'?: 'polite'
}

function Shell({ variant, children, ...aria }: ShellProps) {
  const classes = useStyles()
  return variant === 'paper' ? (
    <M.Paper className={classes.paper} elevation={0} variant="outlined" {...aria}>
      {children}
    </M.Paper>
  ) : (
    <div className={classes.plain} {...aria}>
      {children}
    </div>
  )
}

// A live region, not just an `aria-hidden` skeleton: where the panel is the
// payload of an explicit activation, an empty expanded region leaves a
// screen-reader user with nothing to wait on.
function Busy({
  label,
  variant,
  children,
}: React.PropsWithChildren<{ label: string; variant: Variant }>) {
  const classes = useStyles()
  return (
    <Shell variant={variant} aria-busy aria-live="polite">
      <M.Typography className={classes.srOnly} variant="body2">
        {label}
      </M.Typography>
      {children}
    </Shell>
  )
}

const errorMessage = (e: unknown) => {
  if (e instanceof Error) return e.message || e.name
  return typeof e === 'string' ? e : ''
}

interface PanelFallbackProps extends FallbackProps {
  title: string
  retryLabel: string
  variant: Variant
  onRetry?: () => void
}

function PanelFallback({
  error,
  resetErrorBoundary,
  title,
  retryLabel,
  variant,
  onRetry,
}: PanelFallbackProps) {
  const classes = useStyles()
  const detail = errorMessage(error)
  const paper = variant === 'paper'
  // Resetting only remounts the reader, so it retries nothing where the failed
  // state outlives the boundary (File's `useData` result, the conversation);
  // `onRetry` is what makes the next attempt different. PRODUCT.md calls a
  // retry that cannot succeed a defect.
  const retry = React.useCallback(() => {
    onRetry?.()
    resetErrorBoundary()
  }, [onRetry, resetErrorBoundary])
  return (
    <Shell variant={variant}>
      <M.Typography
        className={classes.title}
        variant={paper ? 'h6' : 'subtitle1'}
        component="h2"
      >
        <M.Icon color="error" fontSize="small">
          error_outline
        </M.Icon>
        {title}
      </M.Typography>
      {!!detail && (
        <M.Typography
          className={cx(classes.message, paper && classes.messageSpaced)}
          color="textSecondary"
          variant="body2"
        >
          {detail}
        </M.Typography>
      )}
      <div className={cx(paper && classes.actionsSpaced)}>
        <M.Button
          onClick={retry}
          size="small"
          startIcon={<M.Icon>refresh</M.Icon>}
          variant="outlined"
        >
          {retryLabel}
        </M.Button>
      </div>
    </Shell>
  )
}

const onError = (error: Error) => Sentry.captureException(error)

// Calls `render()` during *its own* render pass, so the throw lands below the
// boundary. JSX children are evaluated as arguments in the parent's render, so
// `<PanelBoundary>{data.case({ Err: () => { throw e } })}</PanelBoundary>` throws
// before the boundary element exists. Component children need none of this.
function Invoke({ render }: { render: () => React.ReactNode }) {
  return <>{render()}</>
}

interface PanelBoundaryProps {
  /** Component children. Use `render` instead for inline expressions that throw. */
  children?: React.ReactNode
  /**
   * A thunk rendered inside the boundary, for a throwing expression that is not
   * a component.
   */
  render?: () => React.ReactNode
  /** Names what failed, in the user's terms. */
  title: string
  /** Names what the retry does where it is more than a reload. */
  retryLabel?: string
  variant?: Variant
  /**
   * Holds the panel's silhouette while its data is in flight. Pass this whenever
   * anything below suspends: an error boundary does *not* catch suspension, so
   * without it a cold read unwinds to a Suspense boundary above and replaces the
   * whole page.
   */
  suspenseFallback?: React.ReactNode
  /** Announced while `suspenseFallback` stands in. Omit for a decorative one. */
  busyLabel?: string
  /** Bumping any of these clears the error state. */
  resetKeys?: unknown[]
  /** Makes the next attempt different where the failure outlives the boundary. */
  onRetry?: () => void
}

export default function PanelBoundary({
  children,
  render,
  title,
  retryLabel = 'Retry',
  variant = 'paper',
  suspenseFallback,
  busyLabel,
  resetKeys,
  onRetry,
}: PanelBoundaryProps) {
  const Fallback = React.useCallback(
    (props: FallbackProps) => (
      <PanelFallback
        {...props}
        title={title}
        retryLabel={retryLabel}
        variant={variant}
        onRetry={onRetry}
      />
    ),
    [title, retryLabel, variant, onRetry],
  )
  const content = render ? <Invoke render={render} /> : children
  return (
    <ErrorBoundary FallbackComponent={Fallback} onError={onError} resetKeys={resetKeys}>
      {suspenseFallback === undefined ? (
        content
      ) : (
        <React.Suspense
          fallback={
            busyLabel === undefined ? (
              suspenseFallback
            ) : (
              <Busy label={busyLabel} variant={variant}>
                {suspenseFallback}
              </Busy>
            )
          }
        >
          {content}
        </React.Suspense>
      )}
    </ErrorBoundary>
  )
}
