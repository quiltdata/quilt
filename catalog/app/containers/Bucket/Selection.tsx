import { basename, join } from 'path'

import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

import type * as DG from 'components/DataGrid'
import type * as Model from 'model'
import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink from 'utils/StyledLink'
import * as s3paths from 'utils/s3paths'
import type * as workflows from 'utils/workflows'

import * as Successors from './Successors'
import Section from './Section'

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

interface CreateButtonProps {
  className: string
  bucket: string
  disabled: boolean
  onSubmit: (s: workflows.Successor) => void
}

function CreateButton({ bucket, className, onSubmit, disabled }: CreateButtonProps) {
  const [menuAnchorEl, setMenuAnchorEl] = React.useState<HTMLElement | null>(null)
  return (
    <>
      <M.Button
        className={className}
        size="small"
        color="primary"
        variant="contained"
        disabled={disabled}
        onClick={(e) => setMenuAnchorEl(e.currentTarget)}
      >
        Create package
      </M.Button>
      <Successors.Select
        open={!!menuAnchorEl}
        anchorEl={menuAnchorEl}
        bucket={bucket}
        onChange={onSubmit}
        onClose={() => setMenuAnchorEl(null)}
      />
    </>
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

interface FavoriteButtonProps {
  className: string
  selection: Selection
  disabled: boolean
  onSubmit: (handles: Model.S3.S3ObjectLocation[]) => void
}

function FavoriteButton({
  className,
  selection,
  disabled,
  onSubmit,
}: FavoriteButtonProps) {
  const lists = useSelectionHandles(selection)
  const handles = Object.values(lists).reduce((memo, hs) => [...memo, ...hs], [])

  return (
    <M.Button
      className={className}
      size="small"
      color="primary"
      variant="outlined"
      disabled={disabled}
      onClick={() => onSubmit(handles)}
    >
      Add to bookmarks
    </M.Button>
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
  wrapper: {
    background: t.palette.background.paper,
    flexGrow: 1,
    maxHeight: '50vh',
    overflowY: 'auto',
  },
  button: {
    '& + &': {
      marginLeft: t.spacing(2),
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

interface SelectionSectionProps {
  bucket: string
  selection: Selection
  onSelection: (changed: Selection) => void
  onPackage?: (s: workflows.Successor) => void
  onBookmarks?: (handles: Model.S3.S3ObjectLocation[]) => void
}

export function SelectionSection({
  bucket,
  selection,
  onPackage,
  onSelection,
  onBookmarks,
}: SelectionSectionProps) {
  const classes = useStyles()
  const count = Object.values(selection).reduce((memo, ids) => memo + ids.length, 0)
  const lists = useSelectionHandles(selection)

  return (
    <Section gutterBottom heading={`${count} items selected`} icon="list">
      <div className={classes.wrapper}>
        <>
          {onPackage && (
            <CreateButton
              className={classes.button}
              bucket={bucket}
              onSubmit={onPackage}
              disabled={!count}
            />
          )}
          {onBookmarks && (
            <FavoriteButton
              className={classes.button}
              selection={selection}
              disabled={!count}
              onSubmit={onBookmarks}
            />
          )}
          <M.Divider style={{ marginTop: '16px' }} />
        </>
        {count ? (
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
    </Section>
  )
}
