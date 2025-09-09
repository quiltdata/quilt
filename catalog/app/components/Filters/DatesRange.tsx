import * as dateFns from 'date-fns'
import * as React from 'react'

import Log from 'utils/Logging'

import * as Range from './Range'
import * as RangeField from './RangeField'

const InputLabelProps = { shrink: true }

function parseString(ymd: string): RangeField.InputState<Date> {
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

const formatLabel = (number: number) => dateFns.intlFormat(new Date(number))

type DateRangeProps = Pick<Range.FormControlProps<Date>, 'extents' | 'onChange' | 'value'>

export default function DatesRange({ extents, value, onChange }: DateRangeProps) {
  return (
    <Range.FormControl
      InputLabelProps={InputLabelProps}
      extents={extents}
      formatLabel={formatLabel}
      onChange={onChange}
      parseNumber={dateFns.toDate}
      parseString={parseString}
      stringify={stringify}
      value={value}
    />
  )
}
