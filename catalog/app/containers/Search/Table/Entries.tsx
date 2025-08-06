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
  },
  close: {
    margin: t.spacing(-1, -2),
  },
}))

interface PreviewEntry {
  type: 'meta' | 'content'
  entry: Model.GQLTypes.SearchHitPackageMatchingEntry
  to: string
}

interface PreviewProps extends PreviewEntry {
  onClose: () => void
}

function Preview({ type, entry, onClose, to }: PreviewProps) {
  const classes = usePreviewStyles()
  return (
    <>
      <M.DialogTitle className={classes.header} disableTypography>
        <M.Typography component={StyledLink} to={to} variant="h6">
          {entry.logicalKey}
        </M.Typography>
        <M.IconButton onClick={onClose} className={classes.close}>
          <M.Icon>close</M.Icon>
        </M.IconButton>
      </M.DialogTitle>

      <M.DialogContent>
        {type === 'meta' && <EntryMetaDisplay meta={entry.meta} />}
        {type === 'content' && (
          <Load
            handle={s3paths.parseS3Url(entry.physicalKey)}
            options={{ context: CONTEXT.LISTING }}
          >
            {(data: $TSFixMe) => <Display data={data} />}
          </Load>
        )}
      </M.DialogContent>
      <M.DialogActions>
        <M.Button color="primary" variant="contained" onClick={onClose}>
          Close
        </M.Button>
      </M.DialogActions>
    </>
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

type EntryKey = 'logicalKey' | 'physicalKey' | 'size' | 'meta' | 'contents'

type EntryColumn = {
  title: string
  align?: M.TableCellProps['align']
  width?: string
}

const ENTRIES_COLUMNS: Record<EntryKey, EntryColumn> = {
  logicalKey: { title: 'Logical Key' },
  physicalKey: { title: 'Physical Key' },
  size: { title: 'Size', align: 'right', width: '100px' },
  meta: { title: 'Meta', align: 'center', width: '120px' },
  contents: { title: 'Contents', align: 'center', width: '90px' },
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
  const handlePreview = React.useCallback(
    () => onPreview({ type: 'content', entry, to: inPackage.to }),
    [entry, onPreview, inPackage],
  )
  const handleMeta = React.useCallback(
    () => onPreview({ type: 'meta', entry, to: inPackage.to }),
    [entry, onPreview, inPackage],
  )
  return (
    <M.TableRow hover className={className}>
      <M.TableCell
        className={classes.cell}
        component="th"
        scope="row"
        align={ENTRIES_COLUMNS.logicalKey.align}
      >
        <M.Tooltip arrow title={entry.logicalKey}>
          <StyledLink to={inPackage.to}>
            <Match on={entry.matchLocations.logicalKey}>{inPackage.title}</Match>
          </StyledLink>
        </M.Tooltip>
      </M.TableCell>
      <M.TableCell className={classes.cell} align={ENTRIES_COLUMNS.physicalKey.align}>
        <M.Tooltip arrow title={entry.physicalKey}>
          <StyledLink to={inBucket.to}>
            <Match on={entry.matchLocations.physicalKey}>{inBucket.title}</Match>
          </StyledLink>
        </M.Tooltip>
      </M.TableCell>
      <M.TableCell className={classes.cell} align={ENTRIES_COLUMNS.size.align}>
        {readableBytes(entry.size)}
      </M.TableCell>
      <M.TableCell className={classes.cell} align={ENTRIES_COLUMNS.meta.align}>
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
      <M.TableCell className={classes.cell} align={ENTRIES_COLUMNS.contents.align}>
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

  const hiddenEntriesCount = totalCount - entries.length
  const columnsHeads = React.useMemo(() => Object.entries(ENTRIES_COLUMNS), [])

  return (
    <div className={cx(classes.root)} style={{ height }}>
      <div className={classes.sticky} ref={ref}>
        <M.Table size="small" className={classes.table}>
          <M.TableHead>
            <M.TableRow>
              {columnsHeads.map(([key, column]) => (
                <M.TableCell
                  key={key}
                  className={classes.cell}
                  align={column.align}
                  width={column.width}
                >
                  {column.title}
                </M.TableCell>
              ))}
            </M.TableRow>
          </M.TableHead>
          <M.TableBody>
            {entries.map((entry) => (
              <Entry
                className={classes.row}
                key={entry.logicalKey}
                entry={entry}
                onPreview={setPreview}
                packageHandle={packageHandle}
              />
            ))}
            {!!hiddenEntriesCount && (
              <M.TableRow className={classes.row}>
                <M.TableCell
                  colSpan={columnsHeads.length}
                  className={cx(classes.cell, classes.totalCount)}
                >
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

        <M.Dialog
          open={!!preview}
          onClose={() => setPreview(null)}
          maxWidth={preview?.type === 'meta' ? 'md' : 'lg'}
          fullWidth
        >
          {preview && <Preview {...preview} onClose={() => setPreview(null)} />}
        </M.Dialog>
      </div>
    </div>
  )
}
