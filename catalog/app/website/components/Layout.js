import * as React from 'react'
import { ThemeProvider } from '@material-ui/styles'

import * as Layout from 'components/Layout'
import createTheme from 'website/theme'

export default ({ children, ...props }) => (
  <ThemeProvider theme={createTheme}>
    <Layout.Layout pre={children} {...props} />
  </ThemeProvider>
)
