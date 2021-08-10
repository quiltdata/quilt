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
  if (intlFunc) return intlFunc(value)
  return rules.other(value)
}
