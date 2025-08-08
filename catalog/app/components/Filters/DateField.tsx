import * as dateFns from 'date-fns'
import * as React from 'react'
import * as M from '@material-ui/core'

import Log from 'utils/Logging'

type InputStateOk<V, P> = { _tag: 'ok'; value: V; parsed: P }

type InputStateError<V> = { _tag: 'error'; value: V; error: Error }

type InputState<V, P> = InputStateOk<V, P> | InputStateError<V>

function Ok<V, P>(value: V, parsed: P): InputStateOk<V, P> {
  return {
    _tag: 'ok',
    value,
    parsed,
  }
}

function Err<V>(value: V, error: unknown): InputStateError<V> {
  return {
    _tag: 'error',
    value,
    error: error instanceof Error ? error : new Error('Invalid date'),
  }
}

const InputLabelProps = { shrink: true }

function fromYmd(ymd: string): InputState<string, Date> {
  const date = dateFns.parseISO(ymd)
  return dateFns.isValid(date) ? Ok(ymd, date) : Err(ymd, new Error(date.toString()))
}

function fromDate(date?: Date | null): InputState<string, Date> {
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

  const [state, setState] = React.useState<InputState<string, Date | null>>(
    fromDate(date),
  )

  React.useEffect(() => setState(fromDate(date)), [date])

  const handleChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const newState = fromYmd(event.target.value)
      setState(newState)
      if (newState._tag === 'ok') {
        onChange(newState.parsed)
      }
    },
    [onChange],
  )

  const inputProps = React.useMemo(
    () => ({
      min: fromDate(extents.min).value || undefined,
      max: fromDate(extents.max).value || undefined,
    }),
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
