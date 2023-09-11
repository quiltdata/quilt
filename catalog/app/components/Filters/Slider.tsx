import * as React from 'react'
import * as M from '@material-ui/core'

import * as Notifications from 'containers/Notifications'

const isNumber = (v: unknown): v is number => typeof v === 'number' && !Number.isNaN(v)

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
  const [invalid, setInvalid] = React.useState(false)
  const { push: notify, dismiss } = Notifications.use()
  const classes = useStyles()
  const hideNotification = React.useCallback(() => {
    if (invalid) {
      setInvalid(false)
      dismiss()
    }
  }, [dismiss, invalid])
  const handleSlider = React.useCallback(
    (event, newValue) => onChange(newValue as [number, number]),
    [onChange],
  )
  const validate = React.useCallback(
    (v) => {
      if (isNumber(v)) {
        hideNotification()
      } else {
        setInvalid(true)
        notify('Enter valid number, please')
        setTimeout(hideNotification, 3000)
      }
    },
    [hideNotification, notify],
  )
  const handleFrom = React.useCallback(
    (event) => {
      const from = Number(event.target.value)
      if (isNumber(from)) {
        onChange([value[0], from])
      }
      validate(from)
    },
    [onChange, validate, value],
  )
  const handleTo = React.useCallback(
    (event) => {
      const to = Number(event.target.value)
      if (isNumber(to)) {
        onChange([value[0], to])
      }

      validate(to)
    },
    [onChange, validate, value],
  )
  return (
    <M.Box flexDirection="column">
      <M.Slider min={extents[0]} max={extents[1]} value={value} onChange={handleSlider} />
      <M.Box display="flex" className={classes.inputs}>
        <M.TextField label="from" value={value[0]} size="small" onChange={handleFrom} />
        <M.Box width={16} />
        <M.TextField label="to" value={value[1]} size="small" onChange={handleTo} />
      </M.Box>
    </M.Box>
  )
}
