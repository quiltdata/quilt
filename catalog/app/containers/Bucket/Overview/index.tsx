import * as React from 'react'

import * as CatalogSettings from 'utils/CatalogSettings'

import Overview from './Overview'
import OverviewV2 from './v2/Overview'

export default function OverviewSelector() {
  const settings = CatalogSettings.use()
  return settings?.beta ? <OverviewV2 /> : <Overview />
}
