import cx from 'classnames'
import Fuse from 'fuse.js'
import * as React from 'react'
import * as M from '@material-ui/core'

import TinyTextField from './TinyTextField'

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
  scrollArea: {
    flexGrow: 1,
    overflow: 'hidden auto',
    margin: t.spacing(1, 0),
  },
  label: {
    cursor: 'pointer',
    display: 'block',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  checkboxWrapper: {
    minWidth: t.spacing(4),
    paddingLeft: '2px',
  },
}))

interface ListProps {
  className?: string
  extents: string[]
  onChange: (v: string[]) => void
  placeholder?: string
  searchThreshold?: number
  value: string[]
}

export default function List({
  className,
  extents,
  onChange,
  placeholder,
  value,
  searchThreshold = 5,
}: ListProps) {
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
    (extent, checked) => {
      const newValue = checked ? [...value, extent] : value.filter((v) => v !== extent)
      onChange(newValue)
    },
    [onChange, value],
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
        />
      )}
      <div className={classes.scrollArea}>
        <M.List dense disablePadding>
          {filteredExtents.map((extent) => (
            <M.ListItem key={extent} disableGutters>
              <M.ListItemIcon className={classes.checkboxWrapper}>
                <M.Checkbox
                  edge="start"
                  checked={!!valueMap[extent]}
                  id={`list_${extent}`}
                  onChange={(event, checked) => handleChange(extent, checked)}
                  size="small"
                />
              </M.ListItemIcon>
              <M.ListItemText>
                <label
                  className={classes.label}
                  htmlFor={`list_${extent}`}
                  title={extent}
                >
                  {extent}
                </label>
              </M.ListItemText>
            </M.ListItem>
          ))}
        </M.List>
      </div>
      {!!hiddenNumber && (
        <M.Typography variant="caption">
          {extents.length
            ? `There are ${hiddenNumber} more items available. Loosen search query to see more.`
            : `${hiddenNumber} available items are hidden. Clear filters to see them.`}
        </M.Typography>
      )}
    </div>
  )
}
