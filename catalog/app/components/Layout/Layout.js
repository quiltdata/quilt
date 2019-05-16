import PT from 'prop-types'
import * as React from 'react'
import * as RC from 'recompose'
import { unstable_Box as Box } from '@material-ui/core/Box'

import Footer from 'components/Footer'
import * as NavBar from 'containers/NavBar'
import { composeComponent } from 'utils/reactTools'

export default composeComponent(
  'Layout',
  RC.setPropTypes({
    children: PT.node,
    pre: PT.node,
    bare: PT.bool,
    dark: PT.bool,
  }),
  ({ bare = false, dark = false, children, pre }) => (
    <Box
      bgcolor={dark ? 'primary.main' : 'background.default'}
      display="flex"
      flexDirection="column"
      minHeight="100vh"
    >
      {bare ? <NavBar.Container /> : <NavBar.NavBar />}
      {!!pre && pre}
      <Box p={4}>{children}</Box>
      <Box flexGrow={1} />
      <Footer />
    </Box>
  ),
)
