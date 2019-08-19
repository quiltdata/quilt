import PT from 'prop-types'
import * as React from 'react'
import * as RC from 'recompose'
import { Box } from '@material-ui/core'
import { styled } from '@material-ui/styles'

import Footer from 'components/Footer'
import * as NavBar from 'containers/NavBar'
import { composeComponent } from 'utils/reactTools'

export const Root = styled(({ dark = false, ...props }) => (
  <Box
    bgcolor={dark ? 'primary.main' : 'background.default'}
    display="flex"
    flexDirection="column"
    minHeight="100vh"
    {...props}
  />
))({
  overflowX: 'hidden',
})

export const Layout = composeComponent(
  'Layout',
  RC.setPropTypes({
    children: PT.node,
    pre: PT.node,
    bare: PT.bool,
    dark: PT.bool,
  }),
  ({ bare = false, dark = false, children, pre }) => (
    <Root dark={dark}>
      {bare ? <NavBar.Container /> : <NavBar.NavBar />}
      {!!pre && pre}
      {!!children && <Box p={4}>{children}</Box>}
      <Box flexGrow={1} />
      <Footer />
    </Root>
  ),
)

export default Layout
