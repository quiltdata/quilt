import * as React from 'react'
import { ThemeProvider } from '@material-ui/styles'

import * as Layout from 'components/Layout'
import createTheme from 'website/theme'

export { default as Container } from 'components/Layout/Container'

export default () => (
  <ThemeProvider theme={createTheme}>
    <Layout.Layout pre={children} />
  </ThemeProvider>
)
