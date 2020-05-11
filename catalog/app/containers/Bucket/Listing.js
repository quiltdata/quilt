import * as R from 'ramda'
import * as React from 'react'
import AutosizeInput from 'react-input-autosize'
import { Link } from 'react-router-dom'
import * as M from '@material-ui/core'

import * as Pagination from 'components/Pagination'
import { readableBytes } from 'utils/string'
import tagged from 'utils/tagged'
import useDebouncedInput from 'utils/useDebouncedInput'
import usePrevious from 'utils/usePrevious'

function WrappedAutosizeInput({ className, ...props }) {
  return <AutosizeInput inputClassName={className} {...props} />
}

export const ListingItem = tagged([
  'Dir', // { name, to }
  'File', // { name, to, size, modified }
])

const useItemStyles = M.makeStyles((t) => ({
  root: {
    flexWrap: 'wrap',
    fontSize: 14, // TODO: use existing definition
    justifyContent: 'space-between',
    padding: t.spacing(1),
    '&:hover': {
      background: t.palette.action.hover,
    },
  },
  name: {
    alignItems: 'center',
    display: 'flex',
  },
  info: {
    display: 'flex',
  },
  icon: {
    fontSize: 16, // TODO: use predefined font-size
    marginRight: t.spacing(0.5),
  },
}))

function Item({ name, to, icon, children, ...props }) {
  const classes = useItemStyles()
  return (
    <M.ListItem component={Link} to={to} className={classes.root} {...props}>
      <div className={classes.name}>
        {!!icon && <M.Icon className={classes.icon}>{icon}</M.Icon>}
        {name}
      </div>
      <div className={classes.info}>{children}</div>
    </M.ListItem>
  )
}

const computeStats = R.reduce(
  ListingItem.reducer({
    File: (file) =>
      R.evolve({
        files: R.inc,
        size: R.add(file.size),
        modified: R.max(file.modified),
      }),
    Dir: ({ name }) => (name === '..' ? R.identity : R.evolve({ dirs: R.inc })),
  }),
  {
    dirs: 0,
    files: 0,
    size: 0,
    modified: 0,
  },
)

const useStatsStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'center',
    borderBottom: `1px solid ${t.palette.divider}`,
    display: 'flex',
    flexWrap: 'wrap',
    minHeight: 37,
    padding: [[2, t.spacing(1)]],
  },
  input: {
    fontSize: 14,
    height: 20,
    lineHeight: 20,
    padding: 0,
  },
  checkbox: {
    marginBottom: -9,
    marginRight: -5,
    marginTop: -9,
  },
  checkboxLabel: {
    ...t.typography.body2,
  },
  clear: {
    fontSize: 11,
    lineHeight: '22px',
    paddingBottom: 0,
    paddingTop: 2,
  },
  clearIcon: {
    fontSize: '16px !important',
    lineHeight: '15px',
    marginLeft: -4,
  },
  searchIcon: {
    fontSize: 20,
    marginLeft: -2,
    marginRight: t.spacing(0.5) - 2,
  },
  divider: {
    color: t.palette.text.hint,
    marginLeft: t.spacing(1),
    marginRight: t.spacing(1),
  },
  truncated: {
    color: t.palette.text.secondary,
    marginLeft: t.spacing(1),
  },
  spacer: {
    flexGrow: 1,
  },
}))

function Stats({ items, unfiltered, filtering, truncated, useRE, setUseRE }) {
  const classes = useStatsStyles()
  const stats = React.useMemo(() => computeStats(unfiltered), [unfiltered])
  const filteredStats = React.useMemo(() => computeStats(items), [items])
  const inputRef = React.useRef()
  const handleKeyDown = React.useCallback(
    (e) => {
      if (e.key === 'Escape') {
        filtering.set('')
        if (inputRef.current && inputRef.current.blur) inputRef.current.blur()
      }
    },
    [filtering.set, inputRef],
  )
  const handleToggleRE = React.useCallback(
    (e) => {
      setUseRE(e.target.checked)
    },
    [setUseRE],
  )

  return (
    <div className={classes.root}>
      <M.InputBase
        {...filtering.input}
        onKeyDown={handleKeyDown}
        placeholder="Filter current directory"
        classes={{ input: classes.input }}
        inputComponent={WrappedAutosizeInput}
        inputRef={inputRef}
        startAdornment={<M.Icon className={classes.searchIcon}>search</M.Icon>}
        endAdornment={
          <>
            <M.FormControlLabel
              style={{ marginLeft: 0 }}
              classes={{ label: classes.checkboxLabel }}
              control={
                <M.Checkbox
                  checked={useRE}
                  onChange={handleToggleRE}
                  color="primary"
                  size="small"
                  className={classes.checkbox}
                />
              }
              label="regex"
            />
            {!!filtering.input.value && (
              <M.Button
                className={classes.clear}
                size="small"
                variant="contained"
                color="primary"
                onClick={() => filtering.set('')}
                endIcon={<M.Icon className={classes.clearIcon}>clear</M.Icon>}
              >
                Clear filter
              </M.Button>
            )}
          </>
        }
      />
      <span className={classes.spacer} />
      <span>
        {!!filtering.value && <>{filteredStats.dirs} / </>}
        {stats.dirs} folders
      </span>
      <span className={classes.divider}> | </span>
      <span>
        {!!filtering.value && <>{filteredStats.files} / </>}
        {stats.files} files
      </span>
      <span className={classes.divider}> | </span>
      <span>
        {!!filtering.value && <>{readableBytes(filteredStats.size)} / </>}
        {readableBytes(stats.size)}
      </span>
      {truncated && <span className={classes.truncated}>(truncated)</span>}
      {!!stats.modified && (
        <>
          <span className={classes.divider}> | </span>
          <span>Last modified {stats.modified.toLocaleString()}</span>
        </>
      )}
    </div>
  )
}

const useListingStyles = M.makeStyles((t) => ({
  root: {
    minHeight: 40 + t.spacing(4), // for spinner
    padding: '0 !important',
    position: 'relative',
  },
  lock: {
    alignItems: 'center',
    background: t.palette.common.white,
    display: 'flex',
    height: '100%',
    justifyContent: 'center',
    left: 0,
    opacity: 0.5,
    padding: t.spacing(2),
    position: 'absolute',
    top: 0,
    width: '100%',
    zIndex: 1,
  },
  empty: {
    marginLeft: t.spacing(2),
    paddingTop: t.spacing(2.5),
  },
  noMatch: {
    ...t.typography.body2,
    padding: t.spacing(1),
  },
  size: {
    textAlign: 'right',
    width: '6em',
  },
  modified: {
    textAlign: 'right',
    width: '12em',
  },
}))

export default function Listing({ items, truncated = false, locked = false, loadMore }) {
  const classes = useListingStyles()

  const scrollRef = React.useRef(null)
  const scroll = React.useCallback((prev) => {
    if (prev && scrollRef.current) scrollRef.current.scrollIntoView()
  })

  const [useRE, setUseRE] = React.useState(false)
  const filtering = useDebouncedInput('', 200)
  const filtered = React.useMemo(
    R.tryCatch(
      R.pipe(
        () =>
          filtering.value
            ? items.filter(
                R.pipe(
                  ListingItem.case({
                    Dir: R.prop('name'),
                    File: R.prop('name'),
                  }),
                  R.toLower,
                  useRE
                    ? R.test(new RegExp(filtering.value, 'i'))
                    : R.includes(filtering.value.toLowerCase()),
                ),
              )
            : items,
        R.objOf('result'),
      ),
      (err) => ({ result: [], err }),
    ),
    [filtering.value, items, useRE],
  )

  const totalItems = React.useMemo(() => {
    const stats = computeStats(items)
    return stats.dirs + stats.files
  }, [items])

  usePrevious(items, (prevItems) => {
    if (R.is(Array, items) && R.is(Array, prevItems) && !R.startsWith(prevItems, items)) {
      filtering.set('')
    }
  })

  const pagination = Pagination.use(filtered.result, { perPage: 25, onChange: scroll })

  return (
    <M.Card>
      <M.CardContent className={classes.root}>
        {locked && (
          <div className={classes.lock}>
            <M.CircularProgress />
          </div>
        )}
        {!items.length ? (
          <M.Typography className={classes.empty} variant="h5">
            No files
          </M.Typography>
        ) : (
          <>
            <Stats
              items={filtered.result}
              unfiltered={items}
              filtering={filtering}
              truncated={truncated}
              useRE={useRE}
              setUseRE={setUseRE}
            />
            <div ref={scrollRef} />
            {!filtered.result.length &&
              (filtered.err ? (
                <div className={classes.noMatch}>{filtered.err.message}</div>
              ) : (
                <div className={classes.noMatch}>
                  No entries matching{' '}
                  <b>
                    <code>
                      {useRE ? `/${filtering.value}/i` : `"${filtering.value}"`}
                    </code>
                  </b>
                  {truncated && !!loadMore && (
                    <> &rarr; try loading more items (button below)</>
                  )}
                </div>
              ))}
            {pagination.paginated.map(
              ListingItem.case({
                Dir: ({ name, to }) => (
                  <Item icon="folder_open" key={name} name={name} to={to} />
                ),
                File: ({ name, to, size, modified }) => (
                  <Item icon="insert_drive_file" key={name} name={name} to={to}>
                    <div className={classes.size}>{readableBytes(size)}</div>
                    {!!modified && (
                      <div className={classes.modified}>{modified.toLocaleString()}</div>
                    )}
                  </Item>
                ),
              }),
            )}
            {(truncated || pagination.pages > 1) && (
              <M.Box>
                <M.Divider />
                <M.Box display="flex" alignItems="center" minHeight={36} px={1}>
                  {truncated && (
                    <M.Typography variant="body2" component="span" color="textSecondary">
                      <M.Icon
                        style={{
                          fontSize: 16,
                          verticalAlign: 'text-bottom',
                          marginRight: 4,
                        }}
                      >
                        warning
                      </M.Icon>
                      Results truncated to {totalItems} items
                      {!!loadMore && (
                        <>
                          <> &rarr; </>
                          <M.Link
                            onClick={loadMore}
                            component="button"
                            underline="always"
                            style={{ verticalAlign: 'baseline' }}
                          >
                            load more
                          </M.Link>
                        </>
                      )}
                    </M.Typography>
                  )}
                  <M.Box flexGrow={1} />
                  {pagination.pages > 1 && <Pagination.Controls {...pagination} />}
                </M.Box>
              </M.Box>
            )}
          </>
        )}
      </M.CardContent>
    </M.Card>
  )
}
