import * as React from 'react'
import * as redux from 'react-redux'
import * as M from '@material-ui/core'

import * as Intercom from 'components/Intercom'
import * as URLS from 'constants/urls'
import * as authSelectors from 'containers/Auth/selectors'

import Layout from 'website/components/Layout'
import Contribute from 'website/components/Contribute'

function UserInfo() {
  const username = redux.useSelector(authSelectors.username)
  const intercom = Intercom.use()
  const showIntercom = React.useCallback(() => intercom('show'), [intercom])
  return (
    <M.Container maxWidth="lg">
      <M.Box mt={10} mb={5}>
        <M.Typography variant="h1" color="textPrimary" align="center">
          Welcome to Quilt, <code>{username}</code>
        </M.Typography>
      </M.Box>
      <M.Box maxWidth="35rem" mx="auto">
        <M.Typography variant="body1" color="textPrimary">
          By signing in you gain unlimited searches. Many more features are on the way.
          Check out our{' '}
          <M.Link color="secondary" underline="always" href={`${URLS.gitWeb}#roadmap`}>
            roadmap
          </M.Link>
          . If you&apos;d like to add public data to Quilt,{' '}
          <M.Link color="secondary" underline="always" href={URLS.curate}>
            apply to become a data curator
          </M.Link>
          .
        </M.Typography>
        <M.Box pt={3} />
        <M.Typography variant="body1" color="textPrimary">
          <M.Link color="secondary" underline="always" onClick={showIntercom}>
            Questions?
          </M.Link>
        </M.Typography>
      </M.Box>
    </M.Container>
  )
}

export default function OpenProfile() {
  return (
    <Layout>
      <UserInfo />
      <Contribute />
    </Layout>
  )
}
