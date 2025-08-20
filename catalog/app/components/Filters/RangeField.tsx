import * as React from 'react'
import * as M from '@material-ui/core'

type InputStateOk<Parsed> = { _tag: 'ok'; value: string; parsed: Parsed }

type InputStateError = { _tag: 'error'; value: string; error: Error }

export type InputState<Parsed> = InputStateOk<Parsed> | InputStateError

export function Ok<Parsed>(value: string, parsed: Parsed): InputStateOk<Parsed> {
  return {
    _tag: 'ok',
    value,
    parsed,
  }
}

export function Err(value: string, error: unknown): InputStateError {
  return {
    _tag: 'error',
    value,
    error: error instanceof Error ? error : new Error('Invalid value'),
  }
}

function areEqual<T>(a: InputState<T>, b: InputState<T>): boolean {
  if (a._tag === 'ok' && b._tag === 'ok') return a.parsed === b.parsed
  if (a._tag === 'error' && b._tag === 'error') return a.error.message === b.error.message
  return false
}

const useStyles = M.makeStyles((t) => ({
  input: {
    background: t.palette.background.paper,
  },
}))

interface RangeFieldProps<Parsed> {
  className?: string
  extents: { min?: Parsed; max?: Parsed }
  onChange: (v: Parsed | null) => void
  parseString: (input: string) => InputState<Parsed>
  stringify: (v?: Parsed | null) => InputState<Parsed>
  value: Parsed | null
}

export type Props<Parsed> = Omit<M.TextFieldProps, 'value' | 'onChange'> &
  RangeFieldProps<Parsed>

function RangeField<Parsed>({
  className,
  extents,
  onChange,
  parseString,
  stringify,
  value,
  ...props
}: Props<Parsed>) {
  const classes = useStyles()

  const [state, setState] = React.useState(() => stringify(value))

  React.useEffect(
    () =>
      setState((prev) => {
        const next = stringify(value)
        return areEqual(prev, next) ? prev : next
      }),
    [stringify, value],
  )

  const handleChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const newState = parseString(event.target.value)
      setState(newState)
      if (newState._tag === 'ok') {
        onChange(newState.parsed)
      }
    },
    [onChange, parseString],
  )

  const inputProps = React.useMemo(
    () => ({
      min: stringify(extents.min).value || undefined,
      max: stringify(extents.max).value || undefined,
    }),
    [extents, stringify],
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
