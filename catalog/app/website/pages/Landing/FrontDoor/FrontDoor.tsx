import * as React from 'react'
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary'
import * as Sentry from '@sentry/react'
import * as M from '@material-ui/core'
import { ThemeProvider } from '@material-ui/core/styles'

import * as style from 'constants/style'

import Buckets from '../Buckets'

import ExampleQueries from './ExampleQueries'
import UnifiedBar from './UnifiedBar/UnifiedBar'
import BucketsTile from './Tiles/BucketsTile'
import RecentPackagesTile from './Tiles/RecentPackagesTile'
import TablesTile from './Tiles/TablesTile'

const useStyles = M.makeStyles((t) => ({
  root: {
    position: 'relative',
    overflow: 'hidden',
    // Hero background follows the palette: indigo glow over dark base, or a
    // soft blue wash over the light base in light mode.
    background:
      t.palette.type === 'dark'
        ? 'radial-gradient(900px 500px at 50% -8%, #2b2566 0%, rgba(43,37,102,0) 60%), linear-gradient(180deg, #19163b 0%, #15122f 100%)'
        : 'radial-gradient(900px 500px at 50% -8%, rgba(84,113,241,.14) 0%, rgba(84,113,241,0) 60%), linear-gradient(180deg, #f6f7fb 0%, #eef1f9 100%)',
  },
  // Masked dot grid that fades out toward the edges, matching the prototype.
  dotGrid: {
    backgroundImage:
      t.palette.type === 'dark'
        ? 'radial-gradient(rgba(106,147,255,.18) 1.4px, transparent 1.5px)'
        : 'radial-gradient(rgba(84,113,241,.22) 1.4px, transparent 1.5px)',
    backgroundSize: '26px 26px',
    bottom: 0,
    left: 0,
    maskImage: 'radial-gradient(720px 520px at 50% 22%, #000 0%, transparent 72%)',
    pointerEvents: 'none',
    position: 'absolute',
    right: 0,
    top: 0,
    WebkitMaskImage: 'radial-gradient(720px 520px at 50% 22%, #000 0%, transparent 72%)',
    zIndex: 0,
  },
  themeToggle: {
    position: 'absolute',
    right: t.spacing(2),
    top: t.spacing(2),
    zIndex: 2,
    color: t.palette.text.secondary,
  },
  container: {
    maxWidth: 1040,
    paddingBottom: t.spacing(8),
    paddingTop: t.spacing(7),
    position: 'relative',
    zIndex: 1,
  },
  greeting: {
    margin: '0 auto',
    maxWidth: 900,
    paddingBottom: t.spacing(3),
    textAlign: 'center',
  },
  greetingTitle: {
    fontSize: 40,
    fontWeight: 300,
    letterSpacing: '-0.5px',
    marginBottom: t.spacing(1),
    '& b': {
      fontWeight: 500,
    },
  },
  greetingSubtitle: {
    fontSize: 16,
    fontWeight: 300,
  },
  examples: {
    display: 'flex',
    justifyContent: 'center',
  },
  sectionHead: {
    color: t.palette.text.secondary,
    fontSize: 12,
    fontWeight: 500,
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

function PageFallback() {
  return <Buckets />
}

function TileFallback({ error }: FallbackProps) {
  const classes = useStyles()
  return (
    <M.Paper className={classes.tileFallback} elevation={2}>
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

interface FrontDoorContentProps {
  paletteType?: 'light' | 'dark'
  onTogglePalette?: () => void
}

export function FrontDoorContent({
  paletteType = 'dark',
  onTogglePalette,
}: FrontDoorContentProps) {
  const classes = useStyles()
  const [query, setQuery] = React.useState('')
  const active = query.trim().length > 0

  return (
    <div className={classes.root}>
      <div className={classes.dotGrid} />
      {onTogglePalette && (
        <M.Tooltip
          title={paletteType === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          <M.IconButton
            className={classes.themeToggle}
            onClick={onTogglePalette}
            aria-label="Toggle light/dark mode"
          >
            <M.Icon>{paletteType === 'dark' ? 'light_mode' : 'dark_mode'}</M.Icon>
          </M.IconButton>
        </M.Tooltip>
      )}
      <M.Container maxWidth="lg" className={classes.container}>
        <M.Collapse in={!active}>
          <div className={classes.greeting}>
            <M.Typography
              variant="h1"
              color="textPrimary"
              className={classes.greetingTitle}
            >
              Find the <b>right data</b> faster
            </M.Typography>
            <M.Typography color="textSecondary" className={classes.greetingSubtitle}>
              One bar for everything — search the catalog, or just ask. Qurator takes it
              from there.
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
    </div>
  )
}

const PALETTE_STORAGE_KEY = 'QUILT_FRONT_DOOR_PALETTE'

function usePaletteType() {
  const [type, setType] = React.useState<'light' | 'dark'>(() => {
    try {
      const stored = window.localStorage.getItem(PALETTE_STORAGE_KEY)
      return stored === 'light' ? 'light' : 'dark'
    } catch {
      return 'dark'
    }
  })
  const toggle = React.useCallback(() => {
    setType((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark'
      try {
        window.localStorage.setItem(PALETTE_STORAGE_KEY, next)
      } catch {
        // best-effort persistence only
      }
      return next
    })
  }, [])
  return { type, toggle }
}

export default function FrontDoor() {
  const palette = usePaletteType()
  const theme = palette.type === 'light' ? style.websiteLightTheme : style.websiteTheme
  return (
    <PageBoundary>
      <ThemeProvider theme={theme}>
        <FrontDoorContent paletteType={palette.type} onTogglePalette={palette.toggle} />
      </ThemeProvider>
    </PageBoundary>
  )
}
