import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'
import { DescriptionOutlined as IconDescriptionOutlined } from '@material-ui/icons'

import { CONTEXT, Display, Load } from 'components/Preview'
import JsonDisplay from 'components/JsonDisplay'
import type { RouteMap } from 'containers/Bucket/Routes'
import * as Model from 'model'
import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink from 'utils/StyledLink'
import type { PackageHandle } from 'utils/packageHandle'
import * as s3paths from 'utils/s3paths'
import { readableBytes } from 'utils/string'
import type { JsonRecord } from 'utils/types'

import { Match } from './CellValue'

const usePreviewStyles = M.makeStyles((t) => ({
  preview: {
    padding: t.spacing(1.5, 3, 3),
    position: 'relative',
    zIndex: 30,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: t.spacing(2),
  },
  close: {
    margin: t.spacing(-1, -2),
  },
}))

interface PreviewEntry {
  type: 'meta' | 'content'
  entry: Model.GQLTypes.SearchHitPackageMatchingEntry
}

interface PreviewProps extends PreviewEntry {
  onClose: () => void
}

function Preview({ type, entry, onClose }: PreviewProps) {
  const classes = usePreviewStyles()
  return (
    <M.Paper square elevation={2} className={classes.preview}>
      <div className={classes.header}>
        <M.Typography variant="h6">{entry.logicalKey}</M.Typography>
        <M.IconButton className={classes.close} onClick={onClose}>
          <M.Icon>close</M.Icon>
        </M.IconButton>
      </div>

      {type === 'meta' && <EntryMetaDisplay meta={entry.meta} />}
      {type === 'content' && (
        <Load
          handle={s3paths.parseS3Url(entry.physicalKey)}
          options={{ context: CONTEXT.LISTING }}
        >
          {(data: $TSFixMe) => (
            <Display
              data={data}
              noDownload={undefined}
              onData={undefined}
              props={undefined} // these props go to the render functions
            />
          )}
        </Load>
      )}
    </M.Paper>
  )
}

interface EntryMetaDisplayProps {
  meta: string | null
}

function EntryMetaDisplay({ meta }: EntryMetaDisplayProps) {
  const obj: JsonRecord | Error = React.useMemo(() => {
    if (!meta) return new Error('Metadata is empty')
    try {
      return JSON.parse(meta)
    } catch (e) {
      return e instanceof Error ? e : new Error(`${e}`)
    }
  }, [meta])
  return obj instanceof Error ? (
    <Lab.Alert severity="error">{obj.message}</Lab.Alert>
  ) : (
    <JsonDisplay value={obj} defaultExpanded />
  )
}

const useEntryStyles = M.makeStyles((t) => ({
  cell: {
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    overflow: 'hidden',
  },
  noMeta: {
    width: t.spacing(1.5),
  },
  match: {
    background: t.palette.warning.light,
  },
}))

interface EntryProps {
  className: string
  entry: Model.GQLTypes.SearchHitPackageMatchingEntry
  onPreview: (x: PreviewEntry) => void
  packageHandle: PackageHandle
}

function Entry({ className, entry, onPreview, packageHandle }: EntryProps) {
  const classes = useEntryStyles()
  const { urls } = NamedRoutes.use<RouteMap>()
  const handlePreview = React.useCallback(
    () => onPreview({ type: 'content', entry }),
    [entry, onPreview],
  )
  const handleMeta = React.useCallback(
    () => onPreview({ type: 'meta', entry }),
    [entry, onPreview],
  )
  const inBucket = React.useMemo(() => {
    const { bucket, key, version } = s3paths.parseS3Url(entry.physicalKey)
    return {
      title: decodeURI(entry.physicalKey),
      to: urls.bucketFile(bucket, key, { version }),
    }
  }, [entry.physicalKey, urls])
  const inPackage = React.useMemo(() => {
    const { bucket, name, hash } = packageHandle
    return {
      title: decodeURIComponent(entry.logicalKey),
      to: urls.bucketPackageTree(bucket, name, hash, entry.logicalKey),
    }
  }, [entry.logicalKey, packageHandle, urls])
  return (
    <M.TableRow hover key={entry.physicalKey} className={className}>
      <M.TableCell className={classes.cell} component="th" scope="row">
        <M.Tooltip arrow title={entry.logicalKey}>
          <StyledLink to={inPackage.to}>
            <Match on={entry.matchLocations.logicalKey}>{inPackage.title}</Match>
          </StyledLink>
        </M.Tooltip>
      </M.TableCell>
      <M.TableCell className={classes.cell}>
        <M.Tooltip arrow title={entry.physicalKey}>
          <StyledLink to={inBucket.to}>
            <Match on={entry.matchLocations.physicalKey}>{inBucket.title}</Match>
          </StyledLink>
        </M.Tooltip>
      </M.TableCell>
      <M.TableCell className={classes.cell} align="right">
        {readableBytes(entry.size)}
      </M.TableCell>
      <M.TableCell className={classes.cell} align="center">
        {entry.meta ? (
          <M.IconButton
            className={cx(entry.matchLocations.meta && classes.match)}
            onClick={handleMeta}
            size="small"
          >
            <M.Icon fontSize="inherit" color="inherit">
              list
            </M.Icon>
          </M.IconButton>
        ) : (
          <M.IconButton size="small" disabled>
            <M.Divider className={classes.noMeta} />
          </M.IconButton>
        )}
      </M.TableCell>
      <M.TableCell className={classes.cell} align="center">
        <M.IconButton
          className={cx(entry.matchLocations.contents && classes.match)}
          onClick={handlePreview}
          size="small"
        >
          <IconDescriptionOutlined fontSize="inherit" color="inherit" />
        </M.IconButton>
      </M.TableCell>
    </M.TableRow>
  )
}

const useStyles = M.makeStyles((t) => ({
  root: {
    borderBottom: `1px solid ${t.palette.divider}`,
    background: t.palette.background.default,
  },
  cell: {
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    overflow: 'hidden',
  },
  row: {
    '&:last-child $cell': {
      borderBottom: 0,
    },
  },
  table: {
    tableLayout: 'fixed',
  },
  popover: {
    position: 'absolute',
    top: '100%',
    // TODO: describe left/right numbers, should be equal to some `sticky` padding
    left: t.spacing(-0.5),
    right: t.spacing(-2.5),
    zIndex: 10,
    animation: t.transitions.create(['$growX']),
    '&::before': {
      background: M.fade(t.palette.common.black, 0.15),
      bottom: 0,
      content: '""',
      left: 0,
      position: 'fixed',
      right: 0,
      top: 0,
      zIndex: 20,
    },
  },
  sticky: {
    animation: t.transitions.create(['$fade', '$growDown']),
    // It is positioned where it would be without `absolute`,
    // but it continues to stay there when table is scrolled.
    position: 'absolute',
    padding: t.spacing(2, 2, 2, 6.5),
    // fullWidth - page container paddings
    width: `calc(100vw - ${t.spacing(3 * 2)}px)`,
  },
  totalCount: {
    paddingTop: t.spacing(2),
    paddingLeft: 0,
  },
  '@keyframes growDown': {
    '0%': {
      transform: 'translateY(-4px)',
    },
    '100%': {
      transform: 'translateY(0)',
    },
  },
  '@keyframes fade': {
    '0%': {
      opacity: 0.3,
    },
    '100%': {
      opacity: 1,
    },
  },
  '@keyframes growX': {
    '0%': {
      left: 0,
      right: 0,
    },
    '100%': {
      left: t.spacing(-0.5),
      right: t.spacing(-0.5),
    },
  },
}))

interface EntriesProps {
  entries: readonly Model.GQLTypes.SearchHitPackageMatchingEntry[]
  packageHandle: PackageHandle
  totalCount: number
}

export default function Entries({ entries, packageHandle, totalCount }: EntriesProps) {
  const { urls } = NamedRoutes.use<RouteMap>()

  const classes = useStyles()
  const ref = React.useRef<HTMLDivElement>(null)
  const [height, setHeight] = React.useState('auto')

  const [preview, setPreview] = React.useState<PreviewEntry | null>(null)

  React.useEffect(() => {
    if (!ref.current) return
    setHeight(`${ref.current.clientHeight}px`)
  }, [entries])

  // TODO:
  // const entriesColumns = [{ title: 'Logical Key', key: logicalKey }, ...]
  // colSpan = entriesColumns.length
  // and pass it to <Entry />
  const hiddenEntriesCount = totalCount - entries.length

  return (
    <div className={cx(classes.root)} style={{ height }}>
      <div className={classes.sticky} ref={ref}>
        <M.Table size="small" className={classes.table}>
          <M.TableHead>
            <M.TableRow>
              <M.TableCell className={classes.cell}>Logical Key</M.TableCell>
              <M.TableCell className={classes.cell}>Physical Key</M.TableCell>
              <M.TableCell className={classes.cell} align="right" width="100px">
                Size
              </M.TableCell>
              <M.TableCell className={classes.cell} align="center" width="120px">
                Meta
              </M.TableCell>
              <M.TableCell className={classes.cell} align="center" width="90px">
                Contents
              </M.TableCell>
            </M.TableRow>
          </M.TableHead>
          <M.TableBody>
            {entries.map((entry) => (
              <Entry
                className={classes.row}
                key={entry.logicalKey + entry.physicalKey}
                entry={entry}
                onPreview={setPreview}
                packageHandle={packageHandle}
              />
            ))}
            {!!hiddenEntriesCount && (
              <M.TableRow className={classes.row}>
                <M.TableCell colSpan={5} className={cx(classes.cell, classes.totalCount)}>
                  <M.Typography variant="caption" component="p">
                    <StyledLink
                      to={urls.bucketPackageDetail(
                        packageHandle.bucket,
                        packageHandle.name,
                      )}
                    >
                      Package contains{' '}
                      {hiddenEntriesCount === 1
                        ? 'one more entry'
                        : `${hiddenEntriesCount} more entries`}
                      {entries.length >= 10 && <span>, some may match the search</span>}
                    </StyledLink>
                  </M.Typography>
                </M.TableCell>
              </M.TableRow>
            )}
          </M.TableBody>
        </M.Table>

        {preview && (
          <div className={classes.popover}>
            <M.ClickAwayListener onClickAway={() => setPreview(null)}>
              <Preview {...preview} onClose={() => setPreview(null)} />
            </M.ClickAwayListener>
          </div>
        )}
      </div>
    </div>
  )
}
