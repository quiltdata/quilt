import * as React from 'react'

// TODO: decouple NavBar layout/state from gql and auth calls
//       and place it into components/SearchBar
import * as NavBar from 'containers/NavBar'

import * as LinkedData from 'utils/LinkedData'
import MetaTitle from 'utils/MetaTitle'

import Layout from 'website/components/Layout'

import Buckets from './Buckets'
import Search from './Search'

export default function OpenLanding() {
  return (
    <Layout>
      <MetaTitle />
      <React.Suspense fallback={null}>
        <LinkedData.CatalogData />
      </React.Suspense>
      <NavBar.Provider>
        <Search />
      </NavBar.Provider>
      <Buckets />
    </Layout>
  )
}
