import * as React from 'react'
import * as M from '@material-ui/core'

import MetaTitle from 'utils/MetaTitle'

import Layout from 'website/components/Layout'
import Buckets from 'website/pages/Landing/Buckets'

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
