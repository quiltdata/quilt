import * as React from 'react'
import { useRouteMatch } from 'react-router-dom'
import * as M from '@material-ui/core'

import Footer from 'components/Footer'
import * as NavBar from 'containers/NavBar'
import { Sidebar } from 'containers/Sidebar'
import * as NamedRoutes from 'utils/NamedRoutes'

import * as Container from './Container'
import { TopBar } from './TopBar'

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

const useShellStyles = M.makeStyles({
  shell: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    overflowX: 'hidden',
    position: 'relative',
  },
  body: {
    display: 'flex',
    flexGrow: 1,
    minHeight: 0,
  },
  main: {
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
    minWidth: 0,
    overflowY: 'auto',
  },
})

export interface LayoutProps {
  bare?: boolean
  dark?: boolean
  children?: React.ReactNode
  pre?: React.ReactNode
}

export function Layout({ bare = false, dark = false, children, pre }: LayoutProps) {
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

  // Full-width header on top; the sidebar + content row sits beneath it.
  return (
    <M.Box
      className={classes.shell}
      bgcolor={dark ? 'primary.main' : 'background.default'}
    >
      <TopBar />
      <div className={classes.body}>
        <Sidebar />
        <M.Box component="main" className={classes.main}>
          <Container.FullWidthProvider>
            {!!pre && pre}
            {!!children && <M.Box p={4}>{children}</M.Box>}
            <M.Box flexGrow={1} />
            {isHomepage?.isExact && <Footer />}
          </Container.FullWidthProvider>
        </M.Box>
      </div>
    </M.Box>
  )
}

export default Layout
