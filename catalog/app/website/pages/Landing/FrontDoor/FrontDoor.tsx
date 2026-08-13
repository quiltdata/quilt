import * as React from 'react'
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary'
import * as Sentry from '@sentry/react'
import * as M from '@material-ui/core'

import Buckets from 'containers/Home/Buckets'

import ExampleQueries from './ExampleQueries'
import UnifiedBar from './UnifiedBar/UnifiedBar'
import BucketsTile from './Tiles/BucketsTile'
import RecentPackagesTile from './Tiles/RecentPackagesTile'
import TablesTile from './Tiles/TablesTile'

// The front door: one bar over a few "jump back in" tiles, shown at `/` when
// `frontDoorV2` is on (otherwise `/` is the volume list, same as before).
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
    paddingTop: t.spacing(7),
  },
  greeting: {
    margin: '0 auto',
    maxWidth: 900,
    paddingBottom: t.spacing(3),
    textAlign: 'center',
  },
  greetingTitle: {
    ...t.typography.h5,
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
    fontSize: 12,
    fontWeight: t.typography.fontWeightMedium,
    letterSpacing: '.06em',
    margin: t.spacing(6, 0, 2),
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  grid: {
    display: 'grid',
    gap: t.spacing(1.75),
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    [t.breakpoints.down('xs')]: {
      gridTemplateColumns: '1fr',
    },
  },
  tileFallback: {
    height: '100%',
    padding: t.spacing(3),
  },
}))

const onError = (error: Error) => Sentry.captureException(error)

// If the front door itself fails, fall through to the plain volume list rather
// than to an error page -- the thing it replaced still works.
function PageFallback() {
  return <Buckets />
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

export function TileBoundary({ children }: React.PropsWithChildren<{}>) {
  return <ErrorBoundary {...{ FallbackComponent: TileFallback, onError, children }} />
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
          <M.Typography
            variant="h1"
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
          <ExampleQueries onSelect={setQuery} />
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
