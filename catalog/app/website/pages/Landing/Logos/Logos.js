import * as React from 'react'

import LogosCarousel from 'website/pages/Landing/LogosCarousel'

import logos from './list'

export default function Logos() {
  return <LogosCarousel logos={logos} title="Companies that love Quilt" />
}
