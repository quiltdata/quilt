import * as React from 'react'

import Buckets from 'containers/Home/Buckets'
import MetaTitle from 'utils/MetaTitle'

import Layout from 'website/components/Layout'

export default function OpenLanding() {
  return (
    <Layout>
      <MetaTitle />
      <Buckets />
    </Layout>
  )
}
