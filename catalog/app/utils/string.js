/* String utils */
import * as R from 'ramda'
import React from 'react'

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

const numberFormat = new Intl.NumberFormat('en-US')

export function formatQuantity(
  q,
  {
    fallback,
    renderValue = R.identity,
    renderSuffix = R.identity,
    Component = React.Fragment,
  } = {},
) {
  if (!Number.isInteger(q)) {
    return typeof fallback === 'function' ? fallback(q) : fallback
  }
  const [coeff, suffix] = splitNumber(q)
  return (
    <Component>
      {renderValue(numberFormat.format(coeff).toString())}
      {renderSuffix(suffix)}
    </Component>
  )
}

export const mkFormatQuantity = (opts) => (q) => formatQuantity(q, opts)

export const readableQuantity = mkFormatQuantity({ fallback: '?', Component: 'span' })

export const readableBytes = (bytes, extra) =>
  formatQuantity(bytes, {
    fallback: '?',
    renderSuffix: (suffix) => (
      <>
        {extra}&nbsp;{suffix}B
      </>
    ),
    Component: 'span',
  })

export const trimCenter = (str, maxLength) => {
  if (str.length <= maxLength) return str
  const divider = ' … '
  const to = (maxLength - divider.length) / 2
  const from = str.length - (maxLength - divider.length) / 2
  return str.substring(0, to) + divider + str.substring(from, str.length)
}
