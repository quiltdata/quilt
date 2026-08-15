import cx from 'classnames'
import * as R from 'ramda'
import * as React from 'react'
import { Link } from 'react-router-dom'
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary'
import * as Sentry from '@sentry/react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import { buckets as bucketsRoute } from 'constants/routes'

import ExampleQueries from './ExampleQueries'
import UnifiedBar from './UnifiedBar/UnifiedBar'
import BucketsTile from './Tiles/BucketsTile'
import RecentPackagesTile from './Tiles/RecentPackagesTile'
import TablesTile from './Tiles/TablesTile'

// The front door: one bar over a few "jump back in" tiles, shown at `/` when an
// admin turns on the `front-door` preview feature (otherwise `/` is the volume
// list, same as before).
//
// The prototype this came from (frontdoor/v3-eval) staged it as a marketing
// hero -- gradient ground, masked cobalt dot grid, 40px/300 display type over
// "Find the right data faster". None of that survives the One-Register Rule:
// this is a working page in the same register as every other page, so it sits
// on the ordinary Canvas ground and says what it does.
const useStyles = M.makeStyles((t) => ({
  container: {
    maxWidth: 1040,
    paddingBottom: t.spacing(8),
    paddingTop: t.spacing(8),
  },
  greeting: {
    margin: '0 auto',
    maxWidth: 900,
    paddingBottom: t.spacing(3),
    textAlign: 'center',
  },
  greetingTitle: {
    marginBottom: t.spacing(1),
    '& b': {
      fontWeight: t.typography.fontWeightMedium,
    },
  },
  examples: {
    display: 'flex',
    justifyContent: 'center',
  },
  sectionHead: {
    color: t.palette.text.secondary,
    fontSize: t.typography.caption.fontSize,
    fontWeight: t.typography.fontWeightMedium,
    letterSpacing: '.06em',
    margin: t.spacing(6, 0, 2),
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  grid: {
    display: 'grid',
    gap: t.spacing(2),
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    [t.breakpoints.down('xs')]: {
      gridTemplateColumns: '1fr',
    },
  },
  tileFallback: {
    height: '100%',
    padding: t.spacing(3),
  },
  // The page-level error state. Border-delineated, no resting shadow (the
  // Overlay-Only Rule); it does not float, so it does not get a shadow.
  pageFallback: {
    paddingBottom: t.spacing(8),
    paddingTop: t.spacing(8),
  },
  pageFallbackCard: {
    padding: t.spacing(3),
  },
  pageFallbackTitle: {
    alignItems: 'center',
    display: 'flex',
    gap: t.spacing(1),
  },
  pageFallbackActions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: t.spacing(1),
    marginTop: t.spacing(3),
  },
  // Placeholders for the suspending reads below. Each one reserves the height
  // its resolved content occupies, so nothing on the page moves when the data
  // lands -- a collapsing fallback would make the page jump as it resolves.
  examplesPlaceholder: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: t.spacing(1),
    justifyContent: 'center',
    marginTop: t.spacing(3),
  },
  examplesPlaceholderChip: {
    borderRadius: 16, // the chip token (DESIGN.md components.chip.rounded)
  },
  tilePlaceholder: {
    border: `1px solid ${t.palette.divider}`,
    borderRadius: t.shape.borderRadius,
    display: 'flex',
    flexDirection: 'column',
    gap: t.spacing(1),
    height: '100%',
    padding: t.spacing(2),
  },
  // Universal reduced-motion escape hatch, as in containers/Home/Buckets: kills
  // Lab.Skeleton's pulse without reaching for its hashed dev class name.
  placeholder: {
    '@media (prefers-reduced-motion: reduce)': {
      '& *': {
        animationDuration: '0.01ms !important',
        animationIterationCount: '1 !important',
      },
    },
  },
}))

const onError = (error: Error) => Sentry.captureException(error)

// If the front door itself fails, say so and offer a way out -- but do NOT
// re-enter the data path that just failed. The previous version rendered
// <Buckets /> here, which reads the same GraphQL (useIsAdmin, useRelevantBuckets)
// the front door does: when the failure was GraphQL being unreachable -- the
// likeliest cause of a page-level failure -- the fallback threw on its own
// render. react-error-boundary does not catch errors thrown by its own fallback
// (it builds the fallback element inside its own render pass), so that escalated
// to the app-level boundary and showed the full error page: exactly what this
// boundary exists to prevent.
//
// So the volume list is offered as a *link* rather than mounted inline. That
// keeps the promise -- the thing the front door replaced still works, one click
// away -- without depending on the data that just failed. Mounting it here also
// dragged in its `location.search`-keyed history effect, which combined with
// Landing's `key={location.key}` could leave `/` oscillating and append a `?q=`
// the user never typed.
function PageFallback({ error, resetErrorBoundary }: FallbackProps) {
  const classes = useStyles()
  return (
    <M.Container maxWidth="sm" className={classes.pageFallback}>
      <M.Paper className={classes.pageFallbackCard} elevation={0} variant="outlined">
        {/* Icon *and* text: state is never signalled by color alone. */}
        <M.Typography
          className={classes.pageFallbackTitle}
          variant="h6"
          component="h1"
          gutterBottom
        >
          <M.Icon color="error">error_outline</M.Icon>
          This page could not be loaded
        </M.Typography>
        <M.Typography color="textSecondary">
          {error.message || 'The front door could not be rendered.'}
        </M.Typography>
        <div className={classes.pageFallbackActions}>
          {/* Retry in place. Without `resetErrorBoundary` the only way back was a
              full reload, so one failure read as "the feature is off" for the
              rest of the session. */}
          <M.Button
            color="primary"
            onClick={resetErrorBoundary}
            startIcon={<M.Icon>refresh</M.Icon>}
            variant="contained"
          >
            Try again
          </M.Button>
          <M.Button component={Link} to={bucketsRoute.url()} variant="outlined">
            Browse volumes
          </M.Button>
        </div>
      </M.Paper>
    </M.Container>
  )
}

function TileFallback({ error }: FallbackProps) {
  const classes = useStyles()
  return (
    <M.Paper className={classes.tileFallback} elevation={0} variant="outlined">
      <M.Typography variant="h6" component="h2" gutterBottom>
        Tile unavailable
      </M.Typography>
      <M.Typography color="textSecondary">
        {error.message || 'This tile could not be rendered.'}
      </M.Typography>
    </M.Paper>
  )
}

// Holds the tile's silhouette while its data is in flight, so the grid doesn't
// change height when the tiles resolve.
function TilePlaceholder() {
  const classes = useStyles()
  return (
    <div aria-hidden className={cx(classes.tilePlaceholder, classes.placeholder)}>
      <Lab.Skeleton variant="text" width="40%" height={20} />
      {R.range(0, 4).map((i) => (
        <Lab.Skeleton key={i} variant="text" width="85%" height={16} />
      ))}
    </div>
  )
}

// Every tile reads bucket data, so each needs *both* boundaries: an error
// boundary (a failing tile must not take the page) and a suspense boundary. An
// ErrorBoundary does not catch suspension -- without the Suspense here a cold
// read unwinds past this to a boundary above FrontDoorContent, remounting the
// page and dropping the query held there.
export function TileBoundary({ children }: React.PropsWithChildren<{}>) {
  return (
    <ErrorBoundary FallbackComponent={TileFallback} onError={onError}>
      <React.Suspense fallback={<TilePlaceholder />}>{children}</React.Suspense>
    </ErrorBoundary>
  )
}

// Same story as the tiles: useExampleQueries reads bucket data, so a cold read
// here would unwind past FrontDoorContent and take the query with it.
function ExamplesPlaceholder() {
  const classes = useStyles()
  return (
    <div aria-hidden className={cx(classes.examplesPlaceholder, classes.placeholder)}>
      {[220, 180, 260, 150, 200].map((width, i) => (
        <Lab.Skeleton
          className={classes.examplesPlaceholderChip}
          height={32}
          key={i}
          variant="rect"
          width={width}
        />
      ))}
    </div>
  )
}

export function PageBoundary({ children }: React.PropsWithChildren<{}>) {
  return (
    <ErrorBoundary FallbackComponent={PageFallback} onError={onError}>
      {children}
    </ErrorBoundary>
  )
}

export function FrontDoorContent() {
  const classes = useStyles()
  const [query, setQuery] = React.useState('')
  const active = query.trim().length > 0

  return (
    <M.Container maxWidth="lg" className={classes.container}>
      {/* Once there's a query the bar owns the page: everything around it
          collapses so the suggestions/plan have room. */}
      <M.Collapse in={!active}>
        <div className={classes.greeting}>
          {/* The page's h1, sized as an h5: a working page heading, not a
              marketing hero. */}
          <M.Typography
            variant="h5"
            component="h1"
            color="textPrimary"
            className={classes.greetingTitle}
          >
            What are you looking for?
          </M.Typography>
          <M.Typography color="textSecondary">
            Search packages, objects, and tables across your buckets — or ask Qurator in
            plain language.
          </M.Typography>
        </div>
      </M.Collapse>
      <UnifiedBar value={query} onChange={setQuery} />
      <M.Collapse in={!active}>
        <div className={classes.examples}>
          <React.Suspense fallback={<ExamplesPlaceholder />}>
            <ExampleQueries onSelect={setQuery} />
          </React.Suspense>
        </div>
        <M.Typography component="h2" className={classes.sectionHead}>
          Jump back in
        </M.Typography>
        <div className={classes.grid}>
          <TileBoundary>
            <RecentPackagesTile />
          </TileBoundary>
          <TileBoundary>
            <BucketsTile />
          </TileBoundary>
          <TileBoundary>
            <TablesTile />
          </TileBoundary>
        </div>
      </M.Collapse>
    </M.Container>
  )
}

export default function FrontDoor() {
  return (
    <PageBoundary>
      <FrontDoorContent />
    </PageBoundary>
  )
}
