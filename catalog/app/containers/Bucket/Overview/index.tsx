import * as React from 'react'

import Placeholder from 'components/Placeholder'
import * as BucketPreferences from 'utils/BucketPreferences'

import Overview from './Overview'
import OverviewV2 from './v2/Overview'

export default function OverviewSelector() {
  const { prefs } = BucketPreferences.use()
  return BucketPreferences.Result.match(
    {
      Ok: ({ ui: { blocks } }) => (blocks.overviewV2 ? <OverviewV2 /> : <Overview />),
      // Neutral placeholder while prefs load, so neither variant flashes (and
      // fires its data requests) before the per-bucket choice resolves.
      Pending: () => <Placeholder color="text.secondary" />,
      Init: () => <Placeholder color="text.secondary" />,
    },
    prefs,
  )
}
