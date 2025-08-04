import cx from 'classnames'
import Fuse from 'fuse.js'
import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

import TinyTextField from './TinyTextField'
import type { Value } from './types'

// Number of items, when we show search text field
const TEXT_FIELD_VISIBLE_THRESHOLD = 8

function fuzzySearchExtents(extents: string[], searchStr: string): string[] {
  if (!searchStr) return extents
  const fuse = new Fuse(extents, { includeScore: true })
  return fuse
    .search(searchStr)
    .sort((a, b) => (a.score || Infinity) - (b.score || Infinity))
    .map(({ item }) => item)
}

const useStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    maxHeight: t.spacing(40),
  },
  checkboxWrapper: {
    minWidth: t.spacing(4),
    paddingLeft: '2px',
  },
  label: {
    cursor: 'pointer',
    display: 'block',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  listItem: {
    padding: 0,
  },
  scrollArea: {
    border: `1px solid ${M.fade(t.palette.text.primary, 0.23)}`,
    flexGrow: 1,
    overflow: 'hidden auto',
    borderRadius: t.shape.borderRadius,
  },
  filter: {
    background: t.palette.background.paper,
    borderRadius: `${t.shape.borderRadius}px ${t.shape.borderRadius}px 0 0 `,
    '& + $scrollArea': {
      borderWidth: '0 1px 1px',
      borderRadius: `0 0 ${t.shape.borderRadius}px ${t.shape.borderRadius}px`,
    },
  },
}))

interface ListProps {
  className?: string
  error: Error | null
  extents: readonly string[]
  onChange: (v: Value<string[]>) => void
  placeholder?: string
  searchThreshold?: number
  value: readonly string[]
}

export default function List({
  className,
  error,
  extents: rawExtents,
  onChange,
  placeholder,
  value,
  searchThreshold = TEXT_FIELD_VISIBLE_THRESHOLD,
}: ListProps) {
  const extents = React.useMemo(
    () => R.uniq([...value, ...rawExtents]),
    [value, rawExtents],
  )
  const [filter, setFilter] = React.useState('')
  const classes = useStyles()
  const valueMap = value.reduce(
    (memo, v) => ({ ...memo, [v]: true }),
    {} as Record<string, boolean>,
  )
  const filteredExtents = React.useMemo(
    () => fuzzySearchExtents(extents, filter),
    [filter, extents],
  )
  const handleChange = React.useCallback(
    (extent: string, checked: boolean) => {
      if (!extents.includes(extent)) return new Error(`Value ${extent} out of bounds`)
      const newValue = checked ? [...value, extent] : value.filter((v) => v !== extent)
      onChange(newValue)
    },
    [onChange, extents, value],
  )
  const hiddenNumber = extents.length - filteredExtents.length
  return (
    <div className={cx(classes.root, className)}>
      {extents.length > searchThreshold && (
        <TinyTextField
          fullWidth
          onChange={setFilter}
          placeholder={placeholder}
          value={filter}
          className={classes.filter}
        />
      )}
      <div className={classes.scrollArea}>
        <M.List dense disablePadding>
          {extents.length ? (
            filteredExtents.map((extent) => (
              <M.ListItem key={extent} disableGutters className={classes.listItem} button>
                <M.ListItemIcon className={classes.checkboxWrapper}>
                  <M.Checkbox
                    checked={!!valueMap[extent]}
                    id={`list_${extent}`}
                    onChange={(_event, checked) => handleChange(extent, checked)}
                    size="small"
                  />
                </M.ListItemIcon>
                <M.ListItemText>
                  <label
                    className={classes.label}
                    htmlFor={`list_${extent}`}
                    title={extent}
                  >
                    {extent || <i>EMPTY STRING</i>}
                  </label>
                </M.ListItemText>
              </M.ListItem>
            ))
          ) : (
            <M.ListItem>
              <M.ListItemIcon className={classes.checkboxWrapper}>
                <M.Icon fontSize="small">not_interested</M.Icon>
              </M.ListItemIcon>
              <M.ListItemText primary={<i>No available items</i>} />
            </M.ListItem>
          )}
        </M.List>
      </div>
      {error && <M.FormHelperText error>{error.message}</M.FormHelperText>}
      {!!hiddenNumber && (
        <M.FormHelperText error={!filteredExtents.length}>
          {filteredExtents.length
            ? `There are ${hiddenNumber} more items available. Loosen search query to see more.`
            : `${hiddenNumber} available items are hidden. Clear filters to see them.`}
        </M.FormHelperText>
      )}
    </div>
  )
}
