import cx from 'classnames'
import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

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

function Key({ children, classes }) {
  return !!children && <div className={classes.key}>{children}: </div>
}

const formatValue = R.cond([
  [R.is(String), (s) => `"${s}"`],
  [R.T, (v) => `${v}`],
])

function PrimitiveEntry({ name, value, topLevel = true, classes }) {
  return (
    <div className={classes.flex}>
      {!topLevel && <IconBlank classes={classes} />}
      <Key classes={classes}>{name}</Key>
      <div>{formatValue(value)}</div>
    </div>
  )
}

const SEP = ', '
const SEP_LEN = 2
const MORE_LEN = 4
const CHAR_W = 8.55

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

  const renderCollapsed = () => {
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
  }

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
      <div className={cx(classes.compoundInner, !expanded && classes.hidden)}>
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

function JsonDisplayInner(props) {
  const Component = isPrimitive(props.value) ? PrimitiveEntry : CompoundEntry
  return <Component {...props} />
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
      <JsonDisplayInner
        {...{ name, value, topLevel, defaultExpanded, classes }}
        showKeysWhenCollapsed={computedKeys}
      />
    </M.Box>
  )
}
