import cx from 'classnames'
import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

import StyledLink from 'utils/StyledLink'
import useMemoEq from 'utils/useMemoEq'
import wait from 'utils/wait'

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

function StringValue({ value }) {
  const href = React.useMemo(() => getHref(value), [value])
  return href ? (
    <div>
      "
      <StyledLink href={href} target="_blank">
        {value}
      </StyledLink>
      "
    </div>
  ) : (
    <div>"{value}"</div>
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

const SEP = ', '
const SEP_LEN = 2
const MORE_LEN = 4
const CHAR_W = 8.6

function More({ keys, classes }) {
  return (
    <span className={classes.more}>
      {'<'}&hellip;{keys}
      {'>'}
    </span>
  )
}

const join = (s1, s2) =>
  s1 ? (
    <>
      {s1}
      {SEP}
      {s2}
    </>
  ) : (
    s2
  )

function CompoundEntry({
  name,
  value,
  topLevel = true,
  defaultExpanded = false,
  showKeysWhenCollapsed,
  classes,
}) {
  const braces = Array.isArray(value) ? '[]' : '{}'
  const entries = React.useMemo(() => Object.entries(value), [value])
  const [stateExpanded, setExpanded] = React.useState(!!defaultExpanded)
  const toggle = React.useCallback(() => setExpanded((e) => !e), [])
  const empty = !entries.length
  const expanded = !empty && stateExpanded

  const renderCollapsed = React.useCallback(() => {
    const availableSpace =
      showKeysWhenCollapsed -
      R.sum([
        SEP_LEN,
        MORE_LEN,
        20 / CHAR_W, // icon / padding
        name ? name.length + 2 : 0,
        4, // braces + spaces
      ])
    if (availableSpace <= 0 || Array.isArray(value)) {
      return <More keys={entries.length} classes={classes} />
    }
    return entries.reduce(
      (acc, [k]) => {
        if (acc.done) return acc
        return acc.availableSpace < k.length
          ? {
              str: join(
                acc.str,
                <More keys={entries.length - acc.keys} classes={classes} />,
              ),
              done: true,
            }
          : {
              str: join(acc.str, <span className={classes.key}>{k}</span>),
              availableSpace: acc.availableSpace - k.length - (acc.str ? SEP_LEN : 0),
              keys: acc.keys + 1,
              done: false,
            }
      },
      { str: null, availableSpace, keys: 0, done: false },
    ).str
  }, [classes, entries, name, showKeysWhenCollapsed, value])

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
        {braces[0]}
        {!expanded && (
          <>
            {empty ? '' : <span> {renderCollapsed()} </span>}
            {braces[1]}
          </>
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

function useCurrentBreakpointWidth() {
  const t = M.useTheme()
  return ['sm', 'md', 'lg'].reduce(
    // eslint-disable-next-line react-hooks/rules-of-hooks
    (acc, b) => (M.useMediaQuery(t.breakpoints.up(b)) ? t.breakpoints.width(b) : acc),
    320, // min supproted width
  )
}

export default function JsonDisplay({
  name,
  value,
  topLevel,
  // true (expand all) | false (collapse all) | int (expand N levels deep)
  defaultExpanded,
  // true (show all keys) | false (dont show keys, just show their number) | int (max length of keys string to show, incl. commas and stuff) | 'auto' (calculate string length based on screen size)
  showKeysWhenCollapsed = 'auto',
  className,
  ...props
}) {
  const classes = useStyles()
  const currentBPWidth = useCurrentBreakpointWidth()
  const computedKeys = React.useMemo(() => {
    if (showKeysWhenCollapsed === true) return Number.POSITIVE_INFINITY
    if (showKeysWhenCollapsed === false) return Number.POSITIVE_INFINITY
    // 80 is the usual total padding
    if (showKeysWhenCollapsed === 'auto') return (currentBPWidth - 80) / CHAR_W
    return showKeysWhenCollapsed
  }, [showKeysWhenCollapsed, currentBPWidth])

  return (
    <M.Box className={cx(className, classes.root)} {...props}>
      <React.Suspense fallback={<WaitingJsonRender />}>
        <JsonDisplayInner
          {...{ name, value, topLevel, defaultExpanded, classes }}
          showKeysWhenCollapsed={computedKeys}
        />
      </React.Suspense>
    </M.Box>
  )
}
