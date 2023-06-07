import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

const ANIMATION_DURATION = 150

function SearchIcon() {
  return (
    <M.InputAdornment position="start">
      <M.Icon>search</M.Icon>
    </M.InputAdornment>
  )
}

interface ClearButtonProps {
  onClick: () => void
}

function ClearButton({ onClick }: ClearButtonProps) {
  return (
    <M.InputAdornment position="end" onClick={onClick}>
      <M.IconButton size="small">
        <M.Icon fontSize="small">clear</M.Icon>
      </M.IconButton>
    </M.InputAdornment>
  )
}
const useFilterStyles = M.makeStyles({
  root: {
    animation: `$expand ${ANIMATION_DURATION}ms ease-out`,
    width: '40vw',
  },
  collapsing: {
    animation: `$collapse ${ANIMATION_DURATION}ms ease-in`,
  },
  '@keyframes collapse': {
    // Scaling down doesn't look good
    '0%': {
      transform: 'translateX(0)',
    },
    '100%': {
      transform: 'translateX(2vw)',
    },
  },
  '@keyframes expand': {
    '0%': {
      transform: 'scaleX(0.8)',
    },
    '100%': {
      transform: 'scaleX(1)',
    },
  },
})

interface FilterContainerProps {
  value: string
  onChange: (v: string) => void
}

interface FilterProps extends FilterContainerProps {
  onClose: () => void
}

function Filter({ onChange, onClose, value }: FilterProps) {
  const classes = useFilterStyles()
  const [collapsing, setCollapsing] = React.useState(false)
  const collapse = React.useCallback(() => {
    setCollapsing(true)
    // "Close" before animation ends
    setTimeout(onClose, ANIMATION_DURATION * 0.8)
  }, [onClose])
  const handleBlur = React.useCallback(() => {
    if (value) return
    collapse()
  }, [collapse, value])
  const handleChange = React.useCallback(
    (event) => onChange(event.target.value),
    [onChange],
  )
  const handleClear = React.useCallback(() => {
    onChange('')
    collapse()
  }, [collapse, onChange])

  const InputProps = React.useMemo(
    () => ({
      // Underline has its own animation and doesn't play well with collapse animation
      disableUnderline: collapsing,
      startAdornment: <SearchIcon />,
      endAdornment: value && <ClearButton onClick={handleClear} />,
    }),
    [collapsing, value, handleClear],
  )

  return (
    <M.ClickAwayListener onClickAway={handleBlur}>
      <M.TextField
        InputProps={InputProps}
        autoFocus
        className={cx(classes.root, { [classes.collapsing]: collapsing })}
        onBlur={handleBlur}
        onChange={handleChange}
        placeholder="Filter"
        size="small"
        value={value}
      />
    </M.ClickAwayListener>
  )
}

export default function FilterContainer({ onChange, value }: FilterContainerProps) {
  const [expanded, setExpanded] = React.useState(false)
  const expand = React.useCallback(() => setExpanded(true), [])
  const collapse = React.useCallback(() => setExpanded(false), [])

  if (!expanded) {
    return (
      <M.IconButton onClick={expand}>
        <M.Icon>search</M.Icon>
      </M.IconButton>
    )
  }

  return <Filter onChange={onChange} onClose={collapse} value={value} />
}
