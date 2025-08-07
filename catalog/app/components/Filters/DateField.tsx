import * as dateFns from 'date-fns'
import * as React from 'react'
import * as M from '@material-ui/core'

import Log from 'utils/Logging'

const ymdToDate = (ymd: string): Date => new Date(ymd)

const dateToYmd = (date: Date): string => dateFns.format(date, 'yyyy-MM-dd')

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

  const [value, setValue] = React.useState('')
  const [error, setError] = React.useState<Error | null>(null)

  React.useEffect(() => {
    if (!date) {
      setError(new Error('Empty date'))
      setValue('')
      return
    }
    try {
      const ymd = dateToYmd(date)
      setError(null)
      setValue(ymd)
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Failed to format'))
      setValue('')
    }
  }, [date])

  const handleChange = React.useCallback(
    (event) => {
      setValue(event.target.value)

      const d = ymdToDate(event.target.value)
      if (Number.isNaN(d.valueOf())) {
        setError(new Error(d.toString()))
      } else {
        onChange(d)
      }
    },
    [onChange],
  )

  const min = React.useMemo(() => {
    if (!extents.min) return undefined
    try {
      return dateToYmd(extents.min)
    } catch (e) {
      Log.error(e)
      return undefined
    }
  }, [extents])

  const max = React.useMemo(() => {
    if (!extents.max) return undefined
    try {
      return dateToYmd(extents.max)
    } catch (e) {
      Log.error(e)
      return undefined
    }
  }, [extents])

  return (
    <M.TextField
      InputLabelProps={{ shrink: true }}
      InputProps={{ classes }}
      inputProps={{ min, max }}
      className={className}
      error={!!error}
      helperText={error?.message}
      onChange={handleChange}
      size="small"
      type="date"
      value={value}
      variant="outlined"
      {...props}
    />
  )
}
