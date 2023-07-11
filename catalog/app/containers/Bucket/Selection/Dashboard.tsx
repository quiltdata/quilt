import { basename } from 'path'

import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

import * as Bookmarks from 'containers/Bookmarks/Provider'
import type * as Model from 'model'
import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink from 'utils/StyledLink'
import * as s3paths from 'utils/s3paths'

import { EMPTY_MAP, PrefixedKeysMap, toHandlesMap } from './utils'

const useEmptyStateStyles = M.makeStyles((t) => ({
  root: {
    padding: t.spacing(3, 0, 2),
  },
}))

function EmptyState() {
  const classes = useEmptyStateStyles()
  return (
    <M.Typography className={classes.root} variant="h5">
      Nothing selected
    </M.Typography>
  )
}

const useListItemStyles = M.makeStyles((t) => ({
  icon: {
    minWidth: t.spacing(5),
  },
}))

interface ListItemProps {
  handle: Model.S3.S3ObjectLocation
  className: string
  onClear: () => void
}

function ListItem({ className, handle, onClear }: ListItemProps) {
  const classes = useListItemStyles()
  const bookmarks = Bookmarks.use()
  const isBookmarked = bookmarks?.isBookmarked('main', handle)
  const isDir = s3paths.isDir(handle.key)
  const { urls } = NamedRoutes.use()
  const url = isDir
    ? urls.bucketDir(handle.bucket, handle.key)
    : urls.bucketFile(handle.bucket, handle.key)
  const name = isDir ? s3paths.ensureSlash(basename(handle.key)) : basename(handle.key)
  return (
    <M.ListItem className={className}>
      <M.ListItemIcon className={classes.icon}>
        <M.Icon fontSize="small">{isBookmarked ? 'turned_in' : 'turned_in_not'}</M.Icon>
      </M.ListItemIcon>
      <M.ListItemIcon className={classes.icon}>
        <M.Icon fontSize="small">{isDir ? 'folder_open' : 'insert_drive_file'}</M.Icon>
      </M.ListItemIcon>
      <StyledLink to={url}>{name}</StyledLink>
      <M.ListItemSecondaryAction>
        <M.IconButton size="small" onClick={onClear}>
          <M.Icon fontSize="small">clear</M.Icon>
        </M.IconButton>
      </M.ListItemSecondaryAction>
    </M.ListItem>
  )
}

const useStyles = M.makeStyles((t) => ({
  root: {
    background: t.palette.background.paper,
    flexGrow: 1,
    maxHeight: '50vh',
    overflowY: 'auto',
  },
  button: {
    '& + &': {
      marginLeft: t.spacing(1),
    },
  },
  list: {
    background: t.palette.background.paper,
    flexGrow: 1,
    maxHeight: '50vh',
    overflowY: 'auto',
  },
  item: {
    '&:hover': {
      background: t.palette.action.hover,
    },
  },
  listSection: {
    background: 'inherit',
  },
  auxList: {
    background: 'inherit',
    padding: 0,
  },
}))

interface DashboardProps {
  onBookmarks?: (handles: Model.S3.S3ObjectLocation[]) => void
  onDone: () => void
  onSelection: (changed: PrefixedKeysMap) => void
  selection: PrefixedKeysMap
}

export default function Dashboard({
  onBookmarks,
  onDone,
  onSelection,
  selection,
}: DashboardProps) {
  const classes = useStyles()
  const lists = React.useMemo(() => toHandlesMap(selection), [selection])
  const hasSelection = Object.values(selection).some((ids) => !!ids.length)

  const handleBookmarks = React.useCallback(() => {
    if (!onBookmarks) return
    const handles = Object.values(lists).reduce((memo, hs) => [...memo, ...hs], [])
    onBookmarks(handles)
  }, [lists, onBookmarks])

  const handleClear = React.useCallback(() => {
    onSelection(EMPTY_MAP)
    onDone()
  }, [onSelection, onDone])

  const handleRemove = React.useCallback(
    (prefixUrl: string, index: number) => {
      const newSelection = R.dissocPath<PrefixedKeysMap>([prefixUrl, index], selection)
      onSelection(newSelection)
      if (!Object.values(newSelection).some((ids) => !!ids.length)) {
        onDone()
      }
    },
    [onDone, onSelection, selection],
  )

  return (
    <div className={classes.root}>
      <>
        {onBookmarks && (
          <M.Button
            className={classes.button}
            color="primary"
            disabled={!hasSelection}
            onClick={handleBookmarks}
            size="small"
            variant="outlined"
          >
            Add to bookmarks
          </M.Button>
        )}
        <M.Button
          className={classes.button}
          color="primary"
          disabled={!hasSelection}
          onClick={handleClear}
          size="small"
          variant="outlined"
        >
          Clear
        </M.Button>
        <M.Divider style={{ marginTop: '16px' }} />
      </>
      {hasSelection ? (
        <M.List dense disablePadding className={classes.list}>
          {Object.entries(lists).map(([prefixUrl, handles]) =>
            handles.length ? (
              <li className={classes.listSection} key={prefixUrl}>
                <ul className={classes.auxList}>
                  <M.ListSubheader>{prefixUrl}</M.ListSubheader>
                  <M.List dense disablePadding>
                    {handles.map((handle, index) => (
                      <ListItem
                        key={handle.key}
                        className={classes.item}
                        handle={handle}
                        onClear={() => handleRemove(prefixUrl, index)}
                      />
                    ))}
                  </M.List>
                </ul>
              </li>
            ) : null,
          )}
        </M.List>
      ) : (
        <EmptyState />
      )}
    </div>
  )
}
