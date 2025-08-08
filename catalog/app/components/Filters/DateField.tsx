import * as dateFns from 'date-fns'
import * as React from 'react'
import * as M from '@material-ui/core'

import Log from 'utils/Logging'

type ValueOk<T> = { _tag: 'ok'; value: T }

type ValueErr<T> = { _tag: 'error'; value: T; error: Error }

type Value<T> = ValueOk<T> | ValueErr<T>

function Ok<T>(value: T): ValueOk<T> {
  return {
    _tag: 'ok',
    value,
  }
}

function Err<T>(value: T, error: unknown): ValueErr<T> {
  return {
    _tag: 'error',
    value,
    error: error instanceof Error ? error : new Error('Invalid date'),
  }
}

const InputLabelProps = { shrink: true }

// TODO: return Value?
const ymdToDate = (ymd: string): Date => new Date(ymd)

const dateToYmd = (date?: Date | null): Value<string> => {
  if (!date) return Err('', new Error('Empty date'))
  try {
    return Ok(dateFns.format(date, 'yyyy-MM-dd'))
  } catch (e) {
    Log.error(e)
    return Err('', e)
  }
}

function useDateInput(date: Date | null): {
  state: Value<string>
  setValue: (v: string) => Error | Date
} {
  const [state, setState] = React.useState<Value<string>>(Ok(''))

  React.useEffect(() => setState(dateToYmd(date)), [date])

  const setValue = React.useCallback((value: string) => {
    const d = ymdToDate(value)
    if (!Number.isNaN(d.valueOf())) {
      setState(Ok(value))
      return d
    }

    const invalid = new Error(d.toString())
    setState(Err(value, invalid))
    return invalid
  }, [])

  return { state, setValue }
}

const useDateFieldStyles = M.makeStyles((t) => ({
  input: {
    background: t.palette.background.paper,
  },
}))

interface DateFieldProps {
  className?: string
  date: Date | null
  onChange: (v: Date) => void
  extents: { min?: Date; max?: Date }
}

export default function DateField({
  className,
  date,
  extents,
  onChange,
  ...props
}: Omit<M.TextFieldProps, 'value' | 'onChange'> & DateFieldProps) {
  const classes = useDateFieldStyles()

  const { state, setValue } = useDateInput(date)
  const handleChange = React.useCallback(
    (event) => {
      const dateOrError = setValue(event.target.value)
      if (dateOrError instanceof Error) return
      onChange(dateOrError)
    },
    [onChange, setValue],
  )

  const inputProps = React.useMemo(
    () => ({ min: dateToYmd(extents.min).value, max: dateToYmd(extents.max).value }),
    [extents],
  )

  const InputProps = React.useMemo(() => ({ classes }), [classes])

  return (
    <M.TextField
      InputLabelProps={InputLabelProps}
      InputProps={InputProps}
      className={className}
      error={state._tag === 'error'}
      helperText={state._tag === 'error' && state.error.message}
      inputProps={inputProps}
      onChange={handleChange}
      size="small"
      type="date"
      value={state.value}
      variant="outlined"
      {...props}
    />
  )
}
