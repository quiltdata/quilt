import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import * as Filters from 'components/Filters'
import { useRelevantBuckets } from 'utils/Buckets'

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
  const buckets = useRelevantBuckets()
  const extents = React.useMemo(() => buckets.map((b) => b.name), [buckets])
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
