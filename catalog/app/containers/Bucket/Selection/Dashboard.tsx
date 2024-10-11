import { basename } from 'path'

import cx from 'classnames'
import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

import * as Buttons from 'components/Buttons'
import * as Bookmarks from 'containers/Bookmarks/Provider'
import type * as Model from 'model'
import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink from 'utils/StyledLink'
import type { PackageHandle } from 'utils/packageHandle'
import * as s3paths from 'utils/s3paths'

import * as FileView from '../FileView'

import { EMPTY_MAP, ListingSelection, toHandlesMap, toHandlesList } from './utils'

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
  root: {
    whiteSpace: 'nowrap',
    '&:hover $link': {
      display: 'inline',
    },
  },
  name: {
    flexGrow: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  link: {
    display: 'none',
    marginLeft: t.spacing(1),
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  icon: {
    minWidth: t.spacing(5),
  },
  action: {
    right: 0, // https://github.com/mui/material-ui/issues/21722
  },
}))

interface ListItemProps {
  handle: Model.S3.S3ObjectLocation
  className: string
  onClear: () => void
}

function ListItem({ className, handle, onClear }: ListItemProps) {
  const classes = useListItemStyles()
  const isDir = s3paths.isDir(handle.key)
  const { urls } = NamedRoutes.use()
  const url = isDir
    ? urls.bucketDir(handle.bucket, handle.key)
    : urls.bucketFile(handle.bucket, handle.key)
  const name = isDir ? s3paths.ensureSlash(basename(handle.key)) : basename(handle.key)

  const bookmarks = Bookmarks.use()
  const isBookmarked = bookmarks?.isBookmarked('main', handle)
  const toggleBookmark = () => bookmarks?.toggle('main', handle)
  return (
    <M.ListItem className={cx(classes.root, className)} disableGutters>
      <M.ListItemIcon className={classes.icon}>
        {bookmarks && (
          <M.IconButton size="small" onClick={toggleBookmark}>
            <M.Icon fontSize="small">
              {isBookmarked ? 'turned_in' : 'turned_in_not'}
            </M.Icon>
          </M.IconButton>
        )}
      </M.ListItemIcon>
      <M.ListItemIcon className={classes.icon}>
        <M.Icon fontSize="small">{isDir ? 'folder_open' : 'insert_drive_file'}</M.Icon>
      </M.ListItemIcon>
      <span className={classes.name}>{name}</span>
      <StyledLink className={classes.link} to={url}>
        {decodeURIComponent(s3paths.handleToS3Url(handle))}
      </StyledLink>
      <M.ListItemSecondaryAction className={classes.action}>
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
  },
  buttons: {
    display: 'flex',
  },
  button: {
    '& + &': {
      marginLeft: t.spacing(1),
    },
  },
  divider: {
    marginTop: t.spacing(2),
  },
  list: {
    background: t.palette.background.paper,
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
  onClose: () => void
  onSelection: (changed: ListingSelection) => void
  selection: ListingSelection
  packageHandle?: PackageHandle
}

export default function Dashboard({
  onClose,
  onSelection,
  selection,
  packageHandle,
}: DashboardProps) {
  const classes = useStyles()
  const lists = React.useMemo(() => toHandlesMap(selection), [selection])
  const hasSelection = Object.values(selection).some((ids) => !!ids.length)

  const bookmarksCtx = Bookmarks.use()
  const bookmarks = React.useMemo(
    () => !packageHandle && bookmarksCtx,
    [packageHandle, bookmarksCtx],
  )
  const hasSomethingToBookmark = React.useMemo(
    () =>
      bookmarks &&
      Object.values(lists).some((hs) =>
        hs.some((h) => !bookmarks.isBookmarked('main', h)),
      ),
    [bookmarks, lists],
  )
  const handleBookmarks = React.useCallback(() => {
    if (!bookmarks) return
    const handles = Object.values(lists).reduce((memo, hs) => [...memo, ...hs], [])
    if (hasSomethingToBookmark) {
      bookmarks.append('main', handles)
    } else {
      bookmarks.remove('main', handles)
    }
  }, [hasSomethingToBookmark, lists, bookmarks])

  const handleClear = React.useCallback(() => {
    onSelection(EMPTY_MAP)
    onClose()
  }, [onSelection, onClose])

  const handleRemove = React.useCallback(
    (prefixUrl: string, index: number) => {
      const newSelection = R.dissocPath<ListingSelection>([prefixUrl, index], selection)
      onSelection(newSelection)
      if (!Object.values(newSelection).some((ids) => !!ids.length)) {
        onClose()
      }
    },
    [onClose, onSelection, selection],
  )

  return (
    <div className={classes.root}>
      <div className={classes.buttons}>
        {bookmarks && (
          <M.Button
            className={classes.button}
            color="primary"
            disabled={!hasSelection}
            onClick={handleBookmarks}
            size="small"
            variant="outlined"
          >
            {hasSomethingToBookmark ? 'Add to bookmarks' : 'Remove from bookmarks'}
          </M.Button>
        )}
        {!!packageHandle && (
          <FileView.ZipDownloadForm
            suffix={`package/${packageHandle.bucket}/${packageHandle.name}/${packageHandle.hash}`}
            className={classes.button}
            files={toHandlesList(selection).map(({ key }) => key)}
          >
            <Buttons.Iconized label="Download selected" icon="archive" type="submit" />
          </FileView.ZipDownloadForm>
        )}
        <M.Button
          className={classes.button}
          color="primary"
          disabled={!hasSelection}
          onClick={handleClear}
          size="small"
          variant="outlined"
        >
          Clear selection
        </M.Button>
      </div>
      <M.Divider style={{ marginTop: '16px' }} />
      {hasSelection ? (
        <M.List dense disablePadding className={classes.list}>
          {Object.entries(lists).map(([prefixUrl, handles]) =>
            handles.length ? (
              <li className={classes.listSection} key={prefixUrl}>
                <ul className={classes.auxList}>
                  <M.ListSubheader disableGutters>{prefixUrl}</M.ListSubheader>
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
