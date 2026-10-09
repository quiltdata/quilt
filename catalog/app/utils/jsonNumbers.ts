/** Numbers JSON.parse would store differently from how they were typed. */

/** A number JSON keeps as typed: finite, and an integer only if within the safe range. */
export const isExactNumber = (n: number) =>
  Number.isFinite(n) && (!Number.isInteger(n) || Number.isSafeInteger(n))

export const allExact = (v: unknown): boolean =>
  typeof v === 'number'
    ? isExactNumber(v)
    : v !== null && typeof v === 'object'
      ? Object.values(v).every(allExact)
      : true

/** Whether decimal text, exponent included, is a whole number ("1.5e1" yes, "1.0…01e0" no). */
export const isIntegralText = (t: string) => {
  const [m, e = '0'] = t.replace(/^[-+]/, '').split(/e/i)
  const [int, frac = ''] = m.split('.')
  const digits = int + frac
  const point = int.length + Number(e)
  return !/[1-9]/.test(digits.slice(Math.max(point, 0)))
}
/** A number token JSON.parse would round to 0 or to an integer ("1e-400", "1.0…01"). */
export const hasLossyToken = (json: string) =>
  (
    json.replace(/"(?:[^"\\]|\\.)*"/g, '""').match(/-?\d+(\.\d+)?(e[-+]?\d+)?/gi) || []
  ).some((t) => {
    const n = Number(t)
    return (
      (n === 0 && /[1-9]/.test(t.split(/e/i)[0])) ||
      (Number.isInteger(n) && !isIntegralText(t))
    )
  })
