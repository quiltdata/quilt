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
      // Show a neutral placeholder while prefs load instead of legacy Overview:
      // since overviewV2 defaults true, mounting legacy here would flash it and
      // fire its data requests on the common path before swapping to v2.
      Pending: () => <Placeholder color="text.secondary" />,
      Init: () => <Placeholder color="text.secondary" />,
    },
    prefs,
  )
}
