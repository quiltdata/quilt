interface Rules {
  zero?: (v: number) => string
  one?: (v: number) => string
  // NOTE: we don't need it yet and, maybe, never
  // two?: (v: number) => string
  // few?: (v: number) => string
  // many?: (v: number) => string
  other: (v: number) => string
}

function numberToRule(value: number) {
  if (value === 0) return 'zero'
  if (value === 1) return 'one'
  // NOTE: we don't need it yet and, maybe, never
  // 2,3,4,22,23... return 'few'
  // 5,6,...11,12... return 'many'
  switch (value) {
    case 0:
      return 'zero'
    case 1:
      return 'one'
    default:
      return 'other'
  }
}

export function format(value: number, rules: Rules) {
  const intlFunc = rules[numberToRule(value)]
  if (intlFunc) return intlFunc(value)
  return rules.other(value)
}
