import * as React from 'react'
import { useLocation } from 'react-router-dom'

import cfg from 'constants/config'
import Buckets from 'containers/Home/Buckets'
import { useFeature } from 'utils/features'
import MetaTitle from 'utils/MetaTitle'

import Layout from 'website/components/Layout'

import FrontDoor from './FrontDoor'
import LocalMode from './LocalMode'

function LandingContent() {
  const location = useLocation()
  // Unconditional, above the LOCAL early return, because it is a hook. It
  // suspends, but adds no wait here: the enclosing Layout renders the Sidebar,
  // which already reads the same CatalogSettings cache entry, so `/` suspends on
  // this data with or without the flag.
  const frontDoor = useFeature('front-door')
  if (cfg.mode === 'LOCAL') return <LocalMode />
  // Keyed on the location so that navigating back to `/` from anywhere resets
  // the bar rather than dropping the user into their last half-typed query.
  if (frontDoor) return <FrontDoor key={location.key} />
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
