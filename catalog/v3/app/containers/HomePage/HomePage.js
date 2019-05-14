import * as React from 'react'
import { unstable_Box as Box } from '@material-ui/core/Box'
import Button from '@material-ui/core/Button'

import FAIcon from 'components/FAIcon'
import Feature from 'components/Feature'
import * as Intercom from 'components/Intercom'
import Layout from 'components/Layout'
import * as urls from 'constants/urls'

export default () => {
  const intercom = Intercom.use()
  return (
    <Layout
      dark
      pre={
        <React.Fragment>
          <Feature
            header="Collaborate in S3"
            tagline="Search, visualize, and version data with Quilt"
          />
          <Box color="common.white" display="flex" p={2}>
            <Box flexGrow={1} />
            <Button href={urls.slackInvite} color="inherit">
              <FAIcon type="slack" />
              &nbsp;Join Slack
            </Button>
            <Box width="1em" />
            <Button href={urls.t4Docs} color="inherit">
              <FAIcon type="book" />
              &nbsp;Read Docs
            </Button>
            <Box width="1em" />
            <Button onClick={() => intercom('show')} color="inherit">
              <FAIcon type="chatBubble" />
              &nbsp;Chat
            </Button>
          </Box>
        </React.Fragment>
      }
    />
  )
}
