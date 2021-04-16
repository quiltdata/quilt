import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'
import * as DG from '@material-ui/data-grid'

import { Crumb, render as renderCrumbs } from 'components/BreadCrumbs'
import AsyncResult from 'utils/AsyncResult'
import { useData } from 'utils/Data'
import { getBreadCrumbs, ensureNoSlash, withoutPrefix, up } from 'utils/s3paths'

import * as Listing from '../Listing'
import { displayError } from '../errors'
import * as requests from '../requests'

export interface S3File {
  bucket: string
  key: string
  version?: string
  size: number
}

export const isS3File = (f: any): f is S3File =>
  !!f &&
  typeof f === 'object' &&
  typeof f.bucket === 'string' &&
  typeof f.key === 'string' &&
  (typeof f.version === 'string' || typeof f.version === 'undefined') &&
  typeof f.size === 'number'

const getCrumbs = R.compose(
  R.intersperse(Crumb.Sep(<>&nbsp;/ </>)),
  ({ bucket, path }: { bucket: string; path: string }) =>
    [
      { label: bucket, path: '' },
      ...getBreadCrumbs(path),
    ].map(({ label, path: segPath }) =>
      Crumb.Segment({ label, to: segPath === path ? undefined : segPath }),
    ),
)

type MuiCloseReason = 'backdropClick' | 'escapeKeyDown'
export type CloseReason = MuiCloseReason | 'cancel' | { path: string; files: S3File[] }

const useStyles = M.makeStyles((t) => ({
  crumbs: {
    ...t.typography.body1,
    marginTop: -t.spacing(1),
    maxWidth: '100%',
    overflowWrap: 'break-word',
    paddingLeft: t.spacing(3),
    paddingRight: t.spacing(3),
  },
}))

interface DialogProps {
  bucket: string
  open: boolean
  onClose: (reason: CloseReason) => void
}

export function Dialog({ bucket, open, onClose }: DialogProps) {
  const cancel = React.useCallback(() => onClose('cancel'), [onClose])
  const handleClose = React.useCallback(
    (_e: {}, reason: MuiCloseReason) => onClose(reason),
    [onClose],
  )

  const classes = useStyles()

  const bucketListing = requests.useBucketListing()

  const [path, setPath] = React.useState('') // get relevant initial path?
  const [prefix, setPrefix] = React.useState('')
  const [prev, setPrev] = React.useState<requests.BucketListingResult | null>(null)
  const [selection, setSelection] = React.useState<DG.GridRowId[]>([])

  const crumbs = React.useMemo(() => getCrumbs({ bucket, path }), [bucket, path])

  const getCrumbLinkProps = ({ to }: { to: string }) => ({
    onClick: () => {
      setPath(to)
    },
  })

  React.useLayoutEffect(() => {
    // reset accumulated results when bucket, path and / or prefix change
    setPrev(null)
  }, [bucket, path, prefix])

  const data = useData(bucketListing, { bucket, path, prefix, prev })

  const loadMore = React.useCallback(() => {
    AsyncResult.case(
      {
        Ok: (res: requests.BucketListingResult) => {
          // this triggers a re-render and fetching of next page of results
          if (res.continuationToken) setPrev(res)
        },
        _: () => {},
      },
      data.result,
    )
  }, [data.result])

  const add = React.useCallback(() => {
    data.case({
      Ok: async (r: requests.BucketListingResult) => {
        // use path
        const dirsByBasename = R.fromPairs(
          r.dirs.map((name) => [ensureNoSlash(withoutPrefix(r.path, name)), name]),
        )
        const filesByBasename = R.fromPairs(
          r.files.map((f) => [withoutPrefix(r.path, f.key), f]),
        )
        const { dirs, files } = selection.reduce(
          (acc, id) => {
            const dir = dirsByBasename[id]
            if (dir) return { ...acc, dirs: [...acc.dirs, dir] }
            const file = filesByBasename[id]
            if (file) return { ...acc, files: [...acc.files, file] }
            return acc // shouldnt happen
          },
          { files: [] as requests.BucketListingFile[], dirs: [] as string[] },
        )

        // TODO: limit concurrency?
        // TODO: drain?
        // TODO: lock dialog while listing the files
        const dirsPromises = dirs.map((dir) =>
          bucketListing({ bucket, path: dir, delimiter: false }),
        )

        const dirsChildren = await Promise.all(dirsPromises)
        const allChildren = dirsChildren.reduce(
          (acc, res) => acc.concat(res.files),
          [] as requests.BucketListingFile[],
        )

        onClose({ files: files.concat(allChildren), path })
      },
      _: () => {},
    })
  }, [onClose, selection, data, bucket, path, bucketListing])

  const handleExited = React.useCallback(() => {
    setSelection([])
  }, [])

  return (
    <M.Dialog
      open={open}
      onClose={handleClose}
      onExited={handleExited}
      fullWidth
      maxWidth="lg"
      // TODO: height?
      // scroll="body"
    >
      <M.DialogTitle>Add files from S3</M.DialogTitle>
      <div className={classes.crumbs}>
        {renderCrumbs(crumbs, { getLinkProps: getCrumbLinkProps })}
      </div>
      {data.case({
        // TODO: customized error display?
        Err: displayError(),
        Init: () => null,
        _: (x: $TSFixMe) => {
          const res: requests.BucketListingResult | null = AsyncResult.getPrevResult(x)
          return res ? (
            <DirContents
              response={res}
              locked={!AsyncResult.Ok.is(x)}
              bucket={bucket}
              path={path}
              setPath={setPath}
              prefix={prefix}
              setPrefix={setPrefix}
              loadMore={loadMore}
              selection={selection}
              onSelectionChange={setSelection}
            />
          ) : (
            // TODO: skeleton
            <M.Box px={3}>
              <M.CircularProgress />
            </M.Box>
          )
        },
      })}
      <M.DialogActions>
        <M.Button onClick={cancel}>Cancel</M.Button>
        <M.Button
          onClick={add}
          variant="contained"
          color="primary"
          // disabled={submitting || (submitFailed && hasValidationErrors)}
        >
          Add files
        </M.Button>
      </M.DialogActions>
    </M.Dialog>
  )
}

function useFormattedListing(r: requests.BucketListingResult) {
  return React.useMemo(() => {
    const dirs = r.dirs.map((name) => ({
      type: 'dir' as const,
      name: ensureNoSlash(withoutPrefix(r.path, name)),
      to: name,
    }))
    const files = r.files.map(({ key, size, modified, archived }) => ({
      type: 'file' as const,
      name: withoutPrefix(r.path, key),
      to: key,
      size,
      modified,
      archived,
    }))
    const items = [
      ...(r.path !== '' && !r.prefix
        ? [
            {
              type: 'dir' as const,
              name: '..',
              to: up(r.path),
            },
          ]
        : []),
      ...dirs,
      ...files,
    ]
    // filter-out files with same name as one of dirs
    return R.uniqBy(R.prop('name'), items)
  }, [r])
}

const useDirContentsStyles = M.makeStyles((t) => ({
  root: {
    borderBottom: `1px solid ${t.palette.divider}`,
    borderTop: `1px solid ${t.palette.divider}`,
    marginLeft: t.spacing(2),
    marginRight: t.spacing(2),
    marginTop: t.spacing(1),
  },
}))

interface DirContentsProps {
  response: requests.BucketListingResult
  locked: boolean
  bucket: string
  path: string
  setPath: (path: string) => void
  prefix?: string
  setPrefix: (prefix: string) => void
  loadMore: () => void
  selection: DG.GridRowId[]
  onSelectionChange: (newSelection: DG.GridRowId[]) => void
}

function DirContents({
  response,
  locked,
  // bucket,
  // path,
  setPath,
  // prefix,
  setPrefix,
  loadMore,
  selection,
  onSelectionChange,
}: DirContentsProps) {
  const classes = useDirContentsStyles()
  const items = useFormattedListing(response)

  React.useLayoutEffect(() => {
    // reset selection when bucket, path and / or prefix change
    onSelectionChange([])
  }, [onSelectionChange, response.bucket, response.path, response.prefix])

  const CellComponent = React.useMemo(
    () =>
      function Cell({ item, ...props }: Listing.CellProps) {
        const onClick = React.useCallback(() => {
          // console.log('cell click', item)
          // if dir: set path to item.to
          if (item.type === 'dir') {
            setPath(item.to)
          }
          // if file: toggle item.to?
        }, [item])
        // eslint-disable-next-line jsx-a11y/interactive-supports-focus, jsx-a11y/click-events-have-key-events
        return <div role="button" onClick={onClick} {...props} />
      },
    [setPath],
  )

  return (
    <Listing.Listing
      items={items}
      locked={locked}
      loadMore={loadMore}
      truncated={response.truncated}
      prefixFilter={response.prefix}
      selection={selection}
      onSelectionChange={onSelectionChange}
      CellComponent={CellComponent}
      RootComponent="div"
      className={classes.root}
      toolbarContents={
        <Listing.PrefixFilter
          key={`${response.bucket}/${response.path}`}
          prefix={response.prefix}
          setPrefix={setPrefix}
        />
      }
    />
  )
}
