import * as R from 'ramda'
import * as React from 'react'
import { Box, Icon } from '@material-ui/core'
import { styled } from '@material-ui/styles'

const IconBlank = () => <Box pr={2.5} />
const IconExpand = () => <Icon fontSize="small">chevron_right</Icon>
const IconCollapse = () => <Icon fontSize="small">expand_more</Icon>

function Key({ children, ...props }) {
  return !!children && <Box {...props}>{children}: </Box>
}

const formatValue = R.cond([
  [R.is(String), (s) => `"${s}"`],
  [R.T, (v) => `${v}`],
])

// TODO: add some highlighting
function PrimitiveValue({ children, ...props }) {
  return <Box {...props}>{formatValue(children)}</Box>
}

function PrimitiveEntry({ name, value, topLevel = true, ...props }) {
  return (
    <Box display="flex" alignItems="center" {...props}>
      {!topLevel && <IconBlank />}
      <Key>{name}</Key>
      <PrimitiveValue>{value}</PrimitiveValue>
    </Box>
  )
}

function CompoundEntry({ name, value, topLevel = true, ...props }) {
  const braces = Array.isArray(value) ? '[]' : '{}'
  const entries = React.useMemo(() => Object.entries(value), [value])
  // TODO: default expanded state heuristics?
  const [expanded, setExpanded] = React.useState(false)
  const toggle = React.useCallback(() => setExpanded((e) => !e), [])
  const empty = !entries.length

  return (
    <Box {...props}>
      <Box display="flex" alignItems="center" onClick={toggle}>
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
          <span>
            {empty ? '' : ` ${entries.length}`} {braces[1]}
          </span>
        )}
      </Box>
      {!!expanded && (
        <Box pl={2}>
          {entries.map(([k, v]) => (
            <JsonDisplayInner key={k} name={k} value={v} topLevel={false} />
          ))}
          <Box onClick={toggle}>{braces[1]}</Box>
        </Box>
      )}
    </Box>
  )
}

const isPrimitive = R.anyPass([
  R.is(String),
  R.is(Number),
  R.is(Boolean),
  R.equals(null),
  R.equals(undefined),
])

function JsonDisplayInner({ value, ...props }) {
  const Component = isPrimitive(value) ? PrimitiveEntry : CompoundEntry
  return <Component value={value} {...props} />
}

const Container = styled(Box)({
  overflow: 'auto',
  whiteSpace: 'pre',
})

export default function JsonDisplay({ name, value, topLevel, ...props }) {
  return (
    <Container
      fontFamily="monospace.fontFamily"
      fontSize="body2.fontSize"
      width="100%"
      {...props}
    >
      <JsonDisplayInner {...{ name, value, topLevel }} />
    </Container>
  )
}
