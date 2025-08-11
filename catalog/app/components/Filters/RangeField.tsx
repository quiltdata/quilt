import * as React from 'react'
import * as M from '@material-ui/core'

type InputStateOk<V, P> = { _tag: 'ok'; value: V; parsed: P }

type InputStateError<V> = { _tag: 'error'; value: V; error: Error }

export type InputState<V, P> = InputStateOk<V, P> | InputStateError<V>

export function Ok<V, P>(value: V, parsed: P): InputStateOk<V, P> {
  return {
    _tag: 'ok',
    value,
    parsed,
  }
}

export function Err<V>(value: V, error: unknown): InputStateError<V> {
  return {
    _tag: 'error',
    value,
    error: error instanceof Error ? error : new Error('Invalid date'),
  }
}

function areEqual<Value>(
  a: InputState<string, Value | null>,
  b: InputState<string, Value | null>,
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

interface RangeFieldProps<Value> {
  className?: string
  value: Value | null
  extents: { min?: Value; max?: Value }
  fromValue: (date?: Value | null) => InputState<string, Value>
  onChange: (v: Value | null) => void
  toValue: (ymd: string) => InputState<string, Value>
}

export type Props<Value> = Omit<M.TextFieldProps, 'value' | 'onChange'> &
  RangeFieldProps<Value>

function RangeField<Value>({
  className,
  extents,
  fromValue,
  onChange,
  toValue,
  value,
  ...props
}: Props<Value>) {
  const classes = useDateFieldStyles()

  const [state, setState] = React.useState<InputState<string, Value | null>>(
    fromValue(value),
  )

  React.useEffect(
    () =>
      setState((prev) => {
        const next = fromValue(value)
        return areEqual(prev, next) ? prev : next
      }),
    [fromValue, value],
  )

  const handleChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const newState = toValue(event.target.value)
      setState(newState)
      if (newState._tag === 'ok') {
        onChange(newState.parsed)
      }
    },
    [onChange, toValue],
  )

  const inputProps = React.useMemo(
    () => ({
      min: fromValue(extents.min).value || undefined,
      max: fromValue(extents.max).value || undefined,
    }),
    [extents, fromValue],
  )

  const InputProps = React.useMemo(() => ({ classes }), [classes])

  return (
    <M.TextField
      InputProps={InputProps}
      className={className}
      error={state._tag === 'error'}
      helperText={state._tag === 'error' && state.error.message}
      inputProps={inputProps}
      onChange={handleChange}
      size="small"
      value={state.value}
      variant="outlined"
      {...props}
    />
  )
}

export const Field = RangeField
