import * as React from 'react'

import MetaTitle from 'utils/MetaTitle'

import Dots from 'website/components/Backgrounds/Dots'
import Layout from 'website/components/Layout'

import Buckets from './Buckets'

export default function AllBuckets() {
  return (
    <Layout>
      <MetaTitle>{['Buckets']}</MetaTitle>
      <Dots style={{ bottom: 0 }} />
      <Buckets />
    </Layout>
  )
}
