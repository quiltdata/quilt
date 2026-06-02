import cx from 'classnames'
import * as R from 'ramda'
import * as React from 'react'
import useResizeObserver from 'use-resize-observer'
import * as M from '@material-ui/core'

import * as JSONOneliner from 'utils/JSONOneliner'
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

const useStyles = M.makeStyles((t) => ({
  root: {
    fontFamily: t.typography.monospace.fontFamily,
    fontSize: t.typography.body2.fontSize,
    overflow: 'auto',
    whiteSpace: 'pre',
    width: '100%',
  },
  more: {
    opacity: 0.4,
  },
  flex: {
    display: 'flex',
  },
  compoundInner: {
    paddingLeft: t.spacing(2),
  },
  hidden: {
    display: 'none',
  },
  iconBlank: {
    paddingRight: t.spacing(2.5),
  },
  key: {},
  value: {
    opacity: 0.7,
  },
  separator: {
    opacity: 0.6,
  },
  brace: {
    opacity: 0.4,
  },
}))

type Classes = ReturnType<typeof useStyles>

const IconBlank = ({ classes }: { classes: Classes }) => (
  <div className={classes.iconBlank} />
)
const IconExpand = () => <M.Icon fontSize="small">chevron_right</M.Icon>
const IconCollapse = () => <M.Icon fontSize="small">expand_more</M.Icon>

const useWaitingJsonRenderStyles = M.makeStyles((t) => ({
  root: {
    opacity: 0.5,
    display: 'flex',
    fontFamily: t.typography.monospace.fontFamily,
    fontSize: t.typography.body2.fontSize,
    marginLeft: t.spacing(2),
  },
}))

const WaitingJsonRender = () => {
  const classes = useWaitingJsonRenderStyles()
  return (
    <span className={classes.root}>
      <M.Icon fontSize="small">hourglass_empty</M.Icon>rendering…
    </span>
  )
}

interface KeyProps {
  children: React.ReactNode
  classes: Classes
}

function Key({ children, classes }: KeyProps) {
  return children ? <div className={classes.key}>{children}: </div> : null
}

function getHref(v: string) {
  try {
    const urlData = new URL(v)
    return urlData.href
  } catch (e) {
    return ''
  }
}

function NonStringValue({ value }: { value: PrimitiveValue }) {
  const formatted = React.useMemo(() => {
    if (value instanceof Date) return `Date(${value.toISOString()})`
    if (typeof value === 'function') {
      return `Function(${(value as Function).name || 'anonymous'})`
    }
    return `${value}`
  }, [value])
  return <div>{formatted}</div>
}

function S3UrlValue({ href, children }: React.PropsWithChildren<{ href: string }>) {
  const { urls } = NamedRoutes.use()
  const to = React.useMemo(() => {
    const { bucket, key, version } = s3paths.parseS3Url(href)
    return urls.bucketFile(bucket, key, { version })
  }, [href, urls])
  return (
    <div>
      "<StyledLink to={to}>{children}</StyledLink>"
    </div>
  )
}

function StringValue({ value }: { value: string }) {
  const href = React.useMemo(() => getHref(value), [value])
  if (!href) return <div>"{value}"</div>
  if (s3paths.isS3Url(href)) {
    try {
      return <S3UrlValue href={href}>{value}</S3UrlValue>
    } catch (error) {
      return <div>"{value}"</div>
    }
  }
  return (
    <div>
      "
      <StyledLink href={href} target="_blank">
        {value}
      </StyledLink>
      "
    </div>
  )
}

function PrimitiveEntry({
  name,
  value,
  topLevel,
  classes,
}: JsonDisplayInnerProps<PrimitiveValue>) {
  return (
    <div className={classes.flex}>
      {!topLevel && <IconBlank classes={classes} />}
      <Key classes={classes}>{name}</Key>
      <div className={classes.value}>
        {typeof value === 'string' ? (
          <StringValue value={value} />
        ) : (
          <NonStringValue value={value} />
        )}
      </div>
    </div>
  )
}

const SEP_LEN = 2
const MORE_LEN = 4
const CHAR_W = 8.55

interface CollapsedEntryProps {
  value: CompoundValue
  availableSpace: number
  showValuesWhenCollapsed: boolean
}

function CollapsedEntry({
  availableSpace,
  value,
  showValuesWhenCollapsed,
}: CollapsedEntryProps) {
  const classes = useStyles()
  // @ts-expect-error
  const data = JSONOneliner.print(value, availableSpace, showValuesWhenCollapsed)
  return (
    <div>
      {data.parts.map((item, index) => {
        const key = `json_print${index}`
        switch (item.type) {
          case JSONOneliner.Types.Key:
            return (
              <span className={classes.key} key={key}>
                {item.value}
              </span>
            )
          case JSONOneliner.Types.Separator:
            return (
              <span className={classes.separator} key={key}>
                {item.value}
              </span>
            )
          case JSONOneliner.Types.More:
            return (
              <span className={classes.more} key={key}>
                {item.value}
              </span>
            )
          case JSONOneliner.Types.Brace:
            const prev = data.parts[index - 1]
            const next = data.parts[index + 1]
            const braceType = JSONOneliner.Types.Brace
            // Collapse spaces in `[]` and `{}`
            const itemValue =
              (prev?.type === braceType &&
                prev?.value?.endsWith(' ') &&
                item?.value?.startsWith(' ')) ||
              (next?.type === braceType &&
                next?.value?.startsWith(' ') &&
                item?.value?.endsWith(' '))
                ? item.value.trim()
                : item.value
            return (
              <span className={classes.brace} key={key}>
                {itemValue}
              </span>
            )
          case JSONOneliner.Types.String:
            return (
              <span key={key}>
                <span className={classes.brace}>&quot;</span>
                <span className={classes.value}>{item.original}</span>
                <span className={classes.brace}>&quot;</span>
              </span>
            )
          default:
            return (
              <span key={key} className={classes.value}>
                {item.value}
              </span>
            )
        }
      })}
    </div>
  )
}

function CompoundEntry({
  name,
  value,
  topLevel,
  defaultExpanded,
  showKeysWhenCollapsed,
  showValuesWhenCollapsed,
  classes,
}: JsonDisplayInnerProps<CompoundValue>) {
  const braces = Array.isArray(value) ? '[]' : '{}'
  const entries = React.useMemo(() => Object.entries(value), [value])
  const [stateExpanded, setExpanded] = React.useState(defaultExpanded > 0)
  const toggle = React.useCallback(() => setExpanded((e) => !e), [])
  const empty = !entries.length
  const expanded = !empty && stateExpanded

  const availableSpace =
    showKeysWhenCollapsed -
    R.sum([
      SEP_LEN,
      MORE_LEN,
      20 / CHAR_W, // icon / padding
      name ? name.length + 2 : 0,
      4, // braces + spaces
    ])

  return (
    <div>
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
      <div className={classes.flex} onClick={toggle}>
        {/* TODO: use icon rotation like MUI ? */}
        {empty ? ( // eslint-disable-line no-nested-ternary
          !topLevel && <IconBlank classes={classes} />
        ) : expanded ? (
          <IconCollapse />
        ) : (
          <IconExpand />
        )}
        <Key classes={classes}>{name}</Key>
        {expanded && braces[0]}
        {!expanded && (
          <CollapsedEntry
            availableSpace={availableSpace}
            value={value}
            showValuesWhenCollapsed={showValuesWhenCollapsed || Array.isArray(value)}
          />
        )}
      </div>
      {expanded && (
        <React.Suspense
          fallback={
            <>
              <WaitingJsonRender />
              {braces[1]}
            </>
          }
        >
          <div className={cx(classes.compoundInner)}>
            {entries.map(([k, v]) => (
              <JsonDisplayInner
                classes={classes}
                key={k}
                name={k}
                value={v}
                topLevel={false}
                defaultExpanded={defaultExpanded - 1}
                showKeysWhenCollapsed={showKeysWhenCollapsed - 20 / CHAR_W}
                showValuesWhenCollapsed={showValuesWhenCollapsed}
              />
            ))}
            {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
            <div onClick={toggle}>{braces[1]}</div>
          </div>
        </React.Suspense>
      )}
    </div>
  )
}

interface JsonDisplayInnerProps<Value> {
  name?: string
  value: Value
  topLevel: boolean
  defaultExpanded: number
  classes: Classes
  showValuesWhenCollapsed: boolean
  showKeysWhenCollapsed: number
}

function JsonDisplayInner({ value, ...rest }: JsonDisplayInnerProps<unknown>) {
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
}

export default function JsonDisplay({
  name,
  value,
  topLevel = true,
  defaultExpanded = false,
  showKeysWhenCollapsed = 'auto',
  showValuesWhenCollapsed = true,
  className,
  ...props
}: JsonDisplayProps) {
  const ref = React.useRef(null)
  const classes = useStyles()
  const { width: currentBPWidth } = useResizeObserver({ ref })
  const computedKeys = React.useMemo(() => {
    if (showKeysWhenCollapsed === true) return Number.POSITIVE_INFINITY
    if (showKeysWhenCollapsed === false) return Number.POSITIVE_INFINITY
    if (showKeysWhenCollapsed === 'auto') return (currentBPWidth ?? 0) / CHAR_W
    return showKeysWhenCollapsed
  }, [showKeysWhenCollapsed, currentBPWidth])

  const defaultExpandedComputed = React.useMemo(() => {
    if (defaultExpanded === true) return Number.POSITIVE_INFINITY
    if (defaultExpanded === false) return 0
    return defaultExpanded
  }, [defaultExpanded])

  return (
    <M.Box className={cx(className, classes.root)} {...props} ref={ref}>
      <React.Suspense fallback={<WaitingJsonRender />}>
        <JsonDisplayInner
          {...{
            name,
            value,
            topLevel,
            defaultExpanded: defaultExpandedComputed,
            classes,
            showValuesWhenCollapsed,
            showKeysWhenCollapsed: computedKeys,
          }}
        />
      </React.Suspense>
    </M.Box>
  )
}
