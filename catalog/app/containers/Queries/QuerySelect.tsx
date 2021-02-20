import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import * as requests from './requests'

interface QuerySelectProps {
  loading: boolean
  onChange: (value: string) => void
  queriesConfig: requests.Config | null
  value: requests.Query | null
}

function QuerySelectSkeleton() {
  const t = M.useTheme()
  return <Lab.Skeleton height={t.spacing(4)} width="100%" />
}

export default function QuerySelect({
  loading,
  onChange,
  queriesConfig,
  value,
}: QuerySelectProps) {
  const handleChange = React.useCallback(
    (event) => {
      onChange(event.target.value)
    },
    [onChange],
  )

  const list = React.useMemo(() => {
    if (!queriesConfig || !queriesConfig.queries) return []
    return Object.entries(queriesConfig.queries).map(([key, query]) => ({
      key,
      ...query,
    }))
  }, [queriesConfig])

  if (loading) return <QuerySelectSkeleton />

  return (
    <M.FormControl>
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
