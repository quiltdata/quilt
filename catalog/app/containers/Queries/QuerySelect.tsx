import * as React from 'react'
import * as M from '@material-ui/core'

interface AbstractQuery {
  key: string
  name: string
  description?: string
}

interface QuerySelectProps<T> {
  className?: string
  disabled?: boolean
  error?: boolean
  helperText?: React.ReactNode
  label: React.ReactNode
  onChange: (value: T | null) => void
  onLoadMore?: () => void
  queries: T[]
  value: T | null
}

const LOAD_MORE = 'load-more'

export default function QuerySelect<T>({
  className,
  disabled,
  error,
  helperText,
  label,
  onChange,
  onLoadMore,
  queries,
  value,
}: QuerySelectProps<T & AbstractQuery>) {
  const handleChange = React.useCallback(
    (event) => {
      if (event.target.value === LOAD_MORE && onLoadMore) {
        onLoadMore()
      } else {
        onChange(queries.find((query) => query.key === event.target.value) || null)
      }
    },
    [queries, onChange, onLoadMore],
  )

  return (
    <M.FormControl className={className} error={error} fullWidth>
      <M.InputLabel>{label}</M.InputLabel>
      <M.Select
        disabled={disabled || !queries.length}
        onChange={handleChange}
        // The menu rows need `ListItemText` for the name + description pair, but
        // `Select` reuses the selected row's children as the field's display
        // value -- so without this the input inherits a list row's 24px
        // line-height and renders 5px taller than a plain-text Select beside it,
        // leaving the two underlines misaligned. Same trap `Workgroups` avoids by
        // using bare text in its rows.
        renderValue={() => value?.name ?? 'Custom'}
        value={value?.key || 'none'}
      >
        <M.MenuItem disabled value="none">
          <M.ListItemText>Custom</M.ListItemText>
        </M.MenuItem>
        {queries.map((query) => (
          <M.MenuItem key={query.key} value={query.key}>
            <M.ListItemText primary={query.name} secondary={query.description} />
          </M.MenuItem>
        ))}
        {!!onLoadMore && (
          <M.MenuItem key={LOAD_MORE} value={LOAD_MORE}>
            <M.ListItemText>
              <em>Load more</em>
            </M.ListItemText>
          </M.MenuItem>
        )}
      </M.Select>
      {/* Inside the FormControl, so it inherits the field's disabled and error
          state and is wired to the input for assistive tech -- a sibling below
          the control reads at full strength beside a disabled field, and adds its
          height to the row rather than to the field. */}
      {!!helperText && <M.FormHelperText>{helperText}</M.FormHelperText>}
    </M.FormControl>
  )
}
