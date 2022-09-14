import * as React from 'react'
import { ThemeProvider } from '@material-ui/styles'

import * as Layout from 'components/Layout'
import { TalkToUsProvider } from 'components/TalkToUs'
import * as style from 'constants/style'

export default function WebsiteLayout({ children, ...props }: Layout.LayoutProps) {
  return (
    <ThemeProvider theme={style.websiteTheme}>
      <TalkToUsProvider>
        <Layout.Layout pre={children} {...props} />
      </TalkToUsProvider>
    </ThemeProvider>
  )
}
