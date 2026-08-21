import * as React from 'react'

import Buckets from 'containers/Home/Buckets'
import MetaTitle from 'utils/MetaTitle'

import Layout from 'website/components/Layout'

// The volume list on its own path. `/` shows this too when the `front-door`
// preview feature is off, but the sidebar and anything else that means "the
// list of buckets" links here, so the destination doesn't move when the flag
// flips.
export default function BucketList() {
  return (
    <Layout flush={false}>
      <MetaTitle>Volumes</MetaTitle>
      <Buckets />
    </Layout>
  )
}
