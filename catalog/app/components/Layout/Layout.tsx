import * as React from 'react'
import { useRouteMatch } from 'react-router-dom'
import * as M from '@material-ui/core'

import Footer from 'components/Footer'
import * as Bookmarks from 'containers/Bookmarks'
import * as NavBar from 'containers/NavBar'
import * as NamedRoutes from 'utils/NamedRoutes'

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
  stickyHeader?: boolean
}

export function Layout({
  bare = false,
  dark = false,
  stickyHeader = false,
  children,
  pre,
}: LayoutProps) {
  const { paths } = NamedRoutes.use()
  const isHomepage = useRouteMatch(paths.home)
  const bucketRoute = useRouteMatch(paths.bucketRoot)
  const { bucket } = (bucketRoute?.params as { bucket?: string }) || {}
  const bookmarks = Bookmarks.use()
  return (
    <Root dark={dark}>
      <NavBar.Provider>
        {bare ? (
          <NavBar.Container sticky={stickyHeader} />
        ) : (
          <NavBar.NavBar sticky={stickyHeader} />
        )}
        {!!pre && pre}
        {!!children && <M.Box p={4}>{children}</M.Box>}
        <M.Box flexGrow={1} />
        {!!isHomepage && isHomepage.isExact && <Footer />}
        {bookmarks && <Bookmarks.Sidebar bookmarks={bookmarks} bucket={bucket} />}
      </NavBar.Provider>
    </Root>
  )
}

export default Layout
