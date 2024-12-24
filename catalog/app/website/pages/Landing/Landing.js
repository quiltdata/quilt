import * as React from 'react'

import cfg from 'constants/config'
import MetaTitle from 'utils/MetaTitle'

import Dots from 'website/components/Backgrounds/Dots'
import Layout from 'website/components/Layout'

import Buckets from './Buckets'
import LocalMode from './LocalMode'

export default function Landing() {
  return (
    <Layout>
      <MetaTitle />
      {cfg.mode === 'LOCAL' ? (
        <LocalMode />
      ) : (
        <>
          <Dots style={{ bottom: 0 }} />
          <Buckets />
        </>
      )}
    </Layout>
  )
}
