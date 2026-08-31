import * as React from 'react'
import * as M from '@material-ui/core'

import useId from 'utils/useId'

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
  const helperId = useId()
  const labelId = useId()
  const buttonId = useId()
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
    // `disabled` belongs on the FormControl, not the Select: MUI propagates it
    // down through context, and only from here do the label and helper text pick
    // it up too.
    <M.FormControl
      className={className}
      disabled={disabled || !queries.length}
      error={error}
      fullWidth
    >
      <M.InputLabel id={labelId}>{label}</M.InputLabel>
      <M.Select
        // An InputLabel next to a Select names nothing by itself -- only
        // `labelId` reaches the focusable display div. `id` must come with it:
        // MUI joins the two into `aria-labelledby="labelId buttonId"`, and with
        // `labelId` alone the label overrides the div's contents, dropping the
        // selected query from the accessible name.
        labelId={labelId}
        id={buttonId}
        onChange={handleChange}
        // The menu rows need `ListItemText` for the name + description pair, but
        // `Select` reuses the selected row's children as the field's display
        // value -- so without this the input inherits a list row's 24px
        // line-height and renders 5px taller than a plain-text Select beside it,
        // leaving the two underlines misaligned. Same trap `Workgroups` avoids by
        // using bare text in its rows.
        // Blank under error: callers null the value on a failed load, and
        // "Custom" would assert a hand-written query is loaded right beside a
        // helper saying the load failed.
        renderValue={() => value?.name ?? (error ? '' : 'Custom')}
        // Not `aria-describedby` on the Select: that lands on the hidden native
        // input. The focusable node is the `role="button"` display div, which is
        // only reachable through `SelectDisplayProps`.
        SelectDisplayProps={helperText ? { 'aria-describedby': helperId } : undefined}
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
      {/* Inside the FormControl so its height lands on the field rather than on
          the flex row, which would push this field's underline below the
          workgroup Select's. */}
      {!!helperText && <M.FormHelperText id={helperId}>{helperText}</M.FormHelperText>}
    </M.FormControl>
  )
}
