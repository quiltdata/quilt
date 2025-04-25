import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import * as Filters from 'components/Filters'
import * as BucketConfig from 'utils/BucketConfig'
import StyledLink from 'utils/StyledLink'

import * as SearchUIModel from './model'

const useStyles = M.makeStyles({
  root: {
    overflow: 'hidden',
    paddingTop: '6px',
  },
})

interface BucketsProps {
  className?: string
  disabled?: boolean
}

export default function Buckets({ className, disabled }: BucketsProps) {
  const classes = useStyles()
  const model = SearchUIModel.use()
  const bucketConfigs = BucketConfig.useRelevantBucketConfigs()
  const extents = React.useMemo(() => bucketConfigs.map((b) => b.name), [bucketConfigs])

  const makeUrl = SearchUIModel.useMakeUrl()
  let href = makeUrl({ ...model.state, buckets: [] })
  return (
    <div className={cx(classes.root, className)}>
      <Filters.Enum
        disabled={disabled}
        extents={extents}
        helperText={
          model.state.buckets.length === 1 && (
            <StyledLink to={href}>Search in other buckets</StyledLink>
          )
        }
        label="In buckets"
        onChange={model.actions.setBuckets}
        placeholder="Select buckets"
        selectAll={'All buckets'}
        size="small"
        value={model.state.buckets as string[]}
        variant="outlined"
      />
    </div>
  )
}
