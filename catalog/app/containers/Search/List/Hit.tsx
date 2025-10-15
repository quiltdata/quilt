import cx from 'classnames'
import * as React from 'react'
import * as RR from 'react-router-dom'
import * as M from '@material-ui/core'

import JsonDisplay from 'components/JsonDisplay'
import * as Preview from 'components/Preview'
import Skeleton from 'components/Skeleton'
import { S3ObjectLocation } from 'model/S3'
import { useBucketExistence } from 'utils/BucketCache'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as Format from 'utils/format'
import { readableBytes } from 'utils/string'

import * as SearchUIModel from '../model'

const useCardStyles = M.makeStyles((t) => ({
  card: {
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',

    '& + &': {
      marginTop: t.spacing(2),
    },
  },
}))

function Card({ children, ...props }: React.PropsWithChildren<{}>) {
  const classes = useCardStyles()
  return (
    <M.Paper variant="outlined" className={classes.card} {...props}>
      {children}
    </M.Paper>
  )
}

const useSectionStyles = M.makeStyles((t) => ({
  section: {
    padding: t.spacing(2),
    position: 'relative',

    '&$bare': {
      padding: 0,
    },
  },
  grow: {
    flexGrow: 1,
  },
  divider: {
    borderTop: `1px solid ${t.palette.divider}`,
  },
  bare: {},
}))

interface SectionProps {
  children?: React.ReactNode
  bare?: boolean
  divider?: boolean
  grow?: boolean
}

function Section({
  children,
  bare = false,
  divider = false,
  grow = false,
}: SectionProps) {
  const classes = useSectionStyles()
  return (
    <div
      className={cx(
        classes.section,
        divider && classes.divider,
        grow && classes.grow,
        bare && classes.bare,
      )}
    >
      {children}
    </div>
  )
}

const useHeadingStyles = M.makeStyles((t) => ({
  heading: {
    ...t.typography.body1,
    fontWeight: t.typography.fontWeightMedium,
    lineHeight: '20px',
  },
  secondary: {
    fontWeight: t.typography.fontWeightRegular,
    color: t.palette.text.secondary,
  },
}))

interface HeadingProps {
  children?: React.ReactNode
  secondary?: boolean
}

function Heading({ children, secondary }: HeadingProps) {
  const classes = useHeadingStyles()
  return (
    <span className={cx(classes.heading, secondary && classes.secondary)}>
      {children}
    </span>
  )
}

const useLinkStyles = M.makeStyles((t) => ({
  link: {},
  text: {
    position: 'relative',
  },
  clickArea: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,

    '$link:hover &': {
      background: t.palette.action.hover,
    },
  },
}))

function Link({ to, children }: { to: string; children: React.ReactNode }) {
  const classes = useLinkStyles()
  return (
    <RR.Link className={classes.link} to={to}>
      <span className={classes.text}>{children}</span>
      <div className={classes.clickArea} />
    </RR.Link>
  )
}

const useSecondaryStyles = M.makeStyles((t) => ({
  secondary: {
    ...t.typography.body2,
    color: t.palette.text.secondary,
    marginTop: t.spacing(1),
  },
}))

function Secondary({ children }: React.PropsWithChildren<{}>) {
  const classes = useSecondaryStyles()
  return <div className={classes.secondary}>{children}</div>
}

const useDividerStyles = M.makeStyles((t) => ({
  divider: {
    marginLeft: t.spacing(0.5),
    marginRight: t.spacing(0.5),
  },
}))

function Divider() {
  const classes = useDividerStyles()
  return <span className={classes.divider}> • </span>
}

interface PackageProps {
  hit: SearchUIModel.SearchHitPackage
  showBucket?: boolean
  showRevision?: boolean
}

export function Package({
  hit,
  showBucket = false,
  showRevision = false,
  ...props
}: PackageProps) {
  const { urls } = NamedRoutes.use()

  // this is actually a string, so we need to parse it
  const metaJson = React.useMemo(() => {
    if (!hit.meta) return null
    try {
      return JSON.parse(hit.meta)
    } catch {
      return null
    }
  }, [hit.meta])

  const comment = hit.comment === 'None' ? null : hit.comment

  return (
    <Card {...props}>
      <Section grow>
        <Link
          to={urls.bucketPackageTree(
            hit.bucket,
            hit.name,
            hit.pointer === 'latest' ? hit.pointer : hit.hash,
          )}
        >
          {showBucket && <Heading secondary>{hit.bucket} / </Heading>}
          <Heading>{hit.name}</Heading>
        </Link>
        <Secondary>
          {readableBytes(hit.size)}
          <Divider />
          <M.Tooltip arrow title={hit.modified.toLocaleString()}>
            <span style={{ position: 'relative' }}>
              Updated <Format.Relative value={hit.modified} />
            </span>
          </M.Tooltip>
          {!!hit.workflow?.id && (
            <>
              <Divider />{' '}
              <M.Chip size="small" variant="outlined" label={hit.workflow.id} />
            </>
          )}
          {showRevision && (
            <>
              <Divider />{' '}
              <M.Tooltip arrow title={hit.hash}>
                <span style={{ position: 'relative' }}>{hit.hash.slice(0, 8)}</span>
              </M.Tooltip>
            </>
          )}
        </Secondary>
        {showRevision && !!comment && (
          <Secondary>
            <span style={{ position: 'relative', fontWeight: 300 }}>{comment}</span>
          </Secondary>
        )}
      </Section>

      {!!metaJson && (
        <Section divider>
          <JsonDisplay name="Metadata" value={metaJson} />
        </Section>
      )}
    </Card>
  )
}

interface ObjectProps {
  hit: SearchUIModel.SearchHitObject
  showBucket?: boolean
}

export function Object({ hit, showBucket = false, ...props }: ObjectProps) {
  const { urls } = NamedRoutes.use()

  return (
    <Card {...props}>
      <Section grow>
        <Link to={urls.bucketFile(hit.bucket, hit.key, { version: hit.version })}>
          {showBucket && <Heading secondary>{hit.bucket} / </Heading>}
          <Heading>{hit.key}</Heading>
        </Link>
        <Secondary>
          {hit.deleted ? 'Delete Marker' : readableBytes(hit.size)}
          <Divider />
          {hit.deleted ? 'Deleted' : 'Updated'}{' '}
          <M.Tooltip arrow title={hit.modified.toLocaleString()}>
            <span style={{ position: 'relative' }}>
              <Format.Relative value={hit.modified} />
            </span>
          </M.Tooltip>
          <Divider />
          <M.Tooltip arrow title={`VersionID: ${hit.version}`}>
            <span style={{ position: 'relative' }}>v.{hit.version.slice(0, 4)}</span>
          </M.Tooltip>
        </Secondary>
      </Section>

      {!hit.deleted && hit.size > 0 && (
        <Section bare divider>
          <PreviewDisplay handle={hit} />
        </Section>
      )}
    </Card>
  )
}

interface PreviewDisplayProps {
  handle: S3ObjectLocation
}

function PreviewDisplay({ handle }: PreviewDisplayProps) {
  const [expanded, setExpanded] = React.useState(false)
  const onToggle = React.useCallback(() => setExpanded((e) => !e), [])

  return useBucketExistence(handle.bucket).case({
    _: () => <PreviewProgress />,
    Err: () => (
      <PreviewMessage
        heading="Bucket Does Not Exist"
        body="Could not find the specified bucket"
      />
    ),
    Ok: () => (
      <Preview.Load handle={handle} options={{ context: Preview.CONTEXT.LISTING }}>
        {(data: $TSFixMe) => (
          <Preview.Display
            data={data}
            noDownload={undefined}
            renderContents={(children: $TSFixMe) =>
              (<PreviewContents {...{ children, expanded, onToggle }} />) as $TSFixMe
            }
            renderProgress={() => <PreviewProgress />}
            renderMessage={(message: MessageProps) => <PreviewMessage {...message} />}
            renderAction={renderPreviewAction}
            onData={undefined}
            props={undefined} // these props go to the render functions
          />
        )}
      </Preview.Load>
    ),
  })
}

const usePreviewContentsStyles = M.makeStyles((t) => ({
  preview: {
    padding: t.spacing(1),
    position: 'relative',
  },
  expanded: {},
  contents: {
    maxHeight: '106px',
    minHeight: '106px',
    padding: t.spacing(1),
    transition: 'max-height 0.2s',

    '& > *:not(iframe)': {
      // scroll `contents` div, not its children
      overflow: 'visible',
      width: 'auto',
    },

    '& img': {
      marginLeft: 'auto',
      marginRight: 'auto',
      maxHeight: '20vh',
      transition: 'max-height 0.2s',

      '$expanded &': {
        maxHeight: '80vh',
      },
    },

    '& audio': {
      margin: 'auto',
    },

    // workarounds to speed-up notebook preview rendering:
    '$preview:not($expanded) &': {
      // hide overflow only when not expanded, using this while expanded
      // slows down the page in chrome
      overflow: 'hidden',

      // only show 2 first cells unless expanded
      '& .ipynb-preview .cell:nth-child(n+5)': {
        display: 'none',
      },
    },

    '$expanded &': {
      maxHeight: '80vh',
      overflow: 'auto',
    },
  },
  fadeTop: {
    background: `linear-gradient(to bottom, rgba(255, 255, 255, 1), rgba(255, 255, 255, 0))`,
    height: t.spacing(1),
    left: 0,
    pointerEvents: 'none',
    position: 'absolute',
    right: 0,
    top: t.spacing(1),
    zIndex: 1,
  },
  fadeBottom: {
    background: `linear-gradient(to top, rgba(255, 255, 255, 1), rgba(255, 255, 255, 0))`,
    bottom: t.spacing(1),
    height: t.spacing(1),
    left: 0,
    pointerEvents: 'none',
    position: 'absolute',
    right: 0,
    zIndex: 1,
  },
  fadeLeft: {
    background: `linear-gradient(to right, rgba(255, 255, 255, 1), rgba(255, 255, 255, 0))`,
    bottom: 0,
    left: t.spacing(1),
    pointerEvents: 'none',
    position: 'absolute',
    top: 0,
    width: t.spacing(1),
    zIndex: 1,
  },
  fadeRight: {
    background: `linear-gradient(to left, rgba(255, 255, 255, 1), rgba(255, 255, 255, 0))`,
    bottom: 0,
    pointerEvents: 'none',
    position: 'absolute',
    right: t.spacing(1),
    top: 0,
    width: t.spacing(1),
    zIndex: 1,
  },
  fadeOver: {
    background: 'rgba(255, 255, 255, 0.5)',
    bottom: 0,
    cursor: 'pointer',
    height: '100%',
    left: 0,
    opacity: 1,
    position: 'absolute',
    transition: 'opacity 0.2s',
    width: '100%',
    zIndex: 1,

    '$preview:hover &': {
      background: t.palette.action.hover,
    },

    '$expanded &': {
      opacity: 0,
      pointerEvents: 'none',
    },
  },
  expand: {
    position: 'absolute',
    right: '4px',
    top: '4px',
    zIndex: 1,
  },
  expandIcon: {
    transition: 'ease transform .15s',
    '$expanded &': {
      transform: `rotate(180deg)`,
    },
  },
}))

interface PreviewContentsProps {
  children?: React.ReactNode
  title?: string
  expanded: boolean
  onToggle: () => void
}

function PreviewContents({ children, expanded, onToggle }: PreviewContentsProps) {
  const classes = usePreviewContentsStyles()
  return (
    <div className={cx(classes.preview, { [classes.expanded]: expanded })}>
      <div className={classes.contents}>{children}</div>

      <div className={classes.fadeTop} />
      <div className={classes.fadeBottom} />
      <div className={classes.fadeLeft} />
      <div className={classes.fadeRight} />
      <div className={classes.fadeOver} onClick={onToggle} title="Click to expand" />

      <M.IconButton
        className={classes.expand}
        title={expanded ? 'Collapse' : 'Expand'}
        onClick={onToggle}
      >
        <M.Icon className={classes.expandIcon}>
          {expanded ? 'unfold_less' : 'unfold_more'}
        </M.Icon>
      </M.IconButton>
    </div>
  )
}

const usePreviewMessageStyles = M.makeStyles((t) => ({
  message: {
    height: '122px',
    padding: t.spacing(2),
  },
  heading: {
    ...t.typography.body1,
    lineHeight: '20px',
    marginBottom: t.spacing(1),
  },
  body: {
    ...t.typography.body2,
    color: t.palette.text.secondary,
    marginBottom: t.spacing(1.5),
  },
}))

interface MessageProps {
  heading: React.ReactNode
  body: React.ReactNode
  action?: React.ReactNode
}

function PreviewMessage({ heading, body, action }: MessageProps) {
  const classes = usePreviewMessageStyles()
  return (
    <section className={classes.message}>
      {!!heading && <h1 className={classes.heading}>{heading}</h1>}
      {!!body && <p className={classes.body}>{body}</p>}
      {action}
    </section>
  )
}

const usePreviewProgressStyles = M.makeStyles((t) => ({
  progress: {
    padding: t.spacing(2),
  },
}))

function PreviewProgress() {
  const classes = usePreviewProgressStyles()
  return (
    <div className={classes.progress}>
      <Skeleton height={90} width="100%" />
    </div>
  )
}

interface PreviewActionProps {
  label: React.ReactNode
}

const renderPreviewAction = ({ label, ...rest }: PreviewActionProps) => (
  <M.Button variant="outlined" size="small" {...rest}>
    {label}
  </M.Button>
)

export function ObjectSkeleton() {
  return (
    <Card>
      <Section>
        <Skeleton height={20} width="60%" />
        <Skeleton height={20} width="40%" mt={1} />
      </Section>
      <Section divider>
        <Skeleton height={90} width="100%" />
      </Section>
    </Card>
  )
}

export function PackageSkeleton() {
  return (
    <Card>
      <Section>
        <Skeleton height={20} width="60%" />
        <Skeleton height={20} width="40%" mt={1} />
      </Section>
      <Section divider>
        <Skeleton height={20} width="100%" />
      </Section>
    </Card>
  )
}

interface PackagePlaceholderProps {
  children: React.ReactNode
}

export function PackagePlaceholder({ children }: PackagePlaceholderProps) {
  return (
    <Card>
      <Section>
        <Skeleton height={20} width="60%" animate={false} />
        <M.Typography style={{ marginTop: '8px' }}>{children}</M.Typography>
      </Section>
      <Section divider>
        <Skeleton height={20} width="100%" animate={false} />
      </Section>
    </Card>
  )
}
