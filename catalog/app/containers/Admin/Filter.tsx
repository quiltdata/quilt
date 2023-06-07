import * as React from 'react'
import * as M from '@material-ui/core'

const FilterInputProps = {
  startAdornment: (
    <M.InputAdornment position="start">
      <M.Icon>search</M.Icon>
    </M.InputAdornment>
  ),
}

const useFilterStyles = M.makeStyles({
  root: {
    width: '40vw',
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
  const handleBlur = React.useCallback(() => {
    if (value) return
    onClose()
  }, [onClose, value])
  const handleChange = React.useCallback(
    (event) => onChange(event.target.value),
    [onChange],
  )

  return (
    <M.ClickAwayListener onClickAway={handleBlur}>
      <M.TextField
        InputProps={FilterInputProps}
        autoFocus
        className={classes.root}
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

  return <Filter value={value} onChange={onChange} onClose={collapse} />
}
