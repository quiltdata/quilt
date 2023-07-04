import { join } from 'path'

import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

import type * as DG from 'components/DataGrid'
import type * as Model from 'model'
import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink from 'utils/StyledLink'
import * as s3paths from 'utils/s3paths'

import Section from './Section'
// import { useFilesListing } from './requests'

export interface SelectedItem {
  handle: Model.S3.S3ObjectLocation
  prefix: string
}

export interface Selection {
  [prefixUrl: string]: DG.GridRowId[]
}

interface ListItemProps {
  prefixUrl: string
  basename: string
  className: string
  onClear: () => void
}

function ListItem({ className, prefixUrl, basename, onClear }: ListItemProps) {
  const isDir = s3paths.isDir(basename)
  const { urls } = NamedRoutes.use()
  const parentHandle = s3paths.parseS3Url(prefixUrl)
  const path = join(parentHandle.key, basename.toString())
  const url = isDir
    ? urls.bucketDir(parentHandle.bucket, path)
    : urls.bucketFile(parentHandle.bucket, path)
  return (
    <M.ListItem className={className}>
      <M.ListItemIcon>
        <M.IconButton size="small">
          <M.Icon fontSize="small">favorite_outlined</M.Icon>
        </M.IconButton>
      </M.ListItemIcon>
      <M.ListItemText
        primary={basename}
        secondary={
          <StyledLink to={url}>{join(prefixUrl, basename.toString())}</StyledLink>
        }
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
  list: {
    background: t.palette.background.paper,
    flexGrow: 1,
    maxHeight: '50vh',
    overflowY: 'auto',
  },
  nested: {
    // marginLeft: t.spacing(2),
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
  selection: Selection
  onSelection: (changed: Selection) => void
}

export function SelectionSection({ selection, onSelection }: SelectionSectionProps) {
  const classes = useStyles()
  const count = Object.values(selection).reduce((memo, ids) => memo + ids.length, 0)
  // const getFiles = useFilesListing()
  // const test = React.useCallback(async () => {
  //   const handles = Object.entries(selection).reduce((memo, [prefixUrl, keys]) => {
  //     const parentHandle = s3paths.parseS3Url(prefixUrl)
  //     return [
  //       ...memo,
  //       ...keys.map((key) => ({
  //         bucket: parentHandle.bucket,
  //         key: join(parentHandle.key, key.toString()),
  //       })),
  //     ]
  //   }, [] as Model.S3.S3ObjectLocation[])
  //   const files = await getFiles(handles)
  //   console.log(files)
  // }, [selection])
  return (
    <Section
      disabled={!count}
      gutterBottom
      heading={`${count} items selected`}
      icon="list"
    >
      <M.List dense disablePadding className={classes.list}>
        {Object.entries(selection).map(([prefixUrl, keys]) =>
          keys.length ? (
            <li className={classes.listSection} key={prefixUrl}>
              <ul className={classes.auxList}>
                <M.ListSubheader>{prefixUrl}</M.ListSubheader>
                <M.List dense disablePadding className={classes.nested}>
                  {keys.map((key, index) => (
                    <ListItem
                      key={join(prefixUrl, key.toString())}
                      basename={key.toString()}
                      prefixUrl={prefixUrl}
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
    </Section>
  )
}
