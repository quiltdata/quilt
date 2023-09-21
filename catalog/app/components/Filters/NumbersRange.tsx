import * as React from 'react'
import * as M from '@material-ui/core'

import * as Notifications from 'containers/Notifications'
import { formatQuantity } from 'utils/string'

const isNumber = (v: unknown): v is number => typeof v === 'number' && !Number.isNaN(v)

const valueLabelFormat = (number: number) =>
  // @ts-expect-error
  formatQuantity(number, {
    suffixes: ['', 'K', 'M', 'B', 'T', 'P', 'E', 'Z', 'Y'],
  })

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

interface NumbersRangeProps {
  extents: { min: number; max: number }
  onChange: (v: { min: number | null; max: number | null }) => void
  unit?: string
  value: { min: number | null; max: number | null }
}

export default function NumbersRange({
  extents,
  value,
  onChange,
  unit,
}: NumbersRangeProps) {
  const [invalidId, setInvalidId] = React.useState('')
  const { push: notify, dismiss } = Notifications.use()
  const classes = useStyles()
  const validate = React.useCallback(
    (v) => {
      if (invalidId) {
        setInvalidId('')
        dismiss(invalidId)
      }

      if (!isNumber(v)) {
        const {
          notification: { id },
        } = notify('Enter valid number, please')
        setInvalidId(id)
      }
    },
    [dismiss, invalidId, notify],
  )
  const handleSlider = React.useCallback(
    (event, [min, max]) => onChange({ min, max }),
    [onChange],
  )
  const min = value.min || extents.min
  const max = value.max || extents.max
  const handleFrom = React.useCallback(
    (event) => {
      const newMin = Number(event.target.value)
      if (isNumber(newMin)) {
        onChange({ min: newMin, max })
      }
      validate(newMin)
    },
    [onChange, max, validate],
  )
  const handleTo = React.useCallback(
    (event) => {
      const newMax = Number(event.target.value)
      if (isNumber(newMax)) {
        onChange({ min, max: newMax })
      }
      validate(newMax)
    },
    [onChange, min, validate],
  )
  const inputProps = React.useMemo(
    () => ({
      size: 'small' as const,
      InputProps: {
        endAdornment: unit && <M.InputAdornment position="end">{unit}</M.InputAdornment>,
      },
    }),
    [unit],
  )
  const sliderValue = React.useMemo(() => [min, max], [min, max])
  return (
    <div>
      <M.Slider
        max={extents.max}
        min={extents.min}
        onChange={handleSlider}
        value={sliderValue}
        valueLabelFormat={valueLabelFormat}
        valueLabelDisplay="auto"
      />
      <div className={classes.inputs}>
        <M.TextField label="From" value={min} onChange={handleFrom} {...inputProps} />
        <M.TextField label="To" value={max} onChange={handleTo} {...inputProps} />
      </div>
    </div>
  )
}
