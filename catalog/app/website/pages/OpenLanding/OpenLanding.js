import * as React from 'react'

import Layout from 'website/components/Layout'
import Contribute from 'website/components/Contribute'
import Videos from 'website/components/Videos'

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
      <Videos />
      <QuiltIsDifferent />
      <Contribute />
    </Layout>
  )
}
