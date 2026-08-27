import * as React from 'react'

import { useFeature } from 'utils/features'

import Overview from './Overview'
import OverviewV2 from './v2/Overview'

export default function OverviewSelector() {
  const legacy = useFeature('legacy-ui')
  return legacy ? <Overview /> : <OverviewV2 />
}
