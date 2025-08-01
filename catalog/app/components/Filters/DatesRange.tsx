// TODO:
// keep internal state in individual filters
// onChange -> value or Error
// outside, debounce value on change at the top level (in PackageFilters.tsx)
// outside, disable "Submit" button if error
// outside, if error don't call onChange

import * as dateFns from 'date-fns'
import * as React from 'react'
import * as M from '@material-ui/core'

// const ymdToDate = (ymd: string): Date | Error => {
//   const date = new Date(ymd)
//   if (Number.isNaN(date.valueOf())) {
//     return new Error('Invalid date')
//   }
//   return date
// }

const dateToYmd = (date: Date): string | Error => {
  try {
    return dateFns.format(date, 'yyyy-MM-dd')
  } catch (e) {
    return e instanceof Error ? e : new Error(`Error parsing date: ${e}`)
  }
}

interface DateFieldProps extends Omit<M.TextFieldProps, 'value' | 'onChange'> {
  value: Date | null
  onChange: (v: Date | null) => void
}

function DateField({ value: initialValue, onChange, ...props }: DateFieldProps) {
  const [value, setValue] = React.useState<string | Error | null>(
    initialValue ? dateToYmd(initialValue) : initialValue,
  )
  const handleChange = React.useCallback((event) => {
    setValue(event.target.value)
  }, [])
  return (
    <M.TextField
      onChange={handleChange}
      size="small"
      type="date"
      value={value instanceof Error ? '' : value}
      variant="outlined"
      helperText={value instanceof Error ? value.message : null}
      error={value instanceof Error}
      {...props}
    />
  )
}

const useStyles = M.makeStyles((t) => {
  const gap = t.spacing(1)
  return {
    root: {
      display: 'grid',
      gridTemplateColumns: `calc(50% - ${gap / 2}px) calc(50% - ${gap / 2}px)`,
      columnGap: gap,
    },
    input: {
      background: t.palette.background.paper,
    },
  }
})

interface DateRangeProps {
  extents: { min: Date; max: Date }
  onChange: (v: { min: Date | null; max: Date | null }) => void
  value: { min: Date | null; max: Date | null }
}

export default function DatesRange({} /*extents, value, onChange*/ : DateRangeProps) {
  const classes = useStyles()
  // const min = value.min || extents.min
  // const max = value.max || extents.max
  const handleFrom = React.useCallback(
    () => {
      // console.log(event.target.value, { min: ymdToDate(event.target.value) })
      // onChange({ min: ymdToDate(event.target.value), max })
    },
    [
      /*onChange, max*/
    ],
  )
  // const handleTo = React.useCallback(
  //   (event) => onChange({ min, max: ymdToDate(event.target.value) }),
  //   [onChange, min],
  // )
  return (
    <div className={classes.root}>
      <DateField
        className={classes.input}
        label="From "
        onChange={handleFrom}
        size="small"
        type="date"
        value={new Date('invalid')}
        variant="outlined"
      />
      {/*
      <M.TextField
        className={classes.input}
        label="From"
        onChange={handleFrom}
        size="small"
        type="date"
        value={dateToYmd(min)}
        variant="outlined"
      />
      <M.TextField
        className={classes.input}
        label="To"
        onChange={handleTo}
        size="small"
        type="date"
        value={dateToYmd(max)}
        variant="outlined"
      />
      */}
    </div>
  )
}
