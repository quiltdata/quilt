import * as React from 'react'
import * as M from '@material-ui/core'

import * as Notifications from 'containers/Notifications'

const isNumber = (v: unknown): v is number => typeof v === 'number' && !Number.isNaN(v)

const useStyles = M.makeStyles((t) => ({
  root: {},
  inputs: {
    display: 'grid',
    gridTemplateColumns: `calc(50% - ${t.spacing(4) / 2}px) calc(50% - ${
      t.spacing(4) / 2
    }px)`,
    gridColumnGap: t.spacing(4),
  },
}))

interface RangeFilterProps {
  extents: [number, number]
  onChange: (v: [number, number]) => void
  unit: string
  value: [number, number] | null
}

interface RangeProps extends RangeFilterProps {}

export default function Range({ extents, value, onChange, unit }: RangeProps) {
  const [invalid, setInvalid] = React.useState(false)
  const { push: notify, dismiss } = Notifications.use()
  const classes = useStyles()
  const hideNotification = React.useCallback(() => {
    if (invalid) {
      setInvalid(false)
      dismiss()
    }
  }, [dismiss, invalid])
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
  const handleSlider = React.useCallback(
    (event, newValue) => onChange(newValue as [number, number]),
    [onChange],
  )
  const from = value?.[0] || extents[0]
  const to = value?.[1] || extents[1]
  const handleFrom = React.useCallback(
    (event) => {
      const newFrom = Number(event.target.value)
      if (isNumber(newFrom)) {
        onChange([newFrom, to])
      }
      validate(newFrom)
    },
    [onChange, to, validate],
  )
  const handleTo = React.useCallback(
    (event) => {
      const newTo = Number(event.target.value)
      if (isNumber(newTo)) {
        onChange([from, newTo])
      }

      validate(newTo)
    },
    [onChange, from, validate],
  )
  const inputProps = React.useMemo(
    () => ({
      size: 'small' as const,
      InputProps: {
        endAdornment: <M.InputAdornment position="end">{unit}</M.InputAdornment>,
      },
    }),
    [unit],
  )
  return (
    <div>
      <M.Slider
        max={extents[1]}
        min={extents[0]}
        onChange={handleSlider}
        value={value || extents}
        valueLabelDisplay="auto"
      />
      <div className={classes.inputs}>
        <M.TextField label="From" value={from} onChange={handleFrom} {...inputProps} />
        <M.TextField label="To" value={to} onChange={handleTo} {...inputProps} />
      </div>
    </div>
  )
}
