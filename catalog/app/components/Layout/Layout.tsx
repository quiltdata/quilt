import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import { Sidebar } from 'containers/Sidebar'
import { PANEL_WIDTH, usePanelReflow } from 'components/Assistant/UI/PanelReflow'

import BareHeader from './BareHeader'
import * as Column from './Column'
import * as Container from './Container'
import { ContentBar } from './ContentBar'
import { SearchInputProvider } from './SearchInput'

const useRootStyles = M.makeStyles({
  root: {
    overflowX: 'hidden',
    position: 'relative',
  },
})

interface RootProps {
  dark?: boolean
  children: React.ReactNode
}

export function Root({ dark = false, ...props }: RootProps) {
  const classes = useRootStyles()
  return (
    <M.Box
      className={classes.root}
      bgcolor={dark ? 'primary.main' : 'background.default'}
      display="flex"
      flexDirection="column"
      minHeight="100vh"
      {...props}
    />
  )
}

// Under 960px there is no room for a 256px column beside the content, so the
// rail becomes an overlay reached from a menu button in the header band. In MUI
// v4 `down('sm')` is max-width 959.95px -- i.e. everything below the `md`
// breakpoint, not just the `sm` band. The viewport, not the column: the rail
// sits outside the column it would be measuring.
const useCompactShell = () => {
  const t = M.useTheme()
  return M.useMediaQuery(t.breakpoints.down('sm'))
}

// Motion is decoration on chrome: transitions attach only inside this query,
// so reduced-motion users get the instant swap (containers/Sidebar).
const MOTION = '@media (prefers-reduced-motion: no-preference)'

const useShellStyles = M.makeStyles((t) => ({
  shell: {
    display: 'flex',
    // A mobile URL bar counts inside vh but not inside the visible viewport, so
    // vh alone puts the shell's foot under browser chrome.
    fallbacks: { height: '100vh' },
    height: '100dvh',
    overflowX: 'hidden',
    position: 'relative',
    [MOTION]: {
      transition: t.transitions.create('padding-right', {
        duration: t.transitions.duration.leavingScreen,
        easing: t.transitions.easing.sharp,
      }),
    },
  },
  // Qurator's docked paper is `position: fixed` and reserves no space, so the
  // gutter that lets it push content aside has to be held here. Durations
  // match the drawer's own Slide, or the content lags the paper.
  shellReflowed: {
    paddingRight: PANEL_WIDTH,
    [MOTION]: {
      transition: t.transitions.create('padding-right', {
        duration: t.transitions.duration.enteringScreen,
        easing: t.transitions.easing.easeOut,
      }),
    },
  },
  // `.main` is the scroll container; the sticky ContentBar pins to its top.
  // The column is a size container so page styles can key on its width
  // (components/Layout/Column) rather than the viewport's.
  main: {
    containerName: Column.NAME,
    containerType: 'inline-size',
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
    minWidth: 0,
    overflowY: 'auto',
  },
  // Single source of horizontal inset for everything in `.main` (search bar and
  // page content alike). Skipped for full-bleed pages via the `flush` prop.
  // The inset now lives on the inner content column, not `main`, so the
  // sticky ContentBar above it can run full-bleed.
  // `viewport-fit=cover` (index.html) lets the page reach under the notch and
  // the rounded corners, so the one horizontal inset in the column owes the
  // safe area as well as its own gutter.
  padded: {
    paddingLeft: `max(${t.spacing(3)}px, env(safe-area-inset-left))`,
    paddingRight: `max(${t.spacing(3)}px, env(safe-area-inset-right))`,
  },
  // The page content column: carries the horizontal inset (so the sticky
  // ContentBar above it can run full-bleed) and grows to push the footer down.
  content: {
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
  },
}))

export interface LayoutProps {
  bare?: boolean
  dark?: boolean
  flush?: boolean
  children?: React.ReactNode
  pre?: React.ReactNode
}

export function Layout({
  bare = false,
  dark = false,
  flush = false,
  children,
  pre,
}: LayoutProps) {
  const classes = useShellStyles()
  const compact = useCompactShell()
  const reflow = usePanelReflow()
  const [mainEl, setMainEl] = React.useState<HTMLElement | null>(null)
  const [navOpen, setNavOpen] = React.useState(false)
  const closeNav = React.useCallback(() => setNavOpen(false), [])
  const openNav = React.useCallback(() => setNavOpen(true), [])

  // `bare` pages (e.g. sign-in) keep the minimal standalone header, no sidebar.
  if (bare) {
    return (
      <Root dark={dark}>
        <Container.FullWidthProvider>
          <BareHeader />
          {!!pre && pre}
          {!!children && <M.Box p={4}>{children}</M.Box>}
          <M.Box flexGrow={1} />
        </Container.FullWidthProvider>
      </Root>
    )
  }

  // The sidebar rails run full height on the left; the main column has a search
  // bar (ContentBar) on top and the scrolling page content beneath. The provider
  // spans both so page content can reach the bar's query field, which is the
  // only one on the page.
  return (
    <SearchInputProvider>
      <M.Box
        className={cx(classes.shell, reflow && classes.shellReflowed)}
        bgcolor={dark ? 'primary.main' : 'background.default'}
      >
        <Sidebar compact={compact} open={navOpen} onClose={closeNav} />
        <M.Box component="main" className={classes.main} {...{ ref: setMainEl }}>
          <Column.Provider target={mainEl}>
            {/* The menu button exists only in the compact shell: on a wide
                viewport the rail is always on screen, so it would toggle nothing. */}
            <ContentBar onMenu={compact ? openNav : undefined} />
            <div className={cx(classes.content, !flush && classes.padded)}>
              <Container.FullWidthProvider>
                {!!pre && pre}
                {!!children && <M.Box py={4}>{children}</M.Box>}
                <M.Box flexGrow={1} />
              </Container.FullWidthProvider>
            </div>
          </Column.Provider>
        </M.Box>
      </M.Box>
    </SearchInputProvider>
  )
}

export default Layout
