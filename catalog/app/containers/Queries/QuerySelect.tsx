import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import * as requests from './requests'

interface QuerySelectProps {
  className: string
  loading: boolean
  onChange: (value: requests.Query) => void
  queriesConfig: requests.Config | null
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
  queriesConfig,
  value,
}: QuerySelectProps) {
  const classes = useStyles()

  const handleChange = React.useCallback(
    (event) => {
      const querySlug = event.target.value
      if (!queriesConfig) return
      onChange({
        key: querySlug,
        ...queriesConfig.queries[querySlug],
      })
    },
    [queriesConfig, onChange],
  )

  const list = React.useMemo(() => {
    if (!queriesConfig || !queriesConfig.queries) return []
    return Object.entries(queriesConfig.queries).map(([key, query]) => ({
      key,
      ...query,
    }))
  }, [queriesConfig])

  if (loading) return <QuerySelectSkeleton className={className} />

  return (
    <M.FormControl className={cx(classes.root, className)}>
      <M.Select value={value ? value.key : ''} onChange={handleChange}>
        {list.map((query) => (
          <M.MenuItem key={query.key} value={query.key}>
            {query.name}
          </M.MenuItem>
        ))}
      </M.Select>
    </M.FormControl>
  )
}
