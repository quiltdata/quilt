import cx from 'classnames'
import Fuse from 'fuse.js'
import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

import TinyTextField from './TinyTextField'

// Number of items, when we show search text field
const TEXT_FIELD_VISIBLE_THRESHOLD = 8

// Number of items, above which we collapse
const SHOW_MORE_THRESHOLD = 6

function fuzzySearchExtents(extents: string[], searchStr: string): string[] {
  if (!searchStr) return extents
  const fuse = new Fuse(extents, { includeScore: true })
  return fuse
    .search(searchStr)
    .sort((a, b) => (a.score || Infinity) - (b.score || Infinity))
    .map(({ item }) => item)
}

const useMoreButtonStyles = M.makeStyles({
  root: {
    alignSelf: 'flex-start',
  },
  title: {
    paddingLeft: '3px',
  },
})

interface MoreButtonProps extends M.ButtonProps {
  reverse?: boolean
}

function MoreButton({ reverse, ...props }: MoreButtonProps) {
  const classes = useMoreButtonStyles()
  return (
    <M.Button
      className={classes.root}
      size="small"
      startIcon={<M.Icon>{reverse ? 'expand_less' : 'expand_more'}</M.Icon>}
      {...props}
    >
      <span className={classes.title}>{reverse ? 'Show less' : 'Show more'}</span>
    </M.Button>
  )
}

const useStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
  },
  checkbox: {
    marginLeft: '-2px',
    padding: t.spacing(0.5),
  },
  filter: {
    background: t.palette.background.paper,
    borderRadius: t.shape.borderRadius,
  },
  icon: {
    minHeight: t.spacing(4),
    minWidth: t.spacing(4),
  },
  hasMore: {
    paddingBottom: t.spacing(0.5),
  },
  help: {
    marginTop: t.spacing(1),
  },
  label: {
    cursor: 'pointer',
    display: 'block',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  listItem: {
    animation: `$showTop 150ms ease-out`,
  },
  '@keyframes showTop': {
    '0%': {
      transform: 'translateY(-2px)',
    },
    '100%': {
      transform: 'translateY(0)',
    },
  },
}))

interface ListProps {
  className?: string
  expandThreshold?: number
  extents: readonly string[]
  onChange: (v: string[]) => void
  placeholder?: string
  searchThreshold?: number
  value: string[]
}

export default function List({
  className,
  expandThreshold = SHOW_MORE_THRESHOLD,
  extents: rawExtents,
  onChange,
  placeholder,
  searchThreshold = TEXT_FIELD_VISIBLE_THRESHOLD,
  value,
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
  const [expanded, setExpanded] = React.useState(false)
  const displayedExtents = React.useMemo(
    () => (expanded ? filteredExtents : filteredExtents.slice(0, expandThreshold)),
    [expanded, filteredExtents, expandThreshold],
  )
  const handleChange = React.useCallback(
    (extent, checked) => {
      const newValue = checked ? [...value, extent] : value.filter((v) => v !== extent)
      onChange(newValue)
    },
    [onChange, value],
  )
  const hiddenNumber = extents.length - filteredExtents.length
  const showMore = filteredExtents.length > expandThreshold
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
      <M.List
        className={cx({ [classes.hasMore]: showMore })}
        dense
        disablePadding={extents.length <= searchThreshold}
      >
        {extents.length ? (
          displayedExtents.map((extent) => (
            <M.ListItem disableGutters key={extent} className={classes.listItem} button>
              <M.ListItemIcon className={classes.icon}>
                <M.Checkbox
                  className={classes.checkbox}
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
            <M.ListItemIcon className={classes.icon}>
              <M.Icon fontSize="small">not_interested</M.Icon>
            </M.ListItemIcon>
            <M.ListItemText primary={<i>No available items</i>} />
          </M.ListItem>
        )}
      </M.List>
      {showMore && (
        <MoreButton reverse={expanded} onClick={() => setExpanded((x) => !x)} />
      )}
      {!!hiddenNumber && (
        <M.Typography variant="caption" className={classes.help}>
          {filteredExtents.length
            ? `There are ${hiddenNumber} more items available. Loosen search query to see more.`
            : `${hiddenNumber} available items are hidden. Clear filters to see them.`}
        </M.Typography>
      )}
    </div>
  )
}
