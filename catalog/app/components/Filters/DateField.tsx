import * as dateFns from 'date-fns'
import * as React from 'react'
import * as M from '@material-ui/core'

import Log from 'utils/Logging'

type ValueOk<V, P> = { _tag: 'ok'; value: V; parsed: P }

type ValueErr<V> = { _tag: 'error'; value: V; error: Error }

type Value<V, P> = ValueOk<V, P> | ValueErr<V>

function Ok<V, P>(value: V, parsed: P): ValueOk<V, P> {
  return {
    _tag: 'ok',
    value,
    parsed,
  }
}

function Err<V>(value: V, error: unknown): ValueErr<V> {
  return {
    _tag: 'error',
    value,
    error: error instanceof Error ? error : new Error('Invalid date'),
  }
}

const InputLabelProps = { shrink: true }

const fromYmd = (ymd: string): Value<string, Date> => {
  const date = new Date(ymd)
  if (Number.isNaN(date.valueOf())) {
    const error = new Error(date.toString())
    return Err(ymd, error)
  }
  return Ok(ymd, date)
}

const fromDate = (date?: Date | null): Value<string, Date> => {
  if (!date) return Err('', new Error('Empty date'))
  try {
    return Ok(dateFns.format(date, 'yyyy-MM-dd'), date)
  } catch (e) {
    Log.error(e)
    return Err('', e)
  }
}

const useDateFieldStyles = M.makeStyles((t) => ({
  input: {
    background: t.palette.background.paper,
  },
}))

interface DateFieldProps {
  className?: string
  date: Date | null
  onChange: (v: Date | null) => void
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

  const [state, setState] = React.useState<Value<string, Date | null>>(Ok('', date))

  React.useEffect(() => setState(fromDate(date)), [date])

  const handleChange = React.useCallback(
    (event) => {
      const newState = fromYmd(event.target.value)
      setState(newState)
      if (newState._tag === 'ok') {
        onChange(newState.parsed)
      }
    },
    [onChange],
  )

  const inputProps = React.useMemo(
    () => ({ min: fromDate(extents.min).value, max: fromDate(extents.max).value }),
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
