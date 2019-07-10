import * as React from 'react'
import { ThemeProvider } from '@material-ui/styles'

import * as style from 'constants/style'
import * as Layout from 'components/Layout'

export default ({ children, ...props }) => (
  <ThemeProvider theme={style.websiteTheme}>
    <Layout.Layout pre={children} {...props} />
  </ThemeProvider>
)
