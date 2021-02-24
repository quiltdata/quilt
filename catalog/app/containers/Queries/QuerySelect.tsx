import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import * as requests from './requests'

interface QuerySelectProps {
  className: string
  loading: boolean
  onChange: (value: requests.Query | null) => void
  queriesList: requests.Query[]
  value: requests.Query | null
}

interface QuerySelectSkeletonProps {
  className: string
}

function QuerySelectSkeleton({ className }: QuerySelectSkeletonProps) {
  const t = M.useTheme()
  return (
    <Lab.Skeleton
      className={className}
      variant="rect"
      height={t.spacing(4)}
      width="100%"
    />
  )
}

const useStyles = M.makeStyles({
  root: {
    width: '100%',
  },
})

export default function QuerySelect({
  className,
  loading,
  onChange,
  queriesList,
  value,
}: QuerySelectProps) {
  const classes = useStyles()

  const handleChange = React.useCallback(
    (event) => {
      onChange(queriesList.find((query) => query.key === event.target.value) || null)
    },
    [queriesList, onChange],
  )

  if (loading) return <QuerySelectSkeleton className={className} />

  return (
    <M.FormControl className={cx(classes.root, className)}>
      <M.Select value={value ? value.key : ''} onChange={handleChange}>
        {queriesList.map((query) => (
          <M.MenuItem key={query.key} value={query.key}>
            {query.name}
          </M.MenuItem>
        ))}
      </M.Select>
    </M.FormControl>
  )
}
