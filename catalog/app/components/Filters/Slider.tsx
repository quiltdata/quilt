import * as React from 'react'
import * as M from '@material-ui/core'

const useStyles = M.makeStyles({
  root: {},
  inputs: {
    display: 'grid',
    grid: '50% 50% 16px',
  },
})

interface SliderFilterProps {
  extents: [number, number]
  onChange: (v: [number, number]) => void
  value: [number, number]
}

interface SliderProps extends SliderFilterProps {}

export default function Slider({ extents, value, onChange }: SliderProps) {
  const classes = useStyles()
  const handleSlider = React.useCallback(
    (event, newValue) => onChange(newValue as [number, number]),
    [onChange],
  )
  return (
    <M.Box flexDirection="column">
      <M.Slider min={extents[0]} max={extents[1]} value={value} onChange={handleSlider} />
      <M.Box display="flex" className={classes.inputs}>
        <M.TextField label="from" value={value[0]} size="small" />
        <M.Box width={16} />
        <M.TextField label="to" value={value[1]} size="small" />
      </M.Box>
    </M.Box>
  )
}
