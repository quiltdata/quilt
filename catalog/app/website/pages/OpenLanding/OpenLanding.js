import * as React from 'react'

import Layout from 'website/components/Layout'

import Buckets from './Buckets'
import Search from './Search'
import Showcase from './Showcase'

export default function OpenLanding() {
  return (
    <Layout>
      <Search />
      <Showcase />
      <Buckets />
    </Layout>
  )

  // quilt is different text block (bullets)
  // picture
  // gradient background

  // contribute heading + subtitle
  // link boxes with fancy gradients
  // get notified subheading + text with links + picture
}
