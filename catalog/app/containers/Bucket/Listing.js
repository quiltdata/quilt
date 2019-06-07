import PT from 'prop-types'
import * as R from 'ramda'
import * as React from 'react'
import { Link } from 'react-router-dom'
import * as RC from 'recompose'
import {
  Box,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  Icon,
  ListItem,
  Typography,
} from '@material-ui/core'
import { withStyles } from '@material-ui/styles'

import * as Pagination from 'components/Pagination'
import { composeComponent } from 'utils/reactTools'
import { readableBytes } from 'utils/string'
import tagged from 'utils/tagged'

export const ListingItem = tagged([
  'Dir', // { name, to }
  'File', // { name, to, size, modified }
])

const Item = composeComponent(
  'Bucket.Listing.Item',
  RC.setPropTypes({
    icon: PT.string,
    name: PT.string.isRequired,
    to: PT.string.isRequired,
    children: PT.node,
  }),
  withStyles(({ spacing: { unit }, palette }) => ({
    root: {
      flexWrap: 'wrap',
      fontSize: 14, // TODO: use existing definition
      justifyContent: 'space-between',
      padding: unit,
      '&:hover': {
        background: palette.action.hover,
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
      marginRight: 0.5 * unit,
    },
  })),
  // eslint-disable-next-line object-curly-newline
  ({ classes, name, to, icon, children, ...props }) => (
    <ListItem component={Link} to={to} className={classes.root} {...props}>
      <div className={classes.name}>
        {!!icon && <Icon className={classes.icon}>{icon}</Icon>}
        {name}
      </div>
      <div className={classes.info}>{children}</div>
    </ListItem>
  ),
)

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

const Stats = composeComponent(
  'Bucket.Listing.Stats',
  RC.setPropTypes({
    items: PT.array.isRequired,
    truncated: PT.bool.isRequired,
  }),
  withStyles(({ palette, spacing: { unit } }) => ({
    root: {
      background: palette.grey[100],
      display: 'flex',
      flexWrap: 'wrap',
      padding: unit,
    },
    divider: {
      color: palette.text.hint,
      marginLeft: unit,
      marginRight: unit,
    },
    truncated: {
      color: palette.text.secondary,
      marginLeft: unit,
    },
    spacer: {
      flexGrow: 1,
    },
  })),
  ({ classes, items, truncated }) => {
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
  },
)

export default composeComponent(
  'Bucket.Listing',
  RC.setPropTypes({
    // Array of ListingItems
    items: PT.array.isRequired,
    locked: PT.bool,
    truncated: PT.bool,
  }),
  withStyles(({ spacing: { unit }, palette }) => ({
    root: {
      minHeight: 40 + 4 * unit, // for spinner
      padding: '0 !important',
      position: 'relative',
    },
    lock: {
      alignItems: 'center',
      background: palette.common.white,
      display: 'flex',
      height: '100%',
      justifyContent: 'center',
      left: 0,
      opacity: 0.5,
      padding: 2 * unit,
      position: 'absolute',
      top: 0,
      width: '100%',
      zIndex: 1,
    },
    empty: {
      marginLeft: 2 * unit,
      paddingTop: 2.5 * unit,
    },
    size: {
      textAlign: 'right',
      width: '6em',
    },
    modified: {
      textAlign: 'right',
      width: '12em',
    },
  })),
  ({ classes, items, truncated = false, locked = false }) => {
    const scrollRef = React.useRef(null)
    const scroll = React.useCallback((prev) => {
      if (prev && scrollRef.current) scrollRef.current.scrollIntoView()
    })

    const pagination = Pagination.use(items, { perPage: 25, onChange: scroll })

    return (
      <Card>
        <CardContent className={classes.root}>
          {locked && (
            <div className={classes.lock}>
              <CircularProgress />
            </div>
          )}
          {!items.length ? (
            <Typography className={classes.empty} variant="h5">
              No files
            </Typography>
          ) : (
            <React.Fragment>
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
                        <div className={classes.modified}>
                          {modified.toLocaleString()}
                        </div>
                      )}
                    </Item>
                  ),
                }),
              )}
              {pagination.pages > 1 && (
                <Box>
                  <Divider />
                  <Box display="flex" justifyContent="flex-end" px={1} py={0.25}>
                    <Pagination.Controls {...pagination} />
                  </Box>
                </Box>
              )}
            </React.Fragment>
          )}
        </CardContent>
      </Card>
    )
  },
)
