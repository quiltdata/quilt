import * as React from 'react'

import Layout from 'website/components/Layout'
import Contribute from 'website/components/Contribute'

import Buckets from './Buckets'
import Search from './Search'
import Showcase from './Showcase'
import QuiltIsDifferent from './QuiltIsDifferent'

export default function OpenLanding() {
  return (
    <Layout>
      <Search />
      <Showcase />
      <Buckets />
      <QuiltIsDifferent />
      <Contribute />
    </Layout>
  )
}
