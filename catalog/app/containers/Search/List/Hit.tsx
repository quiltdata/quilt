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
import copyToClipboard from 'utils/clipboard'
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
  // The card's title is a link whose click area is an absolute overlay across
  // the whole card (see useLinkStyles). Anything inside that needs its own
  // pointer -- a tooltip target, a copy button -- has to sit above that overlay,
  // which is what this raises them out of.
  raised: {
    position: 'relative',
  },
}))

function Secondary({ children }: React.PropsWithChildren<{}>) {
  const classes = useSecondaryStyles()
  return <div className={classes.secondary}>{children}</div>
}

// A span lifted above the card-wide click overlay, so its tooltip and any
// controls inside it remain reachable. forwardRef because M.Tooltip attaches a
// ref to its child to anchor and trigger itself: a plain function component here
// silently loses the tooltip.
const Raised = React.forwardRef<HTMLSpanElement, React.PropsWithChildren<{}>>(
  function Raised({ children, ...props }, ref) {
    const classes = useSecondaryStyles()
    return (
      <span className={classes.raised} ref={ref} {...props}>
        {children}
      </span>
    )
  },
)

const useCopyableIdStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'center',
    display: 'inline-flex',
    gap: t.spacing(0.5),
    // above the card-wide click overlay, so the copy button is clickable
    position: 'relative',
  },
  // Mono Identity Rule: a value read as identity renders in Roboto Mono. The
  // rule's dense-list carve-out doesn't apply once the value carries a copy
  // affordance -- that makes this a copy row, which the rule names explicitly.
  // (The package handle above stays in body type: it IS the repeated scanning
  // label the carve-out is about.)
  value: {
    ...t.typography.monospace,
    fontSize: 'inherit',
  },
  button: {
    padding: 2,
    // Quiet for the mouse, never hidden from the keyboard.
    visibility: 'hidden',
    '$root:hover &, &:focus-visible': {
      visibility: 'visible',
    },
  },
  icon: {
    fontSize: t.typography.body2.fontSize,
  },
}))

const COPIED_FEEDBACK_MS = 1500

interface CopyableIdProps {
  children: string
  display: string
  label: string
}

// The verification moment: a scientist citing a package needs the exact value,
// not a truncated readout they have to screenshot. Full value in the tooltip,
// full value on the clipboard, confirmation in place (this row can appear many
// times per screen, so it confirms locally rather than raising a global toast).
function CopyableId({ children, display, label }: CopyableIdProps) {
  const classes = useCopyableIdStyles()
  const [copied, setCopied] = React.useState(false)

  const handleCopy = React.useCallback(() => {
    copyToClipboard(children)
    setCopied(true)
  }, [children])

  React.useEffect(() => {
    if (!copied) return undefined
    const timer = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS)
    return () => clearTimeout(timer)
  }, [copied])

  return (
    <span className={classes.root}>
      <M.Tooltip arrow title={children}>
        <span className={classes.value}>{display}</span>
      </M.Tooltip>
      <M.Tooltip arrow title={copied ? 'Copied' : `Copy ${label}`}>
        <M.IconButton
          aria-label={`Copy ${label}`}
          className={classes.button}
          onClick={handleCopy}
          size="small"
        >
          <M.Icon className={classes.icon}>{copied ? 'check' : 'content_copy'}</M.Icon>
        </M.IconButton>
      </M.Tooltip>
    </span>
  )
}

function RevisionHash({ children }: { children: string }) {
  return (
    <CopyableId display={children.slice(0, 8)} label="revision hash">
      {children}
    </CopyableId>
  )
}

function VersionId({ children }: { children: string }) {
  return (
    <CopyableId display={`v.${children.slice(0, 4)}`} label="version ID">
      {children}
    </CopyableId>
  )
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
            <Raised>
              Updated <Format.Relative value={hit.modified} />
            </Raised>
          </M.Tooltip>
          {!!hit.workflow?.id && (
            <>
              <Divider />{' '}
              <M.Chip size="small" variant="outlined" label={hit.workflow.id} />
            </>
          )}
          {showRevision && (
            <>
              <Divider /> <RevisionHash>{hit.hash}</RevisionHash>
            </>
          )}
        </Secondary>
        {showRevision && !!comment && (
          <Secondary>
            {/* Regular weight: the 300 weight has no home in the app
                (No-Display-Font Rule). Secondary ink already recedes this. */}
            <Raised>{comment}</Raised>
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

function HitObject({ hit, showBucket = false, ...props }: ObjectProps) {
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
            <Raised>
              <Format.Relative value={hit.modified} />
            </Raised>
          </M.Tooltip>
          <Divider />
          {/* A version id is machine-exact identity, and it's what someone
              pins a reference to -- same treatment as a package hash. */}
          <VersionId>{hit.version}</VersionId>
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

export { HitObject as Object }

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
