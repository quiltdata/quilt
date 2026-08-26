import * as React from 'react'
import * as M from '@material-ui/core'

import Buckets from 'containers/Home/Buckets'
import MetaTitle from 'utils/MetaTitle'

import Layout from 'website/components/Layout'

import Search from './Search'

export default function OpenLanding() {
  return (
    <Layout>
      <MetaTitle />
      <Search />
      <M.Divider />
      <Buckets />
    </Layout>
  )
}
