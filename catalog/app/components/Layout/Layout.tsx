import cx from 'classnames'
import * as React from 'react'
import { useRouteMatch } from 'react-router-dom'
import * as M from '@material-ui/core'

import Footer from 'components/Footer'
import * as NavBar from 'containers/NavBar'
import { Sidebar } from 'containers/Sidebar'
import * as NamedRoutes from 'utils/NamedRoutes'

import * as Container from './Container'
import { ContentBar } from './ContentBar'

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

const useShellStyles = M.makeStyles((t) => ({
  shell: {
    display: 'flex',
    height: '100vh',
    overflowX: 'hidden',
    position: 'relative',
  },
  // `.main` is the scroll container; the sticky ContentBar pins to its top.
  main: {
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
    minWidth: 0,
    overflowY: 'auto',
  },
  // Single source of horizontal inset for everything in `.main` (search bar and
  // page content alike). Skipped for full-bleed pages via the `flush` prop.
  padded: {
    paddingLeft: t.spacing(3),
    paddingRight: t.spacing(3),
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
  const { paths } = NamedRoutes.use()
  const isHomepage = useRouteMatch(paths.home)
  const classes = useShellStyles()

  // `bare` pages (e.g. sign-in) keep the minimal standalone header, no sidebar.
  if (bare) {
    return (
      <Root dark={dark}>
        <Container.FullWidthProvider>
          <NavBar.Container />
          {!!pre && pre}
          {!!children && <M.Box p={4}>{children}</M.Box>}
          <M.Box flexGrow={1} />
        </Container.FullWidthProvider>
      </Root>
    )
  }

  // The sidebar rails run full height on the left; the main column has a search
  // bar (ContentBar) on top and the scrolling page content beneath.
  return (
    <M.Box
      className={classes.shell}
      bgcolor={dark ? 'primary.main' : 'background.default'}
    >
      <Sidebar />
      <M.Box component="main" className={cx(classes.main, !flush && classes.padded)}>
        <ContentBar />
        <Container.FullWidthProvider>
          {!!pre && pre}
          {!!children && <M.Box py={4}>{children}</M.Box>}
          <M.Box flexGrow={1} />
          {isHomepage?.isExact && <Footer />}
        </Container.FullWidthProvider>
      </M.Box>
    </M.Box>
  )
}

export default Layout
