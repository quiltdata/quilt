import * as React from 'react'

import * as Filters from 'components/Filters'
import * as BucketConfig from 'utils/BucketConfig'

import * as SearchUIModel from './model'

export default function Buckets() {
  const model = SearchUIModel.use()
  const bucketConfigs = BucketConfig.useRelevantBucketConfigs()
  const extents = React.useMemo(
    () => bucketConfigs.map(({ name }) => `s3://${name}`),
    [bucketConfigs],
  )
  const { setBuckets } = model.actions
  const handleChange = React.useCallback(
    (urls: string[]) => setBuckets(urls.map((u) => u.replace(/^s3:\/\//, ''))),
    [setBuckets],
  )
  return (
    <Filters.Container defaultExpanded title="Buckets">
      {extents && (
        <Filters.Enum
          extents={extents}
          onChange={handleChange}
          placeholder="Select buckets"
          value={model.state.buckets}
        />
      )}
    </Filters.Container>
  )
}
