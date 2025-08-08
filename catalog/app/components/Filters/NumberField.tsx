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

function fromString(str: string): InputState<string, number> {
  const num = Number(str)
  return typeof num !== 'number' || Number.isNaN(num)
    ? Err(str, new Error('Not a number'))
    : Ok(str, num)
}

function fromNumber(num?: number | null): InputState<string, number> {
  if (num == null) return Err('', new Error('Enter number, please'))
  if (typeof num !== 'number' || Number.isNaN(num)) {
    const error = new Error('Not a number')
    Log.error(error)
    return Err('', error)
  }
  return Ok(num.toString(), num)
}

function areEqual(
  a: InputState<string, number | null>,
  b: InputState<string, number | null>,
): boolean {
  if (a._tag === 'ok' && b._tag === 'ok') return a.parsed === b.parsed
  if (a._tag === 'error' && b._tag === 'error') return a.error.message === b.error.message
  return false
}

const useDateFieldStyles = M.makeStyles((t) => ({
  input: {
    background: t.palette.background.paper,
  },
}))

interface NumberFieldProps {
  className?: string
  value: number | null
  onChange: (v: number | null) => void
  extents: { min?: number; max?: number }
}

export default function NumberField({
  className,
  value,
  extents,
  onChange,
  ...props
}: Omit<M.TextFieldProps, 'value' | 'onChange'> & NumberFieldProps) {
  const classes = useDateFieldStyles()

  const [state, setState] = React.useState<InputState<string, number | null>>(
    fromNumber(value),
  )

  React.useEffect(() => {
    setState((prev) => {
      const newNumber = fromNumber(value)
      return areEqual(prev, newNumber) ? prev : newNumber
    })
  }, [value])

  const handleChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const newState = fromString(event.target.value)
      setState(newState)
      if (newState._tag === 'ok') {
        onChange(newState.parsed)
      }
    },
    [onChange],
  )

  const InputProps = React.useMemo(() => ({ classes }), [classes])

  return (
    <M.TextField
      InputProps={InputProps}
      className={className}
      error={state._tag === 'error'}
      helperText={state._tag === 'error' && state.error.message}
      inputProps={extents}
      onChange={handleChange}
      size="small"
      value={state.value}
      variant="outlined"
      {...props}
    />
  )
}
