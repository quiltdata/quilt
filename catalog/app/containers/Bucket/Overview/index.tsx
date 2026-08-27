import * as React from 'react'

import * as CatalogSettings from 'utils/CatalogSettings'

import Overview from './Overview'
import OverviewV2 from './v2/Overview'

export default function OverviewSelector() {
  const beta = CatalogSettings.useBetaEnabled()
  return beta ? <OverviewV2 /> : <Overview />
}
