import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

const IconBlank = () => <M.Box pr={2.5} />
const IconExpand = () => <M.Icon fontSize="small">chevron_right</M.Icon>
const IconCollapse = () => <M.Icon fontSize="small">expand_more</M.Icon>

function KeyFormat(props) {
  return <M.Box fontWeight="fontWeightBold" {...props} />
}

function Key({ children, ...props }) {
  return !!children && <KeyFormat {...props}>{children}: </KeyFormat>
}

const formatValue = R.cond([
  [R.is(String), (s) => `"${s}"`],
  [R.T, (v) => `${v}`],
])

// TODO: add some highlighting
function PrimitiveValue({ children, ...props }) {
  return <M.Box {...props}>{formatValue(children)}</M.Box>
}

function PrimitiveEntry({
  name,
  value,
  topLevel = true,
  defaultExpanded,
  showKeysWhenCollapsed,
  ...props
}) {
  return (
    <M.Box display="flex" {...props}>
      {!topLevel && <IconBlank />}
      <Key>{name}</Key>
      <PrimitiveValue>{value}</PrimitiveValue>
    </M.Box>
  )
}

const SEP = ', '
const SEP_LEN = 2
const MORE_LEN = 4
const CHAR_W = 8.55

function More({ keys }) {
  return (
    <M.Box component="span" color="text.secondary">
      {'<'}&hellip;{keys}
      {'>'}
    </M.Box>
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
  ...props
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
    if (availableSpace <= 0 || Array.isArray(value)) return <More keys={entries.length} />
    return entries.reduce(
      (acc, [k]) => {
        if (acc.done) return acc
        return acc.availableSpace < k.length
          ? {
              str: join(acc.str, <More keys={entries.length - acc.keys} />),
              done: true,
            }
          : {
              str: join(acc.str, <KeyFormat component="span">{k}</KeyFormat>),
              availableSpace: acc.availableSpace - k.length - (acc.str ? SEP_LEN : 0),
              keys: acc.keys + 1,
              done: false,
            }
      },
      { str: null, availableSpace, keys: 0, done: false },
    ).str
  }

  return (
    <M.Box {...props}>
      <M.Box display="flex" onClick={toggle}>
        {/* TODO: use icon rotation like MUI ? */}
        {empty ? ( // eslint-disable-line no-nested-ternary
          !topLevel && <IconBlank />
        ) : expanded ? (
          <IconCollapse />
        ) : (
          <IconExpand />
        )}
        <Key>{name}</Key>
        {braces[0]}
        {!expanded && (
          <>
            {empty ? '' : <span> {renderCollapsed()} </span>}
            {braces[1]}
          </>
        )}
      </M.Box>
      <M.Box pl={2} display={expanded ? 'block' : 'none'}>
        {entries.map(([k, v]) => (
          <JsonDisplayInner
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
        <M.Box onClick={toggle}>{braces[1]}</M.Box>
      </M.Box>
    </M.Box>
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

const Container = M.styled(M.Box)({
  overflow: 'auto',
  whiteSpace: 'pre',
})

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
  ...props
}) {
  const currentBPWidth = useCurrentBreakpointWidth()
  const computedKeys = React.useMemo(() => {
    if (showKeysWhenCollapsed === true) return Number.POSITIVE_INFINITY
    if (showKeysWhenCollapsed === false) return Number.POSITIVE_INFINITY
    // 80 is the usual total padding
    if (showKeysWhenCollapsed === 'auto') return (currentBPWidth - 80) / CHAR_W
    return showKeysWhenCollapsed
  }, [showKeysWhenCollapsed, currentBPWidth])

  return (
    <Container
      fontFamily="monospace.fontFamily"
      fontSize="body2.fontSize"
      width="100%"
      {...props}
    >
      <JsonDisplayInner
        {...{ name, value, topLevel, defaultExpanded }}
        showKeysWhenCollapsed={computedKeys}
      />
    </Container>
  )
}
