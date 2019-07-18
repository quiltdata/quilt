import * as React from 'react'
import * as M from '@material-ui/core'

import FAIcon from 'components/FAIcon'
import * as Intercom from 'components/Intercom'
import Layout from 'components/Layout'
import * as URLS from 'constants/urls'

import background from './background.png'

const Back = M.styled(M.Box)({
  backgroundImage: `url(${background})`,
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat',
  backgroundSize: 'contain',
})

const Thin = M.styled(M.Typography)({
  fontWeight: 300,
})

export default () => {
  const intercom = Intercom.use()
  return (
    <Layout
      dark
      pre={
        <>
          <Back p={8} height={600} color="white">
            <Thin variant="h3" color="inherit" gutterBottom>
              Collaborate in S3
            </Thin>
            <Thin variant="body1" color="inherit">
              Search, visualize, and version data with Quilt
            </Thin>
          </Back>
          <M.Box color="common.white" display="flex" p={2}>
            <M.Box flexGrow={1} />
            <M.Button href={URLS.slackInvite} color="inherit">
              <FAIcon type="slack" />
              &nbsp;Join Slack
            </M.Button>
            <M.Box width="1em" />
            <M.Button href={URLS.docs} color="inherit">
              <FAIcon type="book" />
              &nbsp;Read Docs
            </M.Button>
            <M.Box width="1em" />
            <M.Button onClick={() => intercom('show')} color="inherit">
              <FAIcon type="chatBubble" />
              &nbsp;Chat
            </M.Button>
          </M.Box>
        </>
      }
    />
  )
}
