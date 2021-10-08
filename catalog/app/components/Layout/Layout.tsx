import * as React from 'react'
import * as M from '@material-ui/core'

import Footer from 'components/Footer'
import * as NavBar from 'containers/NavBar'

const useRootStyles = M.makeStyles({
  root: {
    overflowX: 'hidden',
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
  return (
    <Root dark={dark}>
      {bare ? <NavBar.Container /> : <NavBar.NavBar />}
      {!!pre && pre}
      {!!children && <M.Box p={4}>{children}</M.Box>}
      <M.Box flexGrow={1} />
      <Footer />
    </Root>
  )
}

export default Layout
