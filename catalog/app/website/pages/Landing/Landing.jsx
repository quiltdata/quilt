import * as React from 'react'

import cfg from 'constants/config'
import MetaTitle from 'utils/MetaTitle'

import Dots from 'website/components/Backgrounds/Dots'
import Layout from 'website/components/Layout'

import Buckets from './Buckets'
import FrontDoor from './FrontDoor'
import LocalMode from './LocalMode'

function LandingContent() {
  if (cfg.mode === 'LOCAL') return <LocalMode />
  if (cfg.frontDoorV2 === true) return <FrontDoor />

  return (
    <>
      <Dots style={{ bottom: 0 }} />
      <Buckets />
    </>
  )
}

export default function Landing() {
  return (
    <Layout>
      <MetaTitle />
      <LandingContent />
    </Layout>
  )
}
