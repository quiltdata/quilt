import * as React from 'react'
import { useLocation } from 'react-router-dom'

import cfg from 'constants/config'
import Buckets from 'containers/Home/Buckets'
import { useFeature } from 'utils/features'
import MetaTitle from 'utils/MetaTitle'

import Layout from 'website/components/Layout'

import FrontDoor from './FrontDoor'
import LocalMode from './LocalMode'

// The flag read lives here, below the LOCAL branch, rather than in
// `LandingContent` beside it. `useFeature` suspends on a cold cache, and the
// suspension is the *cache's*, not the fetch's: ResourceCache creates an entry in
// `AsyncResult.Init` and defers its fetch a macrotask, and `suspend` throws for
// `Init` as well as `Pending` (utils/ResourceCache.jsx:130, :155). So the read
// suspends even when nothing is fetched -- which is precisely LOCAL mode, where
// `fetchSettings` short-circuits to null before touching S3 and there is no
// service bucket to read (utils/CatalogSettings.tsx:62). Read above the branch,
// it put LOCAL's static panel behind the app placeholder waiting on a request
// that never happened. Landing.suspense.spec.tsx pins that.
//
// Splitting it into a child rather than reordering hooks is what makes the gate
// legal: `cfg.mode` is a module constant read from `window.QUILT_CATALOG_CONFIG`
// at load, never reactive, so a given mount either always reads the flag or never
// does and hook order is stable either way.
//
// Off LOCAL the read below still suspends on a cold cache, and the old comment's
// claim that this "adds no wait" does hold -- but incidentally, and not for the
// reason it gave. The rail does not warm the entry for this page: it CREATES it
// and throws, so it suspends first (measured -- the rail reads once and never
// completes a render) and `/` is behind the app placeholder either way. That is
// a fact about `Sidebar`, not about this page, so giving the rail's read a
// boundary or moving it would silently make this read the one that replaces the
// page. No boundary here for now, deliberately: any fallback would have to
// presume one of the two destinations before the flag that picks them has
// resolved. If the rail's read moves, this needs revisiting.
function FrontDoorGate() {
  const location = useLocation()
  const frontDoor = useFeature('front-door')
  // Keyed on the location so that navigating back to `/` from anywhere resets
  // the bar rather than dropping the user into their last half-typed query.
  if (frontDoor) return <FrontDoor key={location.key} />
  return <Buckets />
}

function LandingContent() {
  if (cfg.mode === 'LOCAL') return <LocalMode />
  return <FrontDoorGate />
}

export default function Landing() {
  return (
    <Layout flush={false}>
      <MetaTitle />
      <LandingContent />
    </Layout>
  )
}
