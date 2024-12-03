import type { AWSError } from 'aws-sdk'
import invariant from 'invariant'
import cx from 'classnames'
import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

import Lock from 'components/Lock'
import * as BreadCrumbs from 'components/BreadCrumbs'
import AsyncResult from 'utils/AsyncResult'
import { useData } from 'utils/Data'
import { linkStyle } from 'utils/StyledLink'
import type * as Model from 'model'

import * as Listing from '../Listing'
import * as Selection from '../Selection'
import { displayError } from '../errors'
import * as requests from '../requests'

import SubmitSpinner from './SubmitSpinner'

const useSelectionWidgetStyles = M.makeStyles((t) => ({
  backdrop: {
    position: 'absolute',
    zIndex: 2,
  },
  close: {
    position: 'absolute',
    right: t.spacing(2),
    top: t.spacing(2),
  },
  popup: {
    minHeight: t.spacing(40),
    position: 'absolute',
    right: `${t.spacing(2) - 2}px`,
    top: `${t.spacing(6) - 2}px`,
    width: '60%',
    zIndex: 10,
    padding: t.spacing(2),
  },
}))

interface SelectionWidgetProps {
  className: string
}

function SelectionWidget({ className }: SelectionWidgetProps) {
  const classes = useSelectionWidgetStyles()
  const [open, setOpen] = React.useState(false)
  const toggle = React.useCallback(() => setOpen((o) => !o), [])
  const backdrop = React.useRef<HTMLElement | null>(null)
  return (
    <>
      <Selection.Button className={className} onClick={toggle} />
      <M.Backdrop
        className={classes.backdrop}
        onClick={(event) => backdrop.current === event.target && toggle()}
        open={open}
        ref={backdrop}
      >
        <M.Paper className={classes.popup}>
          <M.IconButton className={classes.close} onClick={toggle} size="small">
            <M.Icon>close</M.Icon>
          </M.IconButton>
          <Selection.Dashboard onClose={toggle} />
        </M.Paper>
      </M.Backdrop>
    </>
  )
}

export const isS3File = (f: any): f is Model.S3File =>
  !!f &&
  typeof f === 'object' &&
  typeof f.bucket === 'string' &&
  typeof f.key === 'string' &&
  (typeof f.version === 'string' || typeof f.version === 'undefined') &&
  typeof f.size === 'number'

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
export type CloseReason =
  | MuiCloseReason
  | 'cancel'
  | { filesMap: Record<string, Model.S3File> }

const useStyles = M.makeStyles((t) => ({
  paper: {
    height: '100vh',
  },
  header: {
    alignItems: 'center',
    display: 'flex',
    marginTop: -t.spacing(1),
    maxWidth: '100%',
    padding: t.spacing(0, 2, 0, 3),
  },
  crumbs: {
    ...t.typography.body1,
    overflowWrap: 'break-word',
  },
  lock: {
    bottom: 52,
    top: 56,
  },
  selectionButton: {
    marginLeft: 'auto',
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
  const slt = Selection.use()
  invariant(slt.inited, 'Selection must be used within an Selection.Provider')

  const [locked, setLocked] = React.useState(false)

  const cancel = React.useCallback(() => onClose('cancel'), [onClose])

  const handleClose = React.useCallback(
    (_e: {}, reason: MuiCloseReason) => {
      if (!locked) onClose(reason)
    },
    [locked, onClose],
  )

  const crumbs = BreadCrumbs.use(path, R.identity, 'ROOT')
  const getCrumbLinkProps = ({ to }: { to?: string }) => ({
    onClick: () => {
      setPath(to || '')
    },
  })

  React.useLayoutEffect(() => {
    // reset accumulated results when bucket, path and / or prefix change
    setPrev(null)
  }, [bucket, path, prefix])

  const handleBucketChange = React.useCallback(
    (b: string) => {
      if (!selectBucket) return
      setPath('')
      setPrefix('')
      selectBucket(b)
    },
    [selectBucket],
  )

  const data = useData(
    bucketListing,
    {
      bucket,
      path,
      prefix,
      prev,
      drain: true,
    },
    {
      noAutoFetch: !open,
    },
  )

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

  const getFiles = requests.useFilesListing()
  const add = React.useCallback(async () => {
    try {
      setLocked(true)
      const handles = Selection.toHandlesList(slt.selection)
      const filesMap = await getFiles(handles)
      onClose({ filesMap })
    } finally {
      setLocked(false)
    }
  }, [getFiles, onClose, slt.selection])

  const handleExited = React.useCallback(() => {
    setPath('')
    setPrefix('')
    setPrev(null)
    slt.clear()
  }, [slt])

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
            <BucketSelect
              bucket={bucket}
              buckets={buckets}
              selectBucket={handleBucketChange}
            />
          ) : (
            bucket
          )}
          {/* TODO: Add link to the documentation: how to add buckets to `ui.sourceBuckets` */}
        </M.Typography>
      </M.DialogTitle>
      <div className={classes.header}>
        <div className={classes.crumbs}>
          {BreadCrumbs.render(crumbs, { getLinkProps: getCrumbLinkProps })}
        </div>
        <SelectionWidget className={classes.selectionButton} />
      </div>
      {data.case({
        // TODO: customized error display?
        Err: displayError([
          [
            (e: unknown) => (e as AWSError)?.code === 'InvalidBucketName',
            (e: AWSError) => (
              <M.Box m={2}>
                <M.Typography>{e.message}</M.Typography>
              </M.Box>
            ),
          ],
        ]),
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
              selection={Selection.getDirectorySelection(
                slt.selection,
                res.bucket,
                res.path,
              )}
              onSelectionChange={(ids) => slt.merge(ids, bucket, path, prefix)}
            />
          ) : (
            // TODO: skeleton
            <M.Box px={3} pt={2} flexGrow={1}>
              <M.CircularProgress />
            </M.Box>
          )
        },
      })}
      {locked && <Lock className={classes.lock} />}
      <M.DialogActions>
        {locked && <SubmitSpinner>Adding files</SubmitSpinner>}
        <M.Button onClick={cancel}>Cancel</M.Button>
        <M.Button
          onClick={add}
          variant="contained"
          color="primary"
          disabled={locked || slt.isEmpty}
        >
          Add files
        </M.Button>
      </M.DialogActions>
    </M.Dialog>
  )
}

function useFormattedListing(r: requests.BucketListingResult): Listing.Item[] {
  return React.useMemo(() => {
    const d = r.dirs.map((p) => Listing.Entry.Dir({ key: p }))
    const f = r.files.map(Listing.Entry.File)
    return Listing.format([...d, ...f], { bucket: r.bucket, prefix: r.path })
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
  selection: Selection.SelectionItem[]
  onSelectionChange: (ids: Selection.SelectionItem[]) => void
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
