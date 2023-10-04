import * as React from 'react'

const MINUTE = 1000 * 60
const HOUR = MINUTE * 60
const DAY = HOUR * 24
const MONTH = DAY * 30
const YEAR = DAY * 365

const intl = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

export function relativify(date: Date, baseDate?: Date) {
  const delta = date.valueOf() - (baseDate?.valueOf() || Date.now())

  const years = delta / YEAR
  if (Math.abs(years) >= 1) return intl.format(Math.round(years), 'year')

  const months = delta / MONTH
  if (Math.abs(months) >= 1) return intl.format(Math.round(months), 'month')

  const days = delta / DAY
  if (Math.abs(days) >= 1) return intl.format(Math.round(days), 'day')

  const hours = delta / HOUR
  if (Math.abs(hours) >= 1) return intl.format(Math.round(hours), 'hour')

  const minutes = delta / MINUTE
  if (Math.abs(minutes) >= 1) return intl.format(Math.round(minutes), 'minute')

  return intl.format(Math.round(delta / 1000), 'second')
}

interface RelativeProps {
  value: Date
}

export function Relative({ value }: RelativeProps) {
  const [t, setT] = React.useState(new Date())

  React.useEffect(() => {
    const timerId = window.setInterval(() => setT(new Date()), 1000)
    return () => clearInterval(timerId)
  }, [value])

  // return a Fragment to overcome a typing limitation:
  // https://github.com/DefinitelyTyped/DefinitelyTyped/issues/20544
  return React.useMemo(() => <>{relativify(value, t)}</>, [value, t])
}

interface Rules {
  zero?: string | ((v: number) => string)
  one?: string | ((v: number) => string)
  // NOTE: we don't need it yet and, maybe, never
  // two?: (v: number) => string
  // few?: (v: number) => string
  // many?: (v: number) => string
  other: string | ((v: number) => string)
}

function numberToRule(value: number) {
  switch (value) {
    case 0:
      return 'zero'
    case 1:
      return 'one'
    // NOTE: we don't need it yet and, maybe, never
    // 2,3,4,22,23... return 'few'
    // 5,6,...11,12... return 'many'
    default:
      return 'other'
  }
}

export function pluralify(value: number, rules: Rules) {
  const intlFunc = rules[numberToRule(value)]
  if (intlFunc) return typeof intlFunc === 'function' ? intlFunc(value) : intlFunc
  return typeof rules.other === 'function' ? rules.other(value) : rules.other
}

interface PluralProps extends Rules {
  value: number
}

export function Plural({ value, zero, one, other }: PluralProps) {
  // return a Fragment to overcome a typing limitation:
  // https://github.com/DefinitelyTyped/DefinitelyTyped/issues/20544
  return React.useMemo(
    () => <>{pluralify(value, { zero, one, other })}</>,
    [value, zero, one, other],
  )
}
