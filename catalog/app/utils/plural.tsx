import * as React from 'react'

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

export function format(value: number, rules: Rules) {
  const intlFunc = rules[numberToRule(value)]
  if (intlFunc) return typeof intlFunc === 'function' ? intlFunc(value) : intlFunc
  return typeof rules.other === 'function' ? rules.other(value) : rules.other
}

interface PluralProps extends Rules {
  value: number
}

export function Plural({ value, zero, one, other }: PluralProps) {
  const str = React.useMemo(() => format(value, { zero, one, other }), [
    value,
    zero,
    one,
    other,
  ])
  return <>{str}</>
}
