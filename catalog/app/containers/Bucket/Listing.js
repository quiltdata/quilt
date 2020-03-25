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
    padding: t.spacing(1),
  },
  input: {
    fontSize: 14,
    height: 20,
    lineHeight: 20,
    padding: 0,
  },
  clear: {
    left: 'calc(100% - 4px)',
    position: 'absolute',
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

function Stats({ items, filtering, truncated }) {
  const classes = useStatsStyles()
  const stats = React.useMemo(() => computeStats(items), [items])
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

  return (
    <div className={classes.root}>
      <M.InputBase
        {...filtering.input}
        onKeyDown={handleKeyDown}
        placeholder="Filter files and directories"
        classes={{ input: classes.input }}
        inputComponent={WrappedAutosizeInput}
        inputRef={inputRef}
        startAdornment={<M.Icon className={classes.searchIcon}>search</M.Icon>}
        endAdornment={
          !!filtering.input.value && (
            <M.IconButton
              className={classes.clear}
              size="small"
              onClick={() => filtering.set('')}
            >
              <M.Icon fontSize="small">clear</M.Icon>
            </M.IconButton>
          )
        }
      />
      <span className={classes.spacer} />
      <span>{stats.dirs} folders</span>
      <span className={classes.divider}> | </span>
      <span>
        {truncated && '> '}
        {stats.files} files
      </span>
      <span className={classes.divider}> | </span>
      <span>
        {truncated && '> '}
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

export default function Listing({ items, truncated = false, locked = false }) {
  const classes = useListingStyles()

  const scrollRef = React.useRef(null)
  const scroll = React.useCallback((prev) => {
    if (prev && scrollRef.current) scrollRef.current.scrollIntoView()
  })

  const filtering = useDebouncedInput('', 200)
  const filtered = React.useMemo(
    () =>
      filtering.value
        ? items.filter(
            R.pipe(
              ListingItem.case({
                Dir: R.prop('name'),
                File: R.prop('name'),
              }),
              (name) => name.toLowerCase().includes(filtering.value.toLowerCase()),
            ),
          )
        : items,
    [filtering.value, items],
  )

  usePrevious(items, (prevItems) => {
    if (!R.equals(items, prevItems)) {
      filtering.set('')
    }
  })

  const pagination = Pagination.use(filtered, { perPage: 25, onChange: scroll })

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
            <Stats items={filtered} filtering={filtering} truncated={truncated} />
            <div ref={scrollRef} />
            {!filtered.length && (
              <div className={classes.noMatch}>
                No entries matching <b>&quot;{filtering.value}&quot;</b>
              </div>
            )}
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
            {pagination.pages > 1 && (
              <M.Box>
                <M.Divider />
                <M.Box display="flex" justifyContent="flex-end" px={1} py={0.25}>
                  <Pagination.Controls {...pagination} />
                </M.Box>
              </M.Box>
            )}
          </>
        )}
      </M.CardContent>
    </M.Card>
  )
}
