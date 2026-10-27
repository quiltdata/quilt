import cx from 'classnames'
import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink from 'utils/StyledLink'
import * as s3paths from 'utils/s3paths'
import useMemoEq from 'utils/useMemoEq'
import wait from 'utils/wait'

type SupportedPrimitiveValue = string | number | boolean | null | undefined

interface UnsupportedPrimitiveValue {
  _tag: 'unsupported'
}

type PrimitiveValue = UnsupportedPrimitiveValue | SupportedPrimitiveValue

type CompoundValue = Array<AnyValue> | { [key: string]: AnyValue }

type AnyValue = CompoundValue | PrimitiveValue

const isCompound = (x: unknown): x is CompoundValue =>
  x != null && (Array.isArray(x) || x.constructor === Object)

type IsPrimitiveSupported = (x: unknown) => x is SupportedPrimitiveValue

const isPrimitiveSupported = R.anyPass([
  R.is(String),
  R.is(Number),
  R.is(Boolean),
  R.equals(null),
  // @ts-expect-error
  R.equals(undefined),
]) as IsPrimitiveSupported

const normalizePrimitive = (x: unknown): PrimitiveValue =>
  isPrimitiveSupported(x) ? x : (x as UnsupportedPrimitiveValue)

const normalizeValue = (x: unknown): AnyValue =>
  isCompound(x) ? x : normalizePrimitive(x)

// "sample_id" / "sampleId" -> "Sample ID". A short allowlist of acronyms stays
// uppercase; everything else title-cases. This is the single biggest lever on
// the "looks like code" signal -- snake_case and camelCase read as identifiers,
// not as something addressed to a reader.
const ACRONYMS = new Set([
  'id',
  'url',
  'uri',
  'uuid',
  'dna',
  'rna',
  'pcr',
  'umi',
  'qc',
  's3',
  'aws',
  'csv',
  'json',
])

function humanizeKey(key: string): string {
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2') // camelCase -> camel Case
    .replace(/[_-]+/g, ' ')
    .trim()
    .split(/\s+/)
  if (!words.length) return key
  return words
    .map((w) => {
      const lower = w.toLowerCase()
      if (ACRONYMS.has(lower)) return lower.toUpperCase()
      return lower.charAt(0).toUpperCase() + lower.slice(1)
    })
    .join(' ')
}

const useStyles = M.makeStyles((t) => ({
  root: {
    ...t.typography.body2,
    overflow: 'auto',
    width: '100%',
  },
  row: {
    alignItems: 'baseline',
    display: 'flex',
    minHeight: t.spacing(4),
    padding: t.spacing(0.5, 0),
  },
  key: {
    color: t.palette.text.secondary,
    flexShrink: 0,
    paddingRight: t.spacing(2),
    width: '40%',
  },
  value: {
    overflowWrap: 'break-word',
    width: '60%',
  },
  placeholder: {
    color: t.palette.text.disabled,
  },
  // A nested object becomes its own card (border-first elevation, per
  // DESIGN.md), never bracket-indentation -- the thing peer scientific tools
  // (Benchling custom fields, LabKey property grids) all converge on.
  card: {
    border: `1px solid ${t.palette.divider}`,
    borderRadius: t.shape.borderRadius,
    marginTop: t.spacing(0.5),
    width: '100%',
  },
  cardHeader: {
    alignItems: 'center',
    cursor: 'pointer',
    display: 'flex',
    padding: t.spacing(1, 1.5),
    userSelect: 'none',
  },
  cardHeaderLabel: {
    color: t.palette.text.secondary,
    flexGrow: 1,
  },
  cardBody: {
    borderTop: `1px solid ${t.palette.divider}`,
    padding: t.spacing(1, 1.5),
  },
  chevron: {
    color: t.palette.text.secondary,
    marginRight: t.spacing(1),
  },
  // Arrays render as chips, never `[a, b, c]`.
  chipList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: t.spacing(0.5),
  },
  chip: {
    height: t.spacing(4),
  },
  summary: {
    color: t.palette.text.secondary,
  },
}))

type Classes = ReturnType<typeof useStyles>

const useWaitingJsonRenderStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'center',
    color: t.palette.text.secondary,
    display: 'flex',
    gap: t.spacing(1),
  },
}))

const WaitingJsonRender = () => {
  const classes = useWaitingJsonRenderStyles()
  return (
    <span className={classes.root}>
      <M.CircularProgress size={14} />
      Loading…
    </span>
  )
}

function getHref(v: string) {
  try {
    const urlData = new URL(v)
    return urlData.href
  } catch (e) {
    return ''
  }
}

// Leaf rendering: no quotes around strings, no `null`/`true`/`false` literals.
// A value reads as prose, not as a parsed token.
function NonStringValue({ value }: { value: PrimitiveValue }) {
  const classes = useStyles()
  const formatted = React.useMemo(() => {
    if (value === null || value === undefined) return null
    if (typeof value === 'boolean') return value ? 'Yes' : 'No'
    if (value instanceof Date) return value.toLocaleString()
    if (typeof value === 'function') {
      return `Function(${(value as Function).name || 'anonymous'})`
    }
    return `${value}`
  }, [value])
  if (formatted === null) {
    return <span className={classes.placeholder}>Not set</span>
  }
  return <span>{formatted}</span>
}

function S3UrlValue({ href, children }: React.PropsWithChildren<{ href: string }>) {
  const { urls } = NamedRoutes.use()
  const to = React.useMemo(() => {
    const { bucket, key, version } = s3paths.parseS3Url(href)
    return urls.bucketFile(bucket, key, { version })
  }, [href, urls])
  return <StyledLink to={to}>{children}</StyledLink>
}

function StringValue({ value, noS3Links }: { value: string; noS3Links?: boolean }) {
  const href = React.useMemo(() => getHref(value), [value])
  if (!href) return <span>{value}</span>
  if (s3paths.isS3Url(href)) {
    if (noS3Links) return <span>{value}</span>
    try {
      return <S3UrlValue href={href}>{value}</S3UrlValue>
    } catch (error) {
      return <span>{value}</span>
    }
  }
  return (
    <StyledLink href={href} target="_blank">
      {value}
    </StyledLink>
  )
}

interface PrimitiveEntryProps {
  name?: string
  value: PrimitiveValue
  noS3Links?: boolean
  classes: Classes
}

function PrimitiveEntry({ name, value, noS3Links, classes }: PrimitiveEntryProps) {
  return (
    <div className={classes.row}>
      {name !== undefined && <div className={classes.key}>{humanizeKey(name)}</div>}
      <div className={classes.value}>
        {typeof value === 'string' ? (
          <StringValue value={value} noS3Links={noS3Links} />
        ) : (
          <NonStringValue value={value} />
        )}
      </div>
    </div>
  )
}

const CHIP_OVERFLOW_AT = 8

// A short array of primitives: chips, not `[a, b, c]`.
function ChipArray({ value, classes }: { value: PrimitiveValue[]; classes: Classes }) {
  const shown = value.slice(0, CHIP_OVERFLOW_AT)
  const overflow = value.length - shown.length
  return (
    <div className={classes.chipList}>
      {shown.map((v, i) => (
        // eslint-disable-next-line react/no-array-index-key
        <M.Chip key={i} className={classes.chip} label={<NonStringValue value={v} />} />
      ))}
      {overflow > 0 && (
        <M.Chip className={classes.chip} label={`+${overflow} more`} variant="outlined" />
      )}
    </div>
  )
}

function isAllPrimitive(value: AnyValue[]): value is PrimitiveValue[] {
  return value.every((v) => !isCompound(v))
}

interface CompoundEntryProps {
  name?: string
  value: CompoundValue
  defaultExpanded: number
  noS3Links?: boolean
  classes: Classes
}

function CompoundEntry({
  name,
  value,
  defaultExpanded,
  noS3Links,
  classes,
}: CompoundEntryProps) {
  const isArray = Array.isArray(value)
  const entries = React.useMemo(
    () =>
      isArray
        ? value.map((v, i): [string, AnyValue] => [String(i), v])
        : Object.entries(value),
    [value, isArray],
  )
  const [stateExpanded, setExpanded] = React.useState(defaultExpanded > 0)
  const toggle = React.useCallback(() => setExpanded((e) => !e), [])
  const empty = !entries.length
  const expanded = !empty && stateExpanded

  // A short, flat array of primitives (tags, ids, categories) is a chip row
  // inline with its label -- not worth its own card.
  if (isArray && isAllPrimitive(value) && value.length) {
    return (
      <div className={classes.row}>
        {name !== undefined && <div className={classes.key}>{humanizeKey(name)}</div>}
        <div className={classes.value}>
          <ChipArray value={value} classes={classes} />
        </div>
      </div>
    )
  }

  const summary = empty
    ? isArray
      ? 'Empty list'
      : 'Empty'
    : isArray
      ? `${entries.length} item${entries.length === 1 ? '' : 's'}`
      : `${entries.length} field${entries.length === 1 ? '' : 's'}`

  return (
    <div className={classes.card}>
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
      <div className={classes.cardHeader} onClick={empty ? undefined : toggle}>
        {!empty && (
          <M.Icon className={classes.chevron} fontSize="small">
            {expanded ? 'expand_more' : 'chevron_right'}
          </M.Icon>
        )}
        <div className={classes.cardHeaderLabel}>
          {name !== undefined ? humanizeKey(name) : isArray ? 'List' : 'Fields'}
        </div>
        <div className={classes.summary}>{summary}</div>
      </div>
      {expanded && (
        <div className={classes.cardBody}>
          <React.Suspense fallback={<WaitingJsonRender />}>
            {entries.map(([k, v]) => (
              <JsonDisplayInner
                classes={classes}
                key={k}
                name={isArray ? undefined : k}
                value={v}
                defaultExpanded={defaultExpanded - 1}
                noS3Links={noS3Links}
              />
            ))}
          </React.Suspense>
        </div>
      )}
    </div>
  )
}

interface JsonDisplayInnerProps {
  name?: string
  value: unknown
  defaultExpanded: number
  classes: Classes
  noS3Links?: boolean
}

function JsonDisplayInner({ value, ...rest }: JsonDisplayInnerProps) {
  const normalizedValue = useMemoEq(value, normalizeValue)
  const Component = isCompound(value) ? CompoundEntry : PrimitiveEntry
  // XXX: do we need to re-instantiate on props change?
  const Lazy = React.useMemo(
    () => React.lazy(() => wait(0).then(() => ({ default: Component }))),
    [Component],
  )
  // @ts-expect-error
  return <Lazy {...rest} value={normalizedValue} />
}

interface JsonDisplayProps extends M.BoxProps {
  name?: string
  value: unknown
  topLevel?: boolean
  // true (expand all) | false (collapse all) | int (expand N levels deep)
  defaultExpanded?: boolean | number
  // true (show all keys) | false (dont show keys, just show their number) | int (max length of keys string to show, incl. commas and stuff) | 'auto' (calculate string length based on screen size)
  showKeysWhenCollapsed?: boolean | number | 'auto'
  showValuesWhenCollapsed?: boolean
  // render s3:// strings as plain text instead of links to the bucket view
  noS3Links?: boolean
}

export default function JsonDisplay({
  name,
  value,
  defaultExpanded = false,
  noS3Links = false,
  className,
  // kept in the prop contract for callers; the form/card layout no longer
  // has a one-line collapsed representation to size, so these are unused.
  topLevel,
  showKeysWhenCollapsed,
  showValuesWhenCollapsed,
  ...props
}: JsonDisplayProps) {
  const classes = useStyles()

  const defaultExpandedComputed = React.useMemo(() => {
    if (defaultExpanded === true) return Number.POSITIVE_INFINITY
    if (defaultExpanded === false) return 0
    return defaultExpanded
  }, [defaultExpanded])

  return (
    <M.Box className={cx(className, classes.root)} {...props}>
      <React.Suspense fallback={<WaitingJsonRender />}>
        <JsonDisplayInner
          {...{
            name,
            value,
            defaultExpanded: defaultExpandedComputed,
            classes,
            noS3Links,
          }}
        />
      </React.Suspense>
    </M.Box>
  )
}
