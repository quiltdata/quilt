import * as React from 'react'

import * as BucketPreferences from 'utils/BucketPreferences'

import Overview from './Overview'
import OverviewV2 from './v2/Overview'

export default function OverviewSelector() {
  const { prefs } = BucketPreferences.use()
  return BucketPreferences.Result.match(
    {
      Ok: ({ ui: { blocks } }) => (blocks.overviewV2 ? <OverviewV2 /> : <Overview />),
      _: () => <Overview />,
    },
    prefs,
  )
}
