import * as React from 'react'
import * as M from '@material-ui/core'

type Query = {
  content: string
  description?: string
  key: string
  name: string
  url: string
}

interface QuerySelectProps {
  onChange: (value: string) => void
  queries: Query[]
  value: string
}

export default function QuerySelect({ onChange, queries, value }: QuerySelectProps) {
  const handleChange = React.useCallback(
    (event) => {
      onChange(event.target.value.toString())
    },
    [onChange],
  )

  return (
    <M.FormControl>
      <M.Select value={value} onChange={handleChange}>
        {queries.map((query) => (
          <M.MenuItem key={query.key} value={query.key}>
            {query.name}
          </M.MenuItem>
        ))}
      </M.Select>
    </M.FormControl>
  )
}
