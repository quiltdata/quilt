import * as React from 'react'
import * as M from '@material-ui/core'

import * as RangeField from './RangeField'
import Slider, { SliderProps, NumberLike } from './Slider'

const useInputsStyles = M.makeStyles((t) => {
  const gap = t.spacing(1)
  return {
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

type Range<Parsed> = { gte: Parsed | null; lte: Parsed | null }

function alignRange<Parsed>({ gte, lte }: Range<Parsed>): Range<Parsed> {
  return gte != null && lte != null && gte > lte ? { gte: lte, lte: gte } : { gte, lte }
}

export interface FormControlProps<Parsed extends NumberLike>
  extends Omit<RangeField.Props<Parsed>, 'onChange' | 'value'> {
  parseNumber: SliderProps<Parsed>['parseNumber']
  formatLabel: SliderProps<Parsed>['formatLabel']
  onChange: (v: Range<Parsed>) => void
  value: Range<Parsed>
}

export function FormControl<Parsed extends NumberLike>({
  parseNumber,
  extents,
  formatLabel,
  onChange,
  parseString: parse,
  stringify,
  value,
  ...props
}: FormControlProps<Parsed>) {
  const classes = useInputsStyles()

  const { min, max } = extents
  const left = value.gte ?? min ?? null
  const right = value.lte ?? max ?? null

  const handleGte = React.useCallback(
    (gte: Parsed | null) => onChange(alignRange({ gte, lte: right })),
    [onChange, right],
  )
  const handleLte = React.useCallback(
    (lte: Parsed | null) => onChange(alignRange({ gte: left, lte })),
    [onChange, left],
  )

  return (
    <div>
      {min != null && max != null && min !== max && (
        <Slider
          className={classes.slider}
          formatLabel={formatLabel}
          max={max}
          min={min}
          onChange={onChange}
          parseNumber={parseNumber}
          value={value}
        />
      )}
      <div className={classes.inputs}>
        <RangeField.Field
          extents={extents}
          label="From"
          onChange={handleGte}
          parseString={parse}
          stringify={stringify}
          value={left}
          {...props}
        />
        <RangeField.Field
          extents={extents}
          label="To"
          onChange={handleLte}
          parseString={parse}
          stringify={stringify}
          value={right}
          {...props}
        />
      </div>
    </div>
  )
}
