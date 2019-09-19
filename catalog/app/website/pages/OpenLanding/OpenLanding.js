import * as React from 'react'

import Layout from 'website/components/Layout'

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
    </Layout>
  )

  // contribute heading + subtitle
  // link boxes with fancy gradients
  // get notified subheading + text with links + picture
}
