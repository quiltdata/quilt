import * as React from 'react'

import * as LinkedData from 'utils/LinkedData'

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
      <React.Suspense fallback={null}>
        <LinkedData.CatalogData />
      </React.Suspense>
      <Search />
      <Showcase />
      <Buckets />
      <Videos />
      <QuiltIsDifferent />
      <Contribute />
    </Layout>
  )
}
