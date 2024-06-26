import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import * as Assistant from 'components/Assistant'
import * as Filters from 'components/Filters'
import * as BucketConfig from 'utils/BucketConfig'

import * as SearchUIModel from './model'

const useStyles = M.makeStyles({
  root: {
    overflow: 'hidden',
    paddingTop: '6px',
  },
})

export default function Buckets({ className }: { className?: string }) {
  const classes = useStyles()
  const model = SearchUIModel.use()
  const bucketConfigs = BucketConfig.useRelevantBucketConfigs()
  const extents = React.useMemo(() => bucketConfigs.map((b) => b.name), [bucketConfigs])
  const message = [
    '<available-buckets>',
    ...bucketConfigs.map((b) => {
      const str = JSON.stringify(
        {
          name: b.name,
          title: b.title,
          description: b.description,
          tags: b.tags,
        },
        null,
        2,
      )
      return `<bucket>${str}</bucket>`
    }),
    '</available-buckets>',
  ].join('\n')
  Assistant.Context.usePushContext({ messages: [message] })
  return (
    <div className={cx(classes.root, className)}>
      <Filters.Enum
        extents={extents}
        label="In buckets"
        onChange={model.actions.setBuckets}
        placeholder="Select buckets"
        size="small"
        value={model.state.buckets as string[]}
        variant="outlined"
        selectAll={'All buckets'}
      />
    </div>
  )
}
