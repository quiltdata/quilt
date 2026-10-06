import * as React from 'react'
import * as M from '@material-ui/core'

import Layout from 'components/Layout'
import MetaTitle from 'utils/MetaTitle'

import Panel from './Panel'

export default function MilestonesPage() {
  return (
    <Layout>
      <MetaTitle>Milestones</MetaTitle>
      <M.Container maxWidth="lg">
        <Panel />
      </M.Container>
    </Layout>
  )
}
