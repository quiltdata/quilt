import cx from 'classnames'
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

const EMPTY = <i>{'<EMPTY>'}</i>

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
  archived: {
    opacity: 0.5,
  },
  info: {
    display: 'flex',
  },
  icon: {
    fontSize: 16, // TODO: use predefined font-size
    marginRight: t.spacing(0.5),
  },
}))

function Item({ name, to, icon, children, archived, ...props }) {
  const classes = useItemStyles()
  return (
    <M.ListItem
      component={Link}
      to={to}
      className={classes.root}
      title={archived ? 'Object archived' : undefined}
      {...props}
    >
      <div className={cx(classes.name, archived && classes.archived)}>
        {!!icon && <M.Icon className={classes.icon}>{icon}</M.Icon>}
        {name}
      </div>
      <div className={cx(classes.info, archived && classes.archived)}>{children}</div>
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

const useHeaderStyles = M.makeStyles((t) => ({
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
  btn: {
    fontSize: 11,
    lineHeight: '22px',
    minWidth: 'auto',
    paddingBottom: 0,
    paddingTop: 2,
  },
  btnMargin: {
    marginLeft: t.spacing(0.75),
  },
  clearIcon: {
    fontSize: '16px !important',
    lineHeight: '15px',
    marginLeft: -4,
  },
  clearIconText: {
    fontSize: '16px !important',
    lineHeight: '15px',
    marginLeft: -6,
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

function HeaderWithPrefixFiltering({ items, truncated, prefix, setPrefix }) {
  const classes = useHeaderStyles()
  const stats = React.useMemo(() => computeStats(items), [items])
  const inputRef = React.useRef()
  const [prefixValue, setPrefixValue] = React.useState(prefix)

  const blur = React.useCallback(() => {
    if (inputRef.current && inputRef.current.blur) inputRef.current.blur()
  }, [inputRef])

  const apply = React.useCallback(() => {
    if (prefix === prefixValue) return
    setPrefix(prefixValue)
  }, [prefix, prefixValue, setPrefix])

  const clear = React.useCallback(() => {
    if (prefixValue) setPrefixValue('')
    if (prefix) setPrefix('')
  }, [prefix, prefixValue, setPrefix, setPrefixValue])

  const handleKeyDown = React.useCallback(
    (e) => {
      if (e.key === 'Escape') {
        clear()
        blur()
      } else if (e.key === 'Enter') {
        apply()
        blur()
      }
    },
    [blur, apply, clear],
  )

  const handleChange = React.useCallback(
    (e) => {
      setPrefixValue(e.target.value)
    },
    [setPrefixValue],
  )

  return (
    <div className={classes.root}>
      <M.InputBase
        value={prefixValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Filter current directory by prefix"
        classes={{ input: classes.input }}
        inputComponent={WrappedAutosizeInput}
        inputRef={inputRef}
        startAdornment={<M.Icon className={classes.searchIcon}>search</M.Icon>}
        endAdornment={
          <>
            <M.Button
              className={cx(classes.btn, classes.btnMargin)}
              size="small"
              variant="contained"
              color="primary"
              onClick={apply}
            >
              Filter
            </M.Button>
            {(!!prefixValue || !!prefix) && (
              <M.Button
                className={cx(classes.btn, classes.btnMargin)}
                size="small"
                variant="text"
                color="primary"
                onClick={clear}
                endIcon={<M.Icon className={classes.clearIconText}>clear</M.Icon>}
              >
                Clear
              </M.Button>
            )}
          </>
        }
      />
      <span className={classes.spacer} />
      <span>{stats.dirs} folders</span>
      <span className={classes.divider}> | </span>
      <span>{stats.files} files</span>
      <span className={classes.divider}> | </span>
      <span>{readableBytes(stats.size)}</span>
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

function HeaderWithLocalFiltering({
  items,
  unfiltered,
  filtering,
  truncated,
  useRE,
  setUseRE,
}) {
  const classes = useHeaderStyles()
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
                className={classes.btn}
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

export function ListingWithPrefixFiltering({
  items,
  truncated = false,
  locked = false,
  prefix = '',
  setPrefix,
  bucket,
  path,
}) {
  const classes = useListingStyles()

  const scrollRef = React.useRef(null)
  const scroll = React.useCallback(
    (prev) => {
      if (prev && scrollRef.current) scrollRef.current.scrollIntoView()
    },
    [scrollRef],
  )

  const totalItems = React.useMemo(() => {
    const stats = computeStats(items)
    return stats.dirs + stats.files
  }, [items])

  const pagination = Pagination.use(items, { perPage: 25, onChange: scroll })

  return (
    <M.Card>
      <M.CardContent className={classes.root}>
        {locked && (
          <div className={classes.lock}>
            <M.CircularProgress />
          </div>
        )}
        {!items.length && !prefix ? (
          <M.Typography className={classes.empty} variant="h5">
            No files
          </M.Typography>
        ) : (
          <>
            <HeaderWithPrefixFiltering
              key={`${bucket}/${path}`}
              {...{ items, truncated, prefix, setPrefix }}
            />
            <div ref={scrollRef} />
            {!items.length && (
              <div className={classes.noMatch}>
                No entries starting with{' '}
                <b>
                  <code>{`"${prefix}"`}</code>
                </b>
              </div>
            )}
            {pagination.paginated.map(
              ListingItem.case({
                Dir: ({ name, to }) => (
                  <Item icon="folder_open" key={name} name={name || EMPTY} to={to} />
                ),
                File: ({ name, to, size, modified, archived }) => (
                  <Item
                    icon="insert_drive_file"
                    key={name}
                    name={name}
                    to={to}
                    archived={archived}
                  >
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

export function ListingWithLocalFiltering({ items, truncated = false, locked = false }) {
  const classes = useListingStyles()

  const scrollRef = React.useRef(null)
  const scroll = React.useCallback(
    (prev) => {
      if (prev && scrollRef.current) scrollRef.current.scrollIntoView()
    },
    [scrollRef],
  )

  const [useRE, setUseRE] = React.useState(true)
  const filtering = useDebouncedInput('', 200)
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
            <HeaderWithLocalFiltering
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
                </div>
              ))}
            {pagination.paginated.map(
              ListingItem.case({
                Dir: ({ name, to }) => (
                  <Item icon="folder_open" key={name} name={name || EMPTY} to={to} />
                ),
                File: ({ name, to, size, modified, archived }) => (
                  <Item
                    icon="insert_drive_file"
                    key={name}
                    name={name}
                    to={to}
                    archived={archived}
                  >
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
