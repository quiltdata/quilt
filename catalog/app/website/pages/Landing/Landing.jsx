import * as React from 'react'
import { useLocation } from 'react-router-dom'

import cfg from 'constants/config'
import MetaTitle from 'utils/MetaTitle'

import Dots from 'website/components/Backgrounds/Dots'
import Layout from 'website/components/Layout'

import Buckets from './Buckets'
import FrontDoor from './FrontDoor'
import LocalMode from './LocalMode'

function LandingContent() {
  const location = useLocation()
  if (cfg.mode === 'LOCAL') return <LocalMode />
  if (cfg.frontDoorV2 === true) return <FrontDoor key={location.key} />

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
