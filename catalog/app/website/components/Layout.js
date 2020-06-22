import * as React from 'react'
import { ThemeProvider } from '@material-ui/styles'

import { ExperimentsProvider } from 'components/Experiments'
import * as Layout from 'components/Layout'
import { TalkToUsProvider } from 'components/TalkToUs'
import * as style from 'constants/style'

// TODO: ensure proper variants
const variants = {
  cta: [
    'Ready to synchronize your data?',
  ],
  lede: [
    'Maximize your return on data by managing data like code',
    'Experiment faster by managing data like code',
  ],
}

export default ({ children, ...props }) => (
  <ThemeProvider theme={style.websiteTheme}>
    <ExperimentsProvider variants={variants}>
      <TalkToUsProvider>
        <Layout.Layout pre={children} {...props} />
      </TalkToUsProvider>
    </ExperimentsProvider>
  </ThemeProvider>
)
