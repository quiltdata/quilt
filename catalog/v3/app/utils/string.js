/* String utils */
import React from 'react'
import { FormattedNumber } from 'react-intl'

export function makeMatcher(exp, flags = 'i') {
  const re = new RegExp(exp, flags)
  return (s) => re.test(s)
}

export function printObject(obj) {
  return JSON.stringify(obj, null, '  ')
}

const suffixes = ['', 'k', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y']

const splitNumber = (n) => {
  const exp = n === 0 ? 0 : Math.log10(n)
  const index = Math.min(Math.floor(exp / 3), suffixes.length - 1)
  const coeff = (n / 10 ** (index * 3)).toFixed(1)
  return [coeff, suffixes[index]]
}

export function readableBytes(bytes) {
  if (!Number.isInteger(bytes)) return '?'
  // https://en.wikipedia.org/wiki/Kilobyte
  const [coeff, suffix] = splitNumber(bytes)
  return (
    <span>
      <FormattedNumber value={coeff} />
      &nbsp;{suffix}B
    </span>
  )
}

export function readableQuantity(q) {
  if (!Number.isInteger(q)) return '?'
  const [coeff, suffix] = splitNumber(q)
  return (
    <span>
      <FormattedNumber value={coeff} />
      {suffix}
    </span>
  )
}
