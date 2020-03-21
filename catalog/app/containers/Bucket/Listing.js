import * as R from 'ramda'
import * as React from 'react'
import { Link } from 'react-router-dom'
import * as M from '@material-ui/core'

import * as Pagination from 'components/Pagination'
import { readableBytes } from 'utils/string'
import tagged from 'utils/tagged'

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
    background: t.palette.grey[100],
    display: 'flex',
    flexWrap: 'wrap',
    padding: t.spacing(1),
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

function Stats({ items, truncated }) {
  const classes = useStatsStyles()
  const stats = React.useMemo(() => computeStats(items), [items])
  return (
    <div className={classes.root}>
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
      <span className={classes.spacer} />
      {!!stats.modified && <span>Last modified {stats.modified.toLocaleString()}</span>}
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

  const pagination = Pagination.use(items, { perPage: 25, onChange: scroll })

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
            <Stats items={items} truncated={truncated} />
            <div ref={scrollRef} />
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
