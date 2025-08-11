import * as dateFns from 'date-fns'
import * as React from 'react'
import * as M from '@material-ui/core'

import Log from 'utils/Logging'

import * as RangeField from './RangeField'
import Slider from './Slider'

const InputLabelProps = { shrink: true }

function parse(ymd: string): RangeField.InputState<Date> {
  const date = dateFns.parseISO(ymd)
  return dateFns.isValid(date)
    ? RangeField.Ok(ymd, date)
    : RangeField.Err(ymd, new Error(date.toString()))
}

function stringify(date?: Date | null): RangeField.InputState<Date> {
  if (!date) return RangeField.Err('', new Error('Empty date'))
  try {
    return RangeField.Ok(dateFns.format(date, 'yyyy-MM-dd'), date)
  } catch (e) {
    Log.error(e)
    return RangeField.Err('', e)
  }
}

type DateFieldProps = Omit<RangeField.Props<Date>, 'parse' | 'stringify'>

export const DateField = (props: DateFieldProps) => (
  <RangeField.Field
    InputLabelProps={InputLabelProps}
    stringify={stringify}
    parse={parse}
    {...props}
  />
)

const formatLabel = (number: number) => dateFns.intlFormat(new Date(number))

const useStyles = M.makeStyles((t) => {
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

type Extents<Parsed> = { min?: Parsed; max?: Parsed }

function alignRange<T>({ gte, lte }: Range<T>): Range<T> {
  return gte != null && lte != null && gte > lte ? { gte: lte, lte: gte } : { gte, lte }
}

interface DateRangeProps<Parsed> {
  extents: Extents<Parsed>
  onChange: (v: Range<Parsed>) => void
  value: Range<Parsed>
}

export default function DatesRange({ extents, value, onChange }: DateRangeProps<Date>) {
  const classes = useStyles()

  const { min, max } = extents
  const left = value.gte ?? min ?? null
  const right = value.lte ?? max ?? null

  const handleGte = React.useCallback(
    (gte: Date | null) => onChange(alignRange({ gte, lte: right })),
    [right, onChange],
  )
  const handleLte = React.useCallback(
    (lte: Date | null) => onChange(alignRange({ gte: left, lte })),
    [left, onChange],
  )

  return (
    <div>
      {min != null && max != null && min !== max && (
        <Slider
          className={classes.slider}
          convert={dateFns.toDate}
          formatLabel={formatLabel}
          max={max}
          min={min}
          onChange={onChange}
          value={value}
        />
      )}
      <div className={classes.inputs}>
        <DateField
          extents={extents}
          label="From"
          onChange={handleGte}
          type="date"
          value={left}
        />
        <DateField
          extents={extents}
          label="To"
          onChange={handleLte}
          type="date"
          value={right}
        />
      </div>
    </div>
  )
}
