import PT from 'prop-types'
import * as React from 'react'
import * as RC from 'recompose'
import { unstable_Box as Box } from '@material-ui/core/Box'
import { useTheme } from '@material-ui/styles'

import Footer from 'components/Footer'
import * as NavBar from 'containers/NavBar'
import { composeComponent } from 'utils/reactTools'

export const Root = ({ dark = false, ...props }) => (
  <Box
    bgcolor={dark ? 'primary.main' : 'background.default'}
    display="flex"
    flexDirection="column"
    minHeight="100vh"
    {...props}
  />
)

export const Container = (props) => {
  const t = useTheme()
  return (
    <Box
      maxWidth={t.layout.container.width + t.spacing.unit * 4}
      px={2}
      mx="auto"
      width="100%"
      {...props}
    />
  )
}

export default composeComponent(
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
