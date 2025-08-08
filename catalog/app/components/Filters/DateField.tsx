import * as dateFns from 'date-fns'
import * as React from 'react'
import * as M from '@material-ui/core'

import Log from 'utils/Logging'

const InputLabelProps = { shrink: true }

// TODO: return Value?
const ymdToDate = (ymd: string): Date => new Date(ymd)

// TODO: return Value?
const dateToYmd = (date: Date): string => dateFns.format(date, 'yyyy-MM-dd')

const dateToYmdSafe = (date?: Date): string | undefined => {
  if (!date) return undefined
  try {
    return dateToYmd(date)
  } catch (e) {
    Log.error(e)
    return undefined
  }
}

type ValueOk = { _tag: 'ok'; value: string }

type ValueErr = { _tag: 'error'; value: string; error: Error }

type Value = ValueOk | ValueErr

const Ok = (value: string): ValueOk => ({
  _tag: 'ok',
  value,
})

const Err = (value: string, error: unknown): ValueErr => ({
  _tag: 'error',
  value,
  error: error instanceof Error ? error : new Error('Invalid date'),
})

function useDateInput(date: Date | null): {
  state: Value
  setValue: (v: string) => Error | Date
} {
  const [state, setState] = React.useState<ValueOk | ValueErr>(Ok(''))

  React.useEffect(() => {
    if (!date) {
      setState(Err('', new Error('Empty date')))
      return
    }
    try {
      setState(Ok(dateToYmd(date)))
    } catch (e) {
      setState(Err('', e))
    }
  }, [date])

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
    () => ({ min: dateToYmdSafe(extents.min), max: dateToYmdSafe(extents.max) }),
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
