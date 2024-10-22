import * as React from 'react'
import { useRouteMatch } from 'react-router-dom'
import * as M from '@material-ui/core'

import Footer from 'components/Footer'
import * as style from 'constants/style'
import * as Bookmarks from 'containers/Bookmarks'
import * as NavBar from 'containers/NavBar'
import { createBoundary } from 'utils/ErrorBoundary'
import * as NamedRoutes from 'utils/NamedRoutes'

const useComponentErrorStyles = M.makeStyles((t) => ({
  root: {
    background: t.palette.secondary.dark,
    position: 'relative',
  },
  container: {
    color: t.palette.error.light,
    padding: t.spacing(2),
  },
}))

function ComponentError() {
  const classes = useComponentErrorStyles()
  return (
    <div className={classes.root}>
      <M.Container maxWidth="lg" className={classes.container}>
        <M.Typography>Failed to render component</M.Typography>
      </M.Container>
    </div>
  )
}

const ErrorBoundary = createBoundary(() => () => (
  <M.MuiThemeProvider theme={style.navTheme}>
    <ComponentError />
  </M.MuiThemeProvider>
))

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

export interface LayoutProps {
  bare?: boolean
  dark?: boolean
  children?: React.ReactNode
  pre?: React.ReactNode
}

export function Layout({ bare = false, dark = false, children, pre }: LayoutProps) {
  const { paths } = NamedRoutes.use()
  const isHomepage = useRouteMatch(paths.home)
  const bucketRoute = useRouteMatch(paths.bucketRoot)
  const { bucket } = (bucketRoute?.params as { bucket?: string }) || {}
  const bookmarks = Bookmarks.use()
  return (
    <Root dark={dark}>
      <NavBar.Provider>
        <ErrorBoundary>{bare ? <NavBar.Container /> : <NavBar.NavBar />}</ErrorBoundary>
        {!!pre && pre}
        {!!children && <M.Box p={4}>{children}</M.Box>}
        <M.Box flexGrow={1} />
        <ErrorBoundary>{!!isHomepage && isHomepage.isExact && <Footer />}</ErrorBoundary>
        {bookmarks && <Bookmarks.Sidebar bookmarks={bookmarks} bucket={bucket} />}
      </NavBar.Provider>
    </Root>
  )
}

export default Layout
