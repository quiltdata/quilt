import * as React from 'react'

import * as LinkedData from 'utils/LinkedData'
import MetaTitle from 'utils/MetaTitle'
import parseSearch from 'utils/parseSearch'

import Layout from 'website/components/Layout'
import Contribute from 'website/components/Contribute'
import Videos from 'website/components/Videos'

import Buckets from './Buckets'
import Search from './Search'
import Showcase from './Showcase'
import QuiltIsDifferent from './QuiltIsDifferent'

export default function OpenLanding({ location }) {
  const { q: query = '' } = parseSearch(location.search)
  return (
    <Layout>
      <MetaTitle />
      <React.Suspense fallback={null}>
        <LinkedData.CatalogData />
      </React.Suspense>
      <Search />
      <Showcase />
      <Buckets query={query} />
      <Videos />
      <QuiltIsDifferent />
      <Contribute />
    </Layout>
  )
}
