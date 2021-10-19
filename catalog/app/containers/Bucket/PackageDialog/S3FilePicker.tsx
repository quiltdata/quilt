import cx from 'classnames'
import pLimit from 'p-limit'
import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'
import * as DG from '@material-ui/data-grid'

import { Crumb, render as renderCrumbs } from 'components/BreadCrumbs'
import AsyncResult from 'utils/AsyncResult'
import { useData } from 'utils/Data'
import { linkStyle } from 'utils/StyledLink'
import { getBreadCrumbs, ensureNoSlash, withoutPrefix } from 'utils/s3paths'

import * as Listing from '../Listing'
import { displayError } from '../errors'
import * as requests from '../requests'

import SubmitSpinner from './SubmitSpinner'

const limit = pLimit(5)

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

const getCrumbs = R.compose(R.intersperse(Crumb.Sep(<>&nbsp;/ </>)), (path: string) =>
  [{ label: 'ROOT', path: '' }, ...getBreadCrumbs(path)].map(({ label, path: segPath }) =>
    Crumb.Segment({ label, to: segPath === path ? undefined : segPath }),
  ),
)

function ExpandMore({ className }: { className?: string }) {
  return <M.Icon className={className}>expand_more</M.Icon>
}

const useBucketSelectStyles = M.makeStyles({
  root: {
    ...linkStyle,
    font: 'inherit',
  },
  select: {
    paddingBottom: 0,
    paddingTop: 0,
  },
  icon: {
    color: 'inherit',
  },
})

interface BucketSelectProps {
  bucket: string
  buckets: string[]
  selectBucket: (bucket: string) => void
}

function BucketSelect({ bucket, buckets, selectBucket }: BucketSelectProps) {
  const classes = useBucketSelectStyles()

  const handleChange = React.useCallback(
    (e: React.ChangeEvent<{ value: unknown }>) => {
      selectBucket(e.target.value as string)
    },
    [selectBucket],
  )

  return (
    <M.Select
      value={bucket}
      onChange={handleChange}
      input={<M.InputBase />}
      className={classes.root}
      classes={{ select: classes.select, icon: classes.icon }}
      IconComponent={ExpandMore}
    >
      {buckets.map((b) => (
        <M.MenuItem key={b} value={b}>
          {b}
        </M.MenuItem>
      ))}
    </M.Select>
  )
}

type MuiCloseReason = 'backdropClick' | 'escapeKeyDown'
export type CloseReason = MuiCloseReason | 'cancel' | { path: string; files: S3File[] }

const useStyles = M.makeStyles((t) => ({
  paper: {
    height: '100vh',
  },
  crumbs: {
    ...t.typography.body1,
    marginTop: -t.spacing(1),
    maxWidth: '100%',
    overflowWrap: 'break-word',
    paddingLeft: t.spacing(3),
    paddingRight: t.spacing(3),
  },
  lock: {
    background: 'rgba(255,255,255,0.5)',
    bottom: 52,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 56,
    zIndex: 1,
  },
}))

interface DialogProps {
  bucket: string
  buckets?: string[]
  selectBucket?: (bucket: string) => void
  open: boolean
  onClose: (reason: CloseReason) => void
}

export function Dialog({ bucket, buckets, selectBucket, open, onClose }: DialogProps) {
  const classes = useStyles()

  const bucketListing = requests.useBucketListing()

  const [path, setPath] = React.useState('')
  const [prefix, setPrefix] = React.useState('')
  const [prev, setPrev] = React.useState<requests.BucketListingResult | null>(null)
  const [selection, setSelection] = React.useState<DG.GridRowId[]>([])

  const [locked, setLocked] = React.useState(false)

  const cancel = React.useCallback(() => onClose('cancel'), [onClose])

  const handleClose = React.useCallback(
    (_e: {}, reason: MuiCloseReason) => {
      if (!locked) onClose(reason)
    },
    [locked, onClose],
  )

  const crumbs = React.useMemo(() => getCrumbs(path), [path])

  const getCrumbLinkProps = ({ to }: { to: string }) => ({
    onClick: () => {
      setPath(to)
    },
  })

  React.useLayoutEffect(() => {
    // reset accumulated results when bucket, path and / or prefix change
    setPrev(null)
  }, [bucket, path, prefix])

  React.useLayoutEffect(() => {
    // reset state when bucket changes
    setPath('')
    setPrefix('')
    setSelection([])
  }, [bucket])

  const data = useData(bucketListing, { bucket, path, prefix, prev, drain: true })

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
        try {
          setLocked(true)
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

          const dirsPromises = dirs.map((dir) =>
            limit(bucketListing, { bucket, path: dir, delimiter: false, drain: true }),
          )

          const dirsChildren = await Promise.all(dirsPromises)
          const allChildren = dirsChildren.reduce(
            (acc, res) => acc.concat(res.files),
            [] as requests.BucketListingFile[],
          )

          onClose({ files: files.concat(allChildren), path })
        } finally {
          setLocked(false)
        }
      },
      _: () => {},
    })
  }, [onClose, selection, data, bucket, path, bucketListing])

  const handleExited = React.useCallback(() => {
    setPath('')
    setPrefix('')
    setPrev(null)
    setSelection([])
  }, [])

  return (
    <M.Dialog
      open={open}
      onClose={handleClose}
      onExited={handleExited}
      fullWidth
      maxWidth="lg"
      classes={{ paper: classes.paper }}
    >
      <M.DialogTitle disableTypography>
        <M.Typography component="h2" variant="h6">
          Add files from s3://
          {!!buckets && buckets.length > 1 && !!selectBucket ? (
            <BucketSelect bucket={bucket} buckets={buckets} selectBucket={selectBucket} />
          ) : (
            bucket
          )}
        </M.Typography>
      </M.DialogTitle>
      <div className={classes.crumbs}>
        {/* @ts-expect-error, TODO: convert Breadcrumbs to typescript */}
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
              setPath={setPath}
              setPrefix={setPrefix}
              loadMore={loadMore}
              selection={selection}
              onSelectionChange={setSelection}
            />
          ) : (
            // TODO: skeleton
            <M.Box px={3} pt={2} flexGrow={1}>
              <M.CircularProgress />
            </M.Box>
          )
        },
      })}
      {locked && <div className={classes.lock} />}
      <M.DialogActions>
        {locked ? (
          <SubmitSpinner>Adding files</SubmitSpinner>
        ) : (
          <M.Box flexGrow={1} display="flex" alignItems="center" pl={2}>
            <M.Typography variant="body2" color="textSecondary">
              {selection.length} item{selection.length === 1 ? '' : 's'} selected
            </M.Typography>
          </M.Box>
        )}
        <M.Button onClick={cancel}>Cancel</M.Button>
        <M.Button
          onClick={add}
          variant="contained"
          color="primary"
          disabled={locked || !selection.length}
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
    const items = [...dirs, ...files]
    // filter-out files with same name as one of dirs
    return R.uniqBy(R.prop('name'), items)
  }, [r])
}

const useDirContentsStyles = M.makeStyles((t) => ({
  root: {
    borderBottom: `1px solid ${t.palette.divider}`,
    borderTop: `1px solid ${t.palette.divider}`,
    flexGrow: 1,
    marginLeft: t.spacing(2),
    marginRight: t.spacing(2),
    marginTop: t.spacing(1),
  },
  interactive: {
    cursor: 'pointer',
  },
}))

interface DirContentsProps {
  response: requests.BucketListingResult
  locked: boolean
  setPath: (path: string) => void
  setPrefix: (prefix: string) => void
  loadMore: () => void
  selection: DG.GridRowId[]
  onSelectionChange: (newSelection: DG.GridRowId[]) => void
}

function DirContents({
  response,
  locked,
  setPath,
  setPrefix,
  loadMore,
  selection,
  onSelectionChange,
}: DirContentsProps) {
  const classes = useDirContentsStyles()
  const items = useFormattedListing(response)
  const { bucket, path, prefix, truncated } = response

  React.useLayoutEffect(() => {
    // reset selection when bucket, path and / or prefix change
    onSelectionChange([])
  }, [onSelectionChange, bucket, path, prefix])

  const CellComponent = React.useMemo(
    () =>
      function Cell({ item, className, ...props }: Listing.CellProps) {
        const onClick = React.useCallback(() => {
          if (item.type === 'dir') {
            setPath(item.to)
            setPrefix('')
          }
        }, [item])
        return (
          // eslint-disable-next-line jsx-a11y/interactive-supports-focus, jsx-a11y/click-events-have-key-events
          <div
            role="button"
            onClick={onClick}
            className={cx(item.type === 'dir' && classes.interactive, className)}
            {...props}
          />
        )
      },
    [classes.interactive, setPath, setPrefix],
  )

  return (
    <Listing.Listing
      items={items}
      locked={locked}
      loadMore={loadMore}
      truncated={truncated}
      prefixFilter={prefix}
      selection={selection}
      onSelectionChange={onSelectionChange}
      CellComponent={CellComponent}
      RootComponent="div"
      className={classes.root}
      dataGridProps={{ autoHeight: false }}
      toolbarContents={
        <Listing.PrefixFilter
          key={`${bucket}/${path}`}
          prefix={prefix}
          setPrefix={setPrefix}
        />
      }
    />
  )
}
