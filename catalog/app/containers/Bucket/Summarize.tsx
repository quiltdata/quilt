import type { S3 } from 'aws-sdk'
import cx from 'classnames'
import type { LocationDescriptor } from 'history'
import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

import { copyWithoutSpaces } from 'components/BreadCrumbs'
import Markdown from 'components/Markdown'
import * as Preview from 'components/Preview'
import Skeleton, { SkeletonProps } from 'components/Skeleton'
import * as APIConnector from 'utils/APIConnector'
import * as AWS from 'utils/AWS'
import { useData } from 'utils/Data'
import * as LogicalKeyResolver from 'utils/LogicalKeyResolver'
import * as NamedRoutes from 'utils/NamedRoutes'
import Link from 'utils/StyledLink'
import { PackageHandle } from 'utils/packageHandle'
import * as s3paths from 'utils/s3paths'

import * as requests from './requests'
import * as errors from './errors'

type SummaryFileTypeShorthand = 'echarts' | 'voila'
type SummaryFileTypeExtended = {
  name: SummaryFileTypeShorthand
  style?: { height: string }
}
type SummaryFileType = SummaryFileTypeShorthand | SummaryFileTypeExtended
type SummaryFileTypes = SummaryFileType[]

interface S3Handle {
  bucket: string
  error?: errors.BucketError
  key: string
  logicalKey?: string
  size?: number
  version?: string
}

interface SummarizeFile {
  description?: string
  handle: S3Handle
  path: string
  title?: string
  types?: SummaryFileTypes
  width?: string | number
}

type MakeURL = (h: S3Handle) => LocationDescriptor

const useDownloadButtonStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'center',
    display: 'flex',
    height: t.spacing(4),
    justifyContent: 'center',
    width: t.spacing(3),
  },
}))

interface DownloadButtonProps {
  className?: string
  handle: S3Handle
}

function DownloadButton({ className, handle }: DownloadButtonProps) {
  const classes = useDownloadButtonStyles()
  return AWS.Signer.withDownloadUrl(handle, (url: string) => (
    <div className={cx(classes.root, className)}>
      <M.IconButton href={url} title="Download" download>
        <M.Icon>arrow_downward</M.Icon>
      </M.IconButton>
    </div>
  ))
}

enum FileThemes {
  Overview = 'overview',
  Nested = 'nested',
}
const FileThemeContext = React.createContext(FileThemes.Overview)

const useSectionStyles = M.makeStyles((t) => ({
  root: {
    position: 'relative',
    [t.breakpoints.down('xs')]: {
      borderRadius: 0,
    },
    [t.breakpoints.up('sm')]: {
      marginTop: t.spacing(2),
    },
  },
  [FileThemes.Overview]: {
    [t.breakpoints.down('xs')]: {
      padding: t.spacing(2),
      paddingTop: t.spacing(3),
    },
    [t.breakpoints.up('sm')]: {
      padding: t.spacing(4),
    },
  },
  [FileThemes.Nested]: {
    [t.breakpoints.down('xs')]: {
      padding: t.spacing(1),
      paddingTop: t.spacing(2),
    },
    [t.breakpoints.up('sm')]: {
      padding: t.spacing(2),
    },
  },
  description: {
    ...t.typography.body2,
  },
  heading: {
    ...t.typography.h6,
    display: 'flex',
    lineHeight: 1.75,
    marginBottom: t.spacing(1),
    [t.breakpoints.up('sm')]: {
      marginBottom: t.spacing(2),
    },
    [t.breakpoints.up('md')]: {
      ...t.typography.h5,
    },
  },
  headingAction: {
    marginLeft: 'auto',
  },
}))

interface SectionProps extends M.PaperProps {
  description?: React.ReactNode
  handle?: S3Handle
  heading?: React.ReactNode
}

export function Section({
  handle,
  heading,
  description,
  children,
  ...props
}: SectionProps) {
  const ft = React.useContext(FileThemeContext)
  const classes = useSectionStyles()
  return (
    <M.Paper className={cx(classes.root, classes[ft])} {...props}>
      {!!heading && (
        <div className={classes.heading}>
          {heading}
          {handle && <DownloadButton className={classes.headingAction} handle={handle} />}
        </div>
      )}
      {!!description && <div className={classes.description}>{description}</div>}
      {children}
    </M.Paper>
  )
}

interface PreviewBoxProps {
  contents: React.ReactNode
  expanded?: boolean
}

const usePreviewBoxStyles = M.makeStyles((t) => ({
  root: {
    marginLeft: 'auto',
    marginRight: 'auto',
    maxHeight: t.spacing(30),
    minHeight: t.spacing(15),
    position: 'relative',

    // workarounds to speed-up notebook preview rendering:
    '&:not($expanded)': {
      // hide overflow only when not expanded, using this while expanded
      // slows down the page in chrome
      overflow: 'hidden',

      // only show 2 first cells unless expanded
      '& .ipynb-preview .cell:nth-child(n+3)': {
        display: 'none',
      },
    },
  },
  expanded: {
    maxHeight: 'none',
  },
  fade: {
    alignItems: 'flex-end',
    background: `linear-gradient(to top,
      rgba(255, 255, 255, 1),
      rgba(255, 255, 255, 0.9),
      rgba(255, 255, 255, 0.1),
      rgba(255, 255, 255, 0.1)
    )`,
    bottom: 0,
    display: 'flex',
    height: '100%',
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    width: '100%',
    zIndex: 1,
  },
}))

function PreviewBox({ contents, expanded: defaultExpanded = false }: PreviewBoxProps) {
  const classes = usePreviewBoxStyles()
  const [expanded, setExpanded] = React.useState(defaultExpanded)
  const expand = React.useCallback(() => {
    setExpanded(true)
  }, [setExpanded])
  return (
    <div className={cx(classes.root, { [classes.expanded]: expanded })}>
      {contents}
      {!expanded && (
        <div className={classes.fade}>
          <M.Button variant="outlined" onClick={expand}>
            Expand
          </M.Button>
        </div>
      )}
    </div>
  )
}

const CrumbLink = M.styled(Link)({ wordBreak: 'break-word' })

interface CrumbsProps {
  handle: S3Handle
}

function Crumbs({ handle }: CrumbsProps) {
  const { urls } = NamedRoutes.use()
  const crumbs = React.useMemo(() => {
    const all = s3paths.getBreadCrumbs(handle.key)
    const dirs = R.init(all).map(({ label, path }) => ({
      to: urls.bucketFile(handle.bucket, path),
      children: label,
    }))
    const file = {
      to: urls.bucketFile(handle.bucket, handle.key),
      children: R.last(all)?.label,
    }
    return { dirs, file }
  }, [handle.bucket, handle.key, urls])

  return (
    <span onCopy={copyWithoutSpaces}>
      {crumbs.dirs.map((c) => (
        <React.Fragment key={`crumb:${c.to}`}>
          <CrumbLink {...c} />
          &nbsp;/{' '}
        </React.Fragment>
      ))}
      <CrumbLink {...crumbs.file} />
    </span>
  )
}

interface FilePreviewProps {
  expanded?: boolean
  file?: SummarizeFile
  handle: S3Handle
  headingOverride: React.ReactNode
  packageHandle?: PackageHandle
}

export function FilePreview({
  expanded,
  file,
  handle,
  headingOverride,
  packageHandle,
}: FilePreviewProps) {
  const description = file ? <Markdown data={file.description} /> : null
  const heading = headingOverride != null ? headingOverride : <Crumbs handle={handle} />

  const key = handle.logicalKey || handle.key
  const props = React.useMemo(() => Preview.getRenderProps(key, file), [key, file])

  const previewOptions = React.useMemo(
    () => ({
      ...file,
      context: Preview.CONTEXT.LISTING,
    }),
    [file],
  )
  const previewHandle = React.useMemo(
    () => ({ ...handle, packageHandle }),
    [handle, packageHandle],
  )
  // TODO: check for glacier and hide items
  return (
    <Section description={description} heading={heading} handle={handle}>
      {Preview.load(
        previewHandle,
        Preview.display({
          renderContents: (contents: React.ReactNode) => (
            <PreviewBox {...{ contents, expanded }} />
          ),
          renderProgress: () => <ContentSkel />,
          props,
        }),
        previewOptions,
      )}
    </Section>
  )
}

function ContentSkel({ lines = 15, ...props }) {
  const widths = React.useMemo(
    () => R.times(() => 80 + Math.random() * 20, lines),
    [lines],
  )
  return (
    <M.Box {...props}>
      {widths.map((w, i) => (
        <Skeleton
          // eslint-disable-next-line react/no-array-index-key
          key={i}
          height={16}
          width={`${w}%`}
          borderRadius="borderRadius"
          mt={i ? 1 : 0}
        />
      ))}
    </M.Box>
  )
}

export const HeadingSkel = (props: SkeletonProps) => (
  <Skeleton borderRadius="borderRadius" width={200} {...props}>
    &nbsp;
  </Skeleton>
)

export const FilePreviewSkel = () => (
  <Section heading={<HeadingSkel />}>
    <ContentSkel />
  </Section>
)

interface TitleCustomProps {
  handle: S3Handle
  mkUrl?: MakeURL
  title: React.ReactNode
}

function TitleCustom({ title, mkUrl, handle }: TitleCustomProps) {
  const { urls } = NamedRoutes.use()

  const filepath = s3paths.withoutPrefix(s3paths.getPrefix(handle.key), handle.key)
  const route = React.useMemo(
    () => (mkUrl ? mkUrl(handle) : urls.bucketFile(handle.bucket, handle.key)),
    [handle, mkUrl, urls],
  )

  return (
    <Link title={filepath} to={route}>
      {title}
    </Link>
  )
}

interface TitleFilenameProps {
  handle: S3Handle
  mkUrl: MakeURL
}

function TitleFilename({ handle, mkUrl }: TitleFilenameProps) {
  const { urls } = NamedRoutes.use()

  // TODO: (@nl_0) make a reusable function to compute relative s3 paths or smth
  const title = s3paths.withoutPrefix(s3paths.getPrefix(handle.key), handle.key)
  const route = React.useMemo(
    () => (mkUrl ? mkUrl(handle) : urls.bucketFile(handle.bucket, handle.key)),
    [handle, mkUrl, urls],
  )
  return <Link to={route}>{title}</Link>
}

function getHeadingOverride(file: SummarizeFile, mkUrl?: MakeURL) {
  if (file.title)
    return <TitleCustom handle={file.handle} title={file.title} mkUrl={mkUrl} />
  if (mkUrl) return <TitleFilename handle={file.handle} mkUrl={mkUrl} />
  return null
}

interface EnsureAvailabilityProps {
  s3: S3
  handle: S3Handle
  children: () => React.ReactNode
}

function EnsureAvailability({ s3, handle, children }: EnsureAvailabilityProps) {
  return useData(requests.ensureObjectIsPresent, { s3, ...handle }).case({
    _: () => null,
    Ok: (h: unknown) => !!h && children(),
  })
}

interface FileHandleProps {
  file: SummarizeFile
  mkUrl?: MakeURL
  s3: S3
  packageHandle?: PackageHandle
}

function FileHandle({ file, mkUrl, packageHandle, s3 }: FileHandleProps) {
  if (file.handle.error)
    return (
      <Section heading={file.handle.key}>
        Unable to resolve path: "{s3paths.handleToS3Url(file.handle)}"
      </Section>
    )

  return (
    <EnsureAvailability s3={s3} handle={file.handle}>
      {() => (
        <FilePreview
          handle={file.handle}
          headingOverride={getHeadingOverride(file, mkUrl)}
          file={file}
          packageHandle={packageHandle}
        />
      )}
    </EnsureAvailability>
  )
}

const SUMMARY_ENTRIES = 7

function getColumnStyles(width?: number | string) {
  if (typeof width === 'string') return { flexBasis: width }
  if (R.is(Number, width)) return { flexGrow: width }
  return { flexGrow: 1 }
}

interface ColumnProps {
  className: string
  file: SummarizeFile
  mkUrl?: MakeURL
  s3: S3
  packageHandle?: PackageHandle
}

function Column({ className, file, mkUrl, packageHandle, s3 }: ColumnProps) {
  const style = React.useMemo(() => getColumnStyles(file.width), [file.width])
  return (
    <div className={className} style={style}>
      <FileHandle file={file} mkUrl={mkUrl} packageHandle={packageHandle} s3={s3} />
    </div>
  )
}

const useRowStyles = M.makeStyles((t) => ({
  row: {
    marginLeft: t.spacing(-2),
    [t.breakpoints.up('sm')]: {
      display: 'flex',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
    },
  },
  column: {
    marginLeft: t.spacing(2),
  },
}))

interface RowProps {
  file: SummarizeFile
  mkUrl?: MakeURL
  s3: S3
  packageHandle?: PackageHandle
}

function Row({ file, mkUrl, packageHandle, s3 }: RowProps) {
  const classes = useRowStyles()

  if (!Array.isArray(file))
    return <FileHandle file={file} s3={s3} mkUrl={mkUrl} packageHandle={packageHandle} />

  return (
    <div className={classes.row}>
      {file.map((f) => (
        <Column
          className={classes.column}
          file={f}
          key={`${f.handle.bucket}/${f.handle.key}`}
          mkUrl={mkUrl}
          s3={s3}
        />
      ))}
    </div>
  )
}

interface SummaryEntriesProps {
  entries: SummarizeFile[]
  mkUrl?: MakeURL
  s3: S3
  packageHandle?: PackageHandle
}

function SummaryEntries({ entries, mkUrl, packageHandle, s3 }: SummaryEntriesProps) {
  const [shown, setShown] = React.useState(SUMMARY_ENTRIES)
  const showMore = React.useCallback(() => {
    setShown(R.add(SUMMARY_ENTRIES))
  }, [setShown])

  const shownEntries = R.take(shown, entries)
  return (
    <>
      {shownEntries.map((file) => (
        <Row
          key={
            Array.isArray(file) ? file.map((f) => f.handle.key).join('') : file.handle.key
          }
          file={file}
          mkUrl={mkUrl}
          packageHandle={packageHandle}
          s3={s3}
        />
      ))}
      {shown < entries.length && (
        <M.Box mt={2} display="flex" justifyContent="center">
          <M.Button variant="contained" color="primary" onClick={showMore}>
            Show more
          </M.Button>
        </M.Box>
      )}
    </>
  )
}

interface SummaryRootProps {
  s3: S3
  bucket: string
  inStack: boolean
  overviewUrl: string
}

export function SummaryRoot({ s3, bucket, inStack, overviewUrl }: SummaryRootProps) {
  const req = APIConnector.use()
  const data = useData(requests.bucketSummary, { req, s3, bucket, inStack, overviewUrl })
  return (
    <FileThemeContext.Provider value={FileThemes.Overview}>
      {data.case({
        Err: (e: Error) => {
          // eslint-disable-next-line no-console
          console.warn('Error loading summary')
          // eslint-disable-next-line no-console
          console.error(e)
          return null
        },
        Ok: (entries: SummarizeFile[]) => <SummaryEntries entries={entries} s3={s3} />,
        Pending: () => <FilePreviewSkel />,
        _: () => null,
      })}
    </FileThemeContext.Provider>
  )
}

interface SummaryNestedProps {
  mkUrl: MakeURL
  handle: {
    key: string
    logicalKey: string
    bucket: string
    version: string
    etag: string
  }
  packageHandle: PackageHandle
}

export function SummaryNested({ handle, mkUrl, packageHandle }: SummaryNestedProps) {
  const s3 = AWS.S3.use()
  const resolveLogicalKey = LogicalKeyResolver.use()
  const data = useData(requests.summarize, { s3, handle, resolveLogicalKey })
  return (
    <FileThemeContext.Provider value={FileThemes.Nested}>
      {data.case({
        Err: (e: Error) => {
          // eslint-disable-next-line no-console
          console.warn('Error loading summary')
          // eslint-disable-next-line no-console
          console.error(e)
          return null
        },
        Ok: (entries: SummarizeFile[]) => (
          <SummaryEntries
            entries={entries}
            s3={s3}
            mkUrl={mkUrl}
            packageHandle={packageHandle}
          />
        ),
        Pending: () => <FilePreviewSkel />,
        _: () => null,
      })}
    </FileThemeContext.Provider>
  )
}
