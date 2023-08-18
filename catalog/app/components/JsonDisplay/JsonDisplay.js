import cx from 'classnames'
import * as R from 'ramda'
import * as React from 'react'
import useResizeObserver from 'use-resize-observer'
import * as M from '@material-ui/core'

import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink from 'utils/StyledLink'
import * as s3paths from 'utils/s3paths'
import useMemoEq from 'utils/useMemoEq'
import wait from 'utils/wait'
import * as JSONOneliner from 'utils/JSONOneliner'

const useStyles = M.makeStyles((t) => ({
  root: {
    fontFamily: t.typography.monospace.fontFamily,
    fontSize: t.typography.body2.fontSize,
    overflow: 'auto',
    whiteSpace: 'pre',
    width: '100%',
  },
  more: {
    color: t.palette.text.secondary,
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
  key: {
    fontWeight: t.typography.fontWeightBold,
  },
  separator: {
    opacity: 0.7,
  },
  brace: {
    color: t.palette.text.secondary,
  },
}))

const IconBlank = ({ classes }) => <div className={classes.iconBlank} />
const IconExpand = () => <M.Icon fontSize="small">chevron_right</M.Icon>
const IconCollapse = () => <M.Icon fontSize="small">expand_more</M.Icon>

const useWaitingJsonRenderStyles = M.makeStyles((t) => ({
  root: {
    color: t.palette.text.secondary,
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

function Key({ children, classes }) {
  return !!children && <div className={classes.key}>{children}: </div>
}

function getHref(v) {
  try {
    const urlData = new URL(v)
    return urlData.href
  } catch (e) {
    return ''
  }
}

function NonStringValue({ value }) {
  return <div>{`${value}`}</div>
}

function S3UrlValue({ href, children }) {
  const { urls } = NamedRoutes.use()
  const to = React.useMemo(() => urls.bucketFile(s3paths.parseS3Url(href)), [href, urls])
  return (
    <div>
      "<StyledLink to={to}>{children}</StyledLink>"
    </div>
  )
}

function StringValue({ value }) {
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

function PrimitiveEntry({ name, value, topLevel = true, classes }) {
  return (
    <div className={classes.flex}>
      {!topLevel && <IconBlank classes={classes} />}
      <Key classes={classes}>{name}</Key>
      {typeof value === 'string' ? (
        <StringValue value={value} />
      ) : (
        <NonStringValue value={value} />
      )}
    </div>
  )
}

const SEP_LEN = 2
const MORE_LEN = 4
const CHAR_W = 8.55

function CollapsedEntry({ availableSpace, value, showValuesWhenCollapsed }) {
  const classes = useStyles()
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
                {item.original}
                <span className={classes.brace}>&quot;</span>
              </span>
            )
          default:
            return <span key={key}>{item.value}</span>
        }
      })}
    </div>
  )
}

function CompoundEntry({
  name,
  value,
  topLevel = true,
  defaultExpanded = false,
  showKeysWhenCollapsed,
  showValuesWhenCollapsed,
  classes,
}) {
  const braces = Array.isArray(value) ? '[]' : '{}'
  const entries = React.useMemo(() => Object.entries(value), [value])
  const [stateExpanded, setExpanded] = React.useState(!!defaultExpanded)
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
                defaultExpanded={
                  Number.isInteger(defaultExpanded) && defaultExpanded > 0
                    ? defaultExpanded - 1
                    : defaultExpanded
                }
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

const isPrimitive = R.anyPass([
  R.is(String),
  R.is(Number),
  R.is(Boolean),
  R.equals(null),
  R.equals(undefined),
])

function useComponentOnNextTick(Component, props, optTimeout) {
  return useMemoEq([Component, props], () =>
    React.lazy(async () => {
      await wait(optTimeout || 0)
      return {
        default: () => <Component {...props} />,
      }
    }),
  )
}

function JsonDisplayInner(props) {
  const Component = useComponentOnNextTick(
    isPrimitive(props.value) ? PrimitiveEntry : CompoundEntry,
    props,
  )
  return <Component />
}

export default function JsonDisplay({
  name,
  value,
  topLevel,
  // true (expand all) | false (collapse all) | int (expand N levels deep)
  defaultExpanded,
  // true (show all keys) | false (dont show keys, just show their number) | int (max length of keys string to show, incl. commas and stuff) | 'auto' (calculate string length based on screen size)
  showKeysWhenCollapsed = 'auto',
  showValuesWhenCollapsed = true,
  className,
  ...props
}) {
  const ref = React.useRef(null)
  const classes = useStyles()
  const { width: currentBPWidth } = useResizeObserver({ ref })
  const computedKeys = React.useMemo(() => {
    if (showKeysWhenCollapsed === true) return Number.POSITIVE_INFINITY
    if (showKeysWhenCollapsed === false) return Number.POSITIVE_INFINITY
    if (showKeysWhenCollapsed === 'auto') return currentBPWidth / CHAR_W
    return showKeysWhenCollapsed
  }, [showKeysWhenCollapsed, currentBPWidth])

  return (
    <M.Box className={cx(className, classes.root)} {...props} ref={ref}>
      <React.Suspense fallback={<WaitingJsonRender />}>
        <JsonDisplayInner
          {...{
            name,
            value,
            topLevel,
            defaultExpanded,
            classes,
            showValuesWhenCollapsed,
          }}
          showKeysWhenCollapsed={computedKeys}
        />
      </React.Suspense>
    </M.Box>
  )
}
