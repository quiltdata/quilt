import cx from 'classnames'
import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

import { copyWithoutSpaces } from 'components/BreadCrumbs'
import Markdown from 'components/Markdown'
import * as Preview from 'components/Preview'
import Skeleton, { SkeletonProps } from 'components/Skeleton'
import { useData } from 'utils/Data'
import * as NamedRoutes from 'utils/NamedRoutes'
import Link from 'utils/StyledLink'
import { getBreadCrumbs, getPrefix, withoutPrefix } from 'utils/s3paths'

import * as requests from './requests'

type S3 = $TSFixMe

interface S3Handle {
  bucket: string
  key: string
  version?: string // FIXME: there is no version?
}

interface SummarizeFile {
  description?: string
  handle: S3Handle
  path: string
  title?: string
  width?: string | number
}

const useSectionStyles = M.makeStyles((t) => ({
  root: {
    position: 'relative',
    [t.breakpoints.down('xs')]: {
      borderRadius: 0,
      padding: (nested) => t.spacing(nested ? 1 : 2),
      paddingTop: (nested) => t.spacing(nested ? 2 : 3),
    },
    [t.breakpoints.up('sm')]: {
      marginTop: t.spacing(2),
      padding: (nested) => t.spacing(nested ? 2 : 4),
    },
  },
  description: {
    ...t.typography.body1,
  },
  heading: {
    ...t.typography.h6,
    lineHeight: 1.75,
    marginBottom: t.spacing(1),
    [t.breakpoints.up('sm')]: {
      marginBottom: t.spacing(2),
    },
    [t.breakpoints.up('md')]: {
      ...t.typography.h5,
    },
  },
}))

interface SectionProps extends M.PaperProps {
  description?: React.ReactNode
  heading?: React.ReactNode
  nested?: boolean
}

export function Section({
  heading,
  description,
  children,
  nested,
  ...props
}: SectionProps) {
  const classes = useSectionStyles(nested)
  return (
    <M.Paper className={classes.root} {...props}>
      {/* {!!heading && <div className={classes.heading}>{heading}</div>} */}
      {/* {!!description && <div className={classes.description}>{description}</div>} */}
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

interface FilePreviewProps {
  description: React.ReactNode
  handle: S3Handle
  headingOverride: React.ReactNode
  expanded?: boolean
  nested?: boolean
}

export function FilePreview({
  description,
  handle,
  headingOverride,
  expanded,
  nested,
}: FilePreviewProps) {
  const { urls } = NamedRoutes.use()

  const crumbs = React.useMemo(() => {
    const all = getBreadCrumbs(handle.key)
    const dirs = R.init(all).map(({ label, path }) => ({
      to: urls.bucketFile(handle.bucket, path),
      children: label,
    }))
    const file = {
      to: urls.bucketFile(handle.bucket, handle.key, handle.version),
      children: R.last(all)?.label,
    }
    return { dirs, file }
  }, [handle, urls])

  const heading =
    headingOverride != null ? (
      headingOverride
    ) : (
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

  // TODO: check for glacier and hide items
  return (
    <Section description={description} heading={heading} nested={nested}>
      {Preview.load(
        handle,
        Preview.display({
          renderContents: (contents: React.ReactNode) => (
            <PreviewBox {...{ contents, expanded }} />
          ),
          renderProgress: () => <ContentSkel />,
        }),
      )}
    </Section>
  )
}

function ContentSkel({ lines = 15, ...props }) {
  const widths = React.useMemo(() => R.times(() => 80 + Math.random() * 20, lines), [
    lines,
  ])
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
  title: React.ReactNode
  handle: S3Handle
}

function TitleCustom({ title, handle }: TitleCustomProps) {
  const { urls } = NamedRoutes.use()

  // FIXME: there is no version
  return (
    <Link to={urls.bucketFile(handle.bucket, handle.key, handle.version)}>{title}</Link>
  )
}

interface TitleFilenameProps {
  handle: S3Handle
}

function TitleFilename({ handle }: TitleFilenameProps) {
  const { urls } = NamedRoutes.use()

  // TODO: (@nl_0) make a reusable function to compute relative s3 paths or smth
  const title = withoutPrefix(getPrefix(handle.key), handle.key)
  // FIXME: there is no version
  return (
    <Link to={urls.bucketFile(handle.bucket, handle.key, handle.version)}>{title}</Link>
  )
}

interface HeadingOverrideProps {
  file: SummarizeFile
  nested?: boolean
}

function HeadingOverride({ file, nested }: HeadingOverrideProps) {
  if (file.title) return <TitleCustom handle={file.handle} title={file.title} />
  if (nested) return <TitleFilename handle={file.handle} />
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
  nested?: boolean
  s3: S3
}

export function FileHandle({ file, nested, s3 }: FileHandleProps) {
  return (
    <EnsureAvailability s3={s3} handle={file.handle}>
      {() => (
        <FilePreview
          description={<Markdown data={file.description} />}
          handle={file.handle}
          headingOverride={<HeadingOverride file={file} nested={nested} />}
          nested={nested}
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

const useRowElementStyles = M.makeStyles({
  column: {
    '& + &': {
      marginLeft: '16px',
    },
  },
})

function Column({ file, nested, s3 }: RowProps) {
  const classes = useRowElementStyles()
  const style = React.useMemo(() => getColumnStyles(file.width), [file])
  return (
    <div className={classes.column} style={style}>
      <FileHandle file={file} nested={nested} s3={s3} />
    </div>
  )
}

const useRowStyles = M.makeStyles({
  row: {
    display: 'flex',
    justifyContent: 'space-between',
  },
})

interface RowProps {
  file: SummarizeFile
  nested?: boolean
  s3: S3
}

function Row({ file, nested, s3 }: RowProps) {
  const classes = useRowStyles()

  if (!Array.isArray(file)) return <FileHandle file={file} s3={s3} nested={nested} />

  return (
    <div className={classes.row}>
      {file.map((f) => (
        <Column
          file={f}
          key={`${f.handle.bucket}/${f.handle.key}`}
          nested={nested}
          s3={s3}
        />
      ))}
    </div>
  )
}

interface SummaryEntriesProps {
  entries: SummarizeFile[]
  nested?: boolean
  s3: S3
}

export function SummaryEntries({ entries, nested, s3 }: SummaryEntriesProps) {
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
          nested={nested}
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
