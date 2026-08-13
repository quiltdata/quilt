import * as React from 'react'
import { useLocation } from 'react-router-dom'

import cfg from 'constants/config'
import Buckets from 'containers/Home/Buckets'
import MetaTitle from 'utils/MetaTitle'

import Layout from 'website/components/Layout'

import FrontDoor from './FrontDoor'
import LocalMode from './LocalMode'

function LandingContent() {
  const location = useLocation()
  if (cfg.mode === 'LOCAL') return <LocalMode />
  // Keyed on the location so that navigating back to `/` from anywhere resets
  // the bar rather than dropping the user into their last half-typed query.
  if (cfg.frontDoorV2 === true) return <FrontDoor key={location.key} />
  return <Buckets />
}

export default function Landing() {
  return (
    <Layout flush={false}>
      <MetaTitle />
      <LandingContent />
    </Layout>
  )
}
