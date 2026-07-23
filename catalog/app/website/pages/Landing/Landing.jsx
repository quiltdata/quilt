import * as React from 'react'

import cfg from 'constants/config'
import Buckets from 'containers/Home/Buckets'
import MetaTitle from 'utils/MetaTitle'

import Layout from 'website/components/Layout'

import LocalMode from './LocalMode'

export default function Landing() {
  return (
    <Layout flush={false}>
      <MetaTitle />
      {cfg.mode === 'LOCAL' ? <LocalMode /> : <Buckets />}
    </Layout>
  )
}
