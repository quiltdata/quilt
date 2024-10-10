import * as React from 'react'
import { ThemeProvider } from '@material-ui/core/styles'

import * as Layout from 'components/Layout'
import * as style from 'constants/style'

export default function WebsiteLayout({ children, ...props }: Layout.LayoutProps) {
  return (
    <ThemeProvider theme={style.websiteTheme}>
      <Layout.Layout pre={children} {...props} />
    </ThemeProvider>
  )
}
