import * as React from 'react'
import * as M from '@material-ui/core'

import * as Notifications from 'containers/Notifications'
import { formatQuantity } from 'utils/string'

const isNumber = (v: unknown): v is number => typeof v === 'number' && !Number.isNaN(v)

const valueLabelFormat = (number: number) =>
  formatQuantity(number, {
    fallback: 'Not a number',
    suffixes: ['', 'K', 'M', 'B', 'T', 'P', 'E', 'Z', 'Y'],
  })

const useStyles = M.makeStyles((t) => {
  const gap = t.spacing(1)
  return {
    input: {
      background: t.palette.background.paper,
    },
    inputs: {
      display: 'grid',
      gridTemplateColumns: `calc(50% - ${gap / 2}px) calc(50% - ${gap / 2}px)`,
      columnGap: gap,
    },
    slider: {
      padding: t.spacing(0, 1),
    },
  }
})

interface NumbersRangeProps {
  extents: { min: number; max: number }
  onChange: (v: { min: number | null; max: number | null }) => void
  value: { min: number | null; max: number | null }
  valueLabelFormat?: (number: number) => number
}

export default function NumbersRange({
  extents,
  onChange,
  value,
  valueLabelFormat: customValueLabelFormat,
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
  const sliderValue = React.useMemo(() => [min, max], [min, max])
  return (
    <div>
      <div className={classes.slider}>
        <M.Slider
          max={extents.max}
          min={extents.min}
          onChange={handleSlider}
          value={sliderValue}
          valueLabelFormat={customValueLabelFormat || valueLabelFormat}
          valueLabelDisplay="auto"
        />
      </div>
      <div className={classes.inputs}>
        <M.TextField
          className={classes.input}
          label="From"
          onChange={handleFrom}
          size="small"
          value={min}
          variant="outlined"
        />
        <M.TextField
          className={classes.input}
          label="To"
          onChange={handleTo}
          size="small"
          value={max}
          variant="outlined"
        />
      </div>
    </div>
  )
}
