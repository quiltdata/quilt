import { basename, join } from 'path'

import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

import type * as DG from 'components/DataGrid'
import type * as Model from 'model'
import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink from 'utils/StyledLink'
import * as s3paths from 'utils/s3paths'

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

export interface SelectionHandles {
  [prefixUrl: string]: Model.S3.S3ObjectLocation[]
}

const EMPTY_SELECTION_HANDLES: SelectionHandles = {}

function useSelectionHandles(selection: Selection): SelectionHandles {
  return React.useMemo(
    () =>
      Object.entries(selection).reduce((memo, [prefixUrl, keys]) => {
        const parentHandle = s3paths.parseS3Url(prefixUrl)
        return {
          ...memo,
          [prefixUrl]: keys.map((id) => {
            const key = join(parentHandle.key, id.toString())
            return {
              bucket: parentHandle.bucket,
              key,
            }
          }),
        }
      }, EMPTY_SELECTION_HANDLES),
    [selection],
  )
}

export interface SelectedItem {
  handle: Model.S3.S3ObjectLocation
  prefix: string
}

export interface Selection {
  [prefixUrl: string]: DG.GridRowId[]
}

interface ListItemProps {
  handle: Model.S3.S3ObjectLocation
  className: string
  onClear: () => void
}

function ListItem({ className, handle, onClear }: ListItemProps) {
  const isDir = s3paths.isDir(handle.key)
  const { urls } = NamedRoutes.use()
  const url = isDir
    ? urls.bucketDir(handle.bucket, handle.key)
    : urls.bucketFile(handle.bucket, handle.key)
  const name = isDir ? s3paths.ensureSlash(basename(handle.key)) : basename(handle.key)
  return (
    <M.ListItem className={className}>
      <M.ListItemIcon>
        <M.Icon>{isDir ? 'folder_outlined' : 'insert_drive_file_outlined'}</M.Icon>
      </M.ListItemIcon>
      <M.ListItemText
        primary={name}
        secondary={<StyledLink to={url}>{s3paths.handleToS3Url(handle)}</StyledLink>}
      />
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

interface SelectionDashboardProps {
  onBookmarks?: (handles: Model.S3.S3ObjectLocation[]) => void
  onSelection: (changed: Selection) => void
  selection: Selection
}

export function SelectionDashboard({
  onBookmarks,
  onSelection,
  selection,
}: SelectionDashboardProps) {
  const classes = useStyles()
  const lists = useSelectionHandles(selection)
  const hasSelection = Object.values(selection).some((ids) => !!ids.length, 0)

  const handleBookmarks = React.useCallback(() => {
    if (!onBookmarks) return
    const handles = Object.values(lists).reduce((memo, hs) => [...memo, ...hs], [])
    onBookmarks(handles)
  }, [lists, onBookmarks])

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
          onClick={() => onSelection({})}
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
                        handle={handle}
                        className={classes.item}
                        onClear={() =>
                          onSelection(R.dissocPath([prefixUrl, index], selection))
                        }
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
